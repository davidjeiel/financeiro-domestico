import { beforeEach, describe, expect, it, vi } from "vitest";

type Cell = string | number | null;
const fake = vi.hoisted(() => ({ sheets: new Map<string, Cell[][]>() }));
const unquote = (range: string) => range.split("!")[0].replace(/^'|'$/g, "").replace(/''/g, "'");

// Mesma planilha falsa do sheetStore.test.ts (só as rotas usadas pelo store).
vi.mock("./google", async importOriginal => ({
  ...(await importOriginal<typeof import("./google")>()),
  googleFetch: async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.includes("?fields=sheets.properties")) {
      return {
        sheets: Array.from(fake.sheets.keys()).map((title, sheetId) => ({ properties: { sheetId, title } })),
      };
    }
    if (url.endsWith(":batchUpdate") && !url.includes("/values:")) {
      for (const req of body.requests) if (req.addSheet) fake.sheets.set(req.addSheet.properties.title, []);
      return {};
    }
    if (url.includes("/values:batchGet")) {
      const ranges = new URL(url).searchParams.getAll("ranges");
      return { valueRanges: ranges.map(range => ({ values: fake.sheets.get(unquote(range)) ?? [] })) };
    }
    if (url.includes("/values:batchUpdate")) {
      for (const { range, values } of body.data) {
        const grid = fake.sheets.get(unquote(range))!;
        values.forEach((row: Cell[], r: number) => (grid[r] = [...row]));
      }
      return {};
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  },
}));

const current = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("./session", () => ({ getStore: () => current.store }));

import { SheetStore } from "./sheetStore";
import {
  addInvoicePayment,
  createInstallmentTransactions,
  getUserTransactionsByDateRange,
} from "./db";
import { addMonthsClamped, shiftCompetency, splitInstallmentCents } from "./competencyLogic";

async function setup() {
  const s = new SheetStore("abc");
  await s.load();
  current.store = s;
  const card = s.insert("creditCards", { userId: 1, name: "Nubank", cutoffDay: 20, dueDay: 27, isActive: 1 });
  return { s, card };
}

