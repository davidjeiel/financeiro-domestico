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
      firstDate: new Date(2026, 2, 10), // competência de março → vence 27/04
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
      ["credit_card", 1],
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
