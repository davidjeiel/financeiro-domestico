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
import { createRecurringTransactions, setRecurrence } from "./db";
import { fixedVsVariableReport, suggestRecurringSeries } from "./fixedExpenses";

async function setup() {
  const s = new SheetStore("abc");
  await s.load();
  current.store = s;
  return s;
}

describe("despesas fixas × variáveis", () => {
  beforeEach(() => fake.sheets.clear());

  it("lançamento recorrente fica marcado como fixo, com a série identificada", async () => {
    const s = await setup();
    const created = await createRecurringTransactions(1, {
      type: "expense",
      category: "Moradia",
      description: "Aluguel",
      amount: "2000",
      frequency: "monthly",
      startDate: new Date(2026, 0, 10),
      endDate: new Date(2026, 2, 10),
    });
    expect(created.map(t => t.recurrence)).toEqual(["monthly", "monthly", "monthly"]);
    expect(new Set(created.map(t => t.recurrenceGroup)).size).toBe(1);
    expect(created[0].recurrenceGroup).toBeTruthy();

    // Persistido na planilha.
    const reloaded = new SheetStore("abc");
    await reloaded.load();
    expect(reloaded.select("transactions").every(t => t.recurrence === "monthly")).toBe(true);
  });

  it("soma fixas e variáveis por mês e por categoria, cartão incluído", async () => {
    const s = await setup();
    await createRecurringTransactions(1, {
      type: "expense", category: "Moradia", description: "Aluguel", amount: "2000",
      frequency: "monthly", startDate: new Date(2026, 1, 10), endDate: new Date(2026, 2, 10),
    });
    const card = s.insert("creditCards", { userId: 1, name: "Nubank", cutoffDay: 28, dueDay: 5, isActive: 1 });
    await createRecurringTransactions(1, {
      type: "credit_card", category: "Assinaturas", description: "Streaming", amount: "55.90",
      frequency: "monthly", startDate: new Date(2026, 2, 3), endDate: new Date(2026, 2, 3), creditCardId: card.id,
    });
    const march = s.find("competencies", c => c.year === 2026 && c.month === 3)!;
    const add = (type: "income" | "expense" | "credit_card", category: string, amount: string) =>
      s.insert("transactions", { userId: 1, competencyId: march.id, type, category, amount, transactionDate: new Date(2026, 2, 15) });
    add("expense", "Moradia", "150.00"); // conserto: variável
    add("credit_card", "Alimentação", "300.10");
    add("income", "Salário", "8000");

    // Compra no cartão conta no mês em que a fatura vence: o streaming de
    // 03/03 (fechamento dia 28) vence em 05/04, então entra em abril.
    const report = fixedVsVariableReport(s, 1, 2026, 4, 4);
    expect(report.months.map(m => [m.label, m.fixed, m.variable, m.income])).toEqual([
      ["jan/26", 0, 0, 0],
      ["fev/26", 2000, 0, 0],
      ["mar/26", 2000, 450.1, 8000],
      ["abr/26", 55.9, 0, 0],
    ]);
    expect(report.fixedItems.map(i => i.description)).toEqual(["Streaming"]);

    const marchReport = fixedVsVariableReport(s, 1, 2026, 3, 1);
    expect(marchReport.byCategory).toEqual([
      { category: "Moradia", fixed: 2000, variable: 150 },
      { category: "Alimentação", fixed: 0, variable: 300.1 },
    ]);
    expect(marchReport.fixedItems.map(i => i.description)).toEqual(["Aluguel"]);
  });

  it("visão mensal usa o mês do calendário; competência, a competência gravada", async () => {
    const s = await setup();
    // Competência que começa dia 25: a despesa de 28/03 pertence à competência de abril.
    const april = s.insert("competencies", { userId: 1, year: 2026, month: 4, name: "Abril de 2026" });
    s.insert("transactions", { userId: 1, competencyId: april.id, type: "expense", category: "Lazer", amount: "80.00", transactionDate: new Date(2026, 2, 28) });
    const card = s.insert("creditCards", { userId: 1, name: "Nubank", cutoffDay: 18, dueDay: 25, isActive: 1 });
    s.insert("transactions", { userId: 1, competencyId: april.id, type: "credit_card", creditCardId: card.id, category: "Compras", amount: "40.00", transactionDate: new Date(2026, 3, 2) });

    const byMode = (mode: "competency" | "monthly") =>
      fixedVsVariableReport(s, 1, 2026, 4, 2, mode).months.map(m => [m.label, m.variable]);
    expect(byMode("competency")).toEqual([["mar/26", 0], ["abr/26", 120]]);
    // Mensal: a despesa vai para março (data); a compra, para abril (fatura vence 25/04).
    expect(byMode("monthly")).toEqual([["mar/26", 80], ["abr/26", 40]]);
  });

  it("sugere séries antigas sem marca e permite marcá-las como fixas", async () => {
    const s = await setup();
    const comps = [1, 2, 3, 4].map(m => s.insert("competencies", { userId: 1, year: 2026, month: m, name: `m${m}` }));
    const ids = comps.map(c =>
      s.insert("transactions", { userId: 1, competencyId: c.id, type: "expense", category: "Educação", description: "Escola ", amount: "900.00", transactionDate: new Date(2026, 0, 5) }).id
    );
    // Valor diferente não é a mesma série; parcela não é fixa; só 2 meses não basta.
    s.insert("transactions", { userId: 1, competencyId: comps[0].id, type: "expense", category: "Educação", description: "Escola", amount: "950.00", transactionDate: new Date(2026, 0, 5) });
    comps.forEach(c => s.insert("transactions", { userId: 1, competencyId: c.id, type: "credit_card", category: "Compras", description: "TV", amount: "250", installments: 4, transactionDate: new Date(2026, 0, 5) }));
    comps.slice(0, 2).forEach(c => s.insert("transactions", { userId: 1, competencyId: c.id, type: "expense", category: "Saúde", description: "Farmácia", amount: "80", transactionDate: new Date(2026, 0, 5) }));

    const suggestions = suggestRecurringSeries(s, 1);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ description: "Escola ", months: 4, amount: 900, ids });

    await setRecurrence(suggestions[0].ids, "monthly");
    expect(suggestRecurringSeries(s, 1)).toHaveLength(0);
    expect(s.select("transactions", t => ids.includes(t.id)).every(t => t.recurrence === "monthly")).toBe(true);

    await setRecurrence([ids[0]], null);
    expect(s.find("transactions", t => t.id === ids[0])).toMatchObject({ recurrence: null, recurrenceGroup: null });
  });
});