describe("parcelamento", () => {
  beforeEach(() => fake.sheets.clear());

  it("divide o valor e joga a diferença de centavos na 1ª parcela", () => {
    expect(splitInstallmentCents(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitInstallmentCents(1000, 1)).toEqual([1000]);
  });

  it("soma meses sem pular mês curto e avança competências", () => {
    expect(addMonthsClamped(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(shiftCompetency(2026, 11, 3)).toEqual({ year: 2027, month: 2 });
  });

  it("compra parcelada no cartão: uma parcela por fatura, com o valor da parcela", async () => {
    const { s, card } = await setup();
    // Compra no dia 22 (depois do fechamento, dia 20): 1ª parcela na competência de abril.
    const created = await createInstallmentTransactions(1, {
      type: "credit_card",
      category: "Compras",
      description: "TV",
      totalAmount: "1000.00",
      installments: 3,
      firstDate: new Date(2026, 2, 22),
      creditCardId: card.id,
    });

    expect(created.map(t => [t.amount, t.currentInstallment, t.installments])).toEqual([
      ["333.34", 1, 3],
      ["333.33", 2, 3],
      ["333.33", 3, 3],
    ]);
    const months = created.map(t => {
      const c = s.find("competencies", x => x.id === t.competencyId)!;
      return `${c.year}-${c.month}`;
    });
    expect(months).toEqual(["2026-4", "2026-5", "2026-6"]);
    // Cada fatura recebe só a sua parcela.
    expect(s.select("invoices").map(i => i.totalAmount)).toEqual(["333.34", "333.33", "333.33"]);
  });

  it("visão por datas: compras do cartão entram pelo vencimento da fatura", async () => {
    const { card } = await setup();
    await createInstallmentTransactions(1, {
      type: "credit_card",
      category: "Compras",
      totalAmount: "300",
      installments: 3,
      firstDate: new Date(2026, 2, 10), // fecha 20/03 → vence 27/03; 2ª parcela vence 27/04
      creditCardId: card.id,
    });
    await createInstallmentTransactions(1, {
      type: "expense",
      category: "Escola",
      totalAmount: "200",
      installments: 2,
      firstDate: new Date(2026, 2, 10),
    });

    const april = getUserTransactionsByDateRange(1, "2026-04-01", "2026-04-30");
    expect(april.map(t => [t.type, t.currentInstallment])).toEqual([
      ["expense", 2],
      ["credit_card", 2],
    ]);
  });

  it("pagamento parcial e depois total da fatura", async () => {
    const { s, card } = await setup();
    const [first] = await createInstallmentTransactions(1, {
      type: "credit_card",
      category: "Compras",
      totalAmount: "500",
      installments: 2,
      firstDate: new Date(2026, 2, 10),
      creditCardId: card.id,
    });

    let invoice = await addInvoicePayment(1, card.id, first.competencyId, 100);
    expect(invoice).toMatchObject({ paidAmount: "100.00", status: "partial" });
    await expect(addInvoicePayment(1, card.id, first.competencyId, 200)).rejects.toThrow(/passa do valor em aberto/);
    invoice = await addInvoicePayment(1, card.id, first.competencyId, 150);
    expect(invoice).toMatchObject({ paidAmount: "250.00", status: "paid" });
    await expect(addInvoicePayment(1, card.id, first.competencyId, 1)).rejects.toThrow(/já está paga/);
    expect(s.select("invoices")).toHaveLength(2);
  });
});

describe("competência: fatura no mês do vencimento", () => {
  beforeEach(() => fake.sheets.clear());

  it("cartão que vence depois do fechamento (fecha 20, vence 27): compras de novembro vencem em novembro", async () => {
    const { s, card } = await setup(); // fechamento dia 20, vencimento dia 27
    const { getCompetencyTransactions, invoiceDueDateOf } = await import("./db");
    const oct = s.insert("competencies", { userId: 1, year: 2026, month: 10, name: "Outubro de 2026" });
    const nov = s.insert("competencies", { userId: 1, year: 2026, month: 11, name: "Novembro de 2026" });
    s.insert("transactions", { userId: 1, competencyId: oct.id, type: "credit_card", creditCardId: card.id, category: "X", description: "Compra out", amount: "100", transactionDate: new Date(2026, 9, 10) });
    const novPurchase = s.insert("transactions", { userId: 1, competencyId: nov.id, type: "credit_card", creditCardId: card.id, category: "X", description: "Compra nov", amount: "50", transactionDate: new Date(2026, 10, 10) });
    s.insert("transactions", { userId: 1, competencyId: nov.id, type: "expense", category: "Luz", description: "Luz", amount: "200", transactionDate: new Date(2026, 10, 15) });

    expect(invoiceDueDateOf(s, novPurchase)).toEqual(new Date(2026, 10, 27));
    expect((await getCompetencyTransactions(nov.id)).map(t => t.description).sort()).toEqual(["Compra nov", "Luz"]);
    expect((await getCompetencyTransactions(oct.id)).map(t => t.description)).toEqual(["Compra out"]);
  });

  it("cartão que vence antes do fechamento (fecha 28, vence 5): em novembro aparece a fatura de outubro", async () => {
    const { s } = await setup();
    const { getCompetencyTransactions } = await import("./db");
    const card = s.insert("creditCards", { userId: 1, name: "Nubank", cutoffDay: 28, dueDay: 5, isActive: 1 });
    const oct = s.insert("competencies", { userId: 1, year: 2026, month: 10, name: "Outubro de 2026" });
    const nov = s.insert("competencies", { userId: 1, year: 2026, month: 11, name: "Novembro de 2026" });
    s.insert("transactions", { userId: 1, competencyId: oct.id, type: "credit_card", creditCardId: card.id, category: "X", description: "Compra out", amount: "100", transactionDate: new Date(2026, 9, 10) });
    s.insert("transactions", { userId: 1, competencyId: nov.id, type: "credit_card", creditCardId: card.id, category: "X", description: "Compra nov", amount: "50", transactionDate: new Date(2026, 10, 10) });
    // Fecha 28/10 → vence 05/11.
    expect((await getCompetencyTransactions(nov.id)).map(t => t.description)).toEqual(["Compra out"]);
  });

  it("faturas antigas com vencimento errado são corrigidas no recálculo", async () => {
    const { s, card } = await setup();
    const { syncAllInvoices } = await import("./db");
    const nov = s.insert("competencies", { userId: 1, year: 2026, month: 11, name: "Novembro de 2026" });
    s.insert("transactions", { userId: 1, competencyId: nov.id, type: "credit_card", creditCardId: card.id, category: "X", description: "Compra", amount: "50", transactionDate: new Date(2026, 10, 10) });
    s.insert("invoices", { userId: 1, creditCardId: card.id, competencyId: nov.id, closingDate: new Date(2026, 10, 20), dueDate: new Date(2026, 11, 27), totalAmount: "50.00", paidAmount: "0.00", status: "open" });
    expect(syncAllInvoices(s, 1)).toBe(1);
    expect(s.select("invoices")[0].dueDate).toEqual(new Date(2026, 10, 27));
  });
});

describe("ordem manual", () => {
  beforeEach(() => fake.sheets.clear());

  it("numera na ordem arrastada e, depois, redistribui as posições existentes", async () => {
    const { s } = await setup();
    const { reorderTransactions } = await import("./db");
    const ids = ["A", "B", "C", "D"].map(d =>
      s.insert("transactions", { userId: 1, competencyId: 1, type: "expense", category: "X", description: d, amount: "1", transactionDate: new Date(2026, 0, 1) }).id
    );
    const order = () =>
      s.select("transactions").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(t => t.description);

    await reorderTransactions([ids[2], ids[0], ids[3], ids[1]]);
    expect(order()).toEqual(["C", "A", "D", "B"]);
    expect(s.select("transactions").map(t => t.sortOrder).sort((a, b) => a! - b!)).toEqual([10, 20, 30, 40]);

    // Arrastando só parte (ex.: lista filtrada), os outros não saem do lugar.
    await reorderTransactions([ids[1], ids[0]]); // B antes de A
    expect(order()).toEqual(["C", "B", "D", "A"]);
  });
});

describe("hotfix: compras antigas na fatura errada", () => {
  beforeEach(() => fake.sheets.clear());

  it("encontra compras fora da fatura certa (pela data e fechamento) e corrige só as confirmadas", async () => {
    const { s, card } = await setup(); // fecha 20, vence 27
    const { findMisplacedCardPurchases, fixMisplacedCardPurchases } = await import("./db");
    const nov = s.insert("competencies", { userId: 1, year: 2026, month: 11, name: "nov" });
    const dec = s.insert("competencies", { userId: 1, year: 2026, month: 12, name: "dez" });
    const add = (competencyId: number, description: string, date: Date, extra = {}) =>
      s.insert("transactions", { userId: 1, competencyId, type: "credit_card", creditCardId: card.id, category: "X", description, amount: "10", transactionDate: date, ...extra });
    // Gravadas no mês aberto na tela (dezembro), mas são de antes do fechamento de novembro.
    const a = add(dec.id, "Farmácia", new Date(2026, 10, 5));
    const b = add(dec.id, "Mercado", new Date(2026, 10, 12));
    add(nov.id, "Certa", new Date(2026, 10, 8)); // já está certa
    add(dec.id, "Parcela 2/3", new Date(2026, 10, 9), { installments: 3, currentInstallment: 2 }); // parcela: fica
    add(dec.id, "Depois do fechamento", new Date(2026, 10, 22)); // 22/11 ≥ 20: dezembro está certo

    const found = findMisplacedCardPurchases(s, 1);
    expect(found.map(f => f.description)).toEqual(["Farmácia", "Mercado"]);
    expect(found[0]).toMatchObject({ fromDueDate: new Date(2026, 11, 27), toDueDate: new Date(2026, 10, 27), cardName: "Nubank" });

    const { moved } = await fixMisplacedCardPurchases(1, [a.id]); // só a confirmada
    expect(moved).toBe(1);
    expect(s.find("transactions", t => t.id === a.id)!.competencyId).toBe(nov.id);
    expect(s.find("transactions", t => t.id === b.id)!.competencyId).toBe(dec.id);
    expect(findMisplacedCardPurchases(s, 1).map(f => f.description)).toEqual(["Mercado"]);
    // Faturas recalculadas: novembro com Farmácia + Certa; dezembro com Mercado + parcela + depois do fechamento.
    const totals = Object.fromEntries(s.select("invoices").map(i => [i.competencyId, i.totalAmount]));
    expect(totals[nov.id]).toBe("20.00");
    expect(totals[dec.id]).toBe("30.00");
  });
});
