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
import { consolidateWorkspace, periodTransactionsOf } from "./allWorkspaces";

async function area(id: string) {
  const s = new SheetStore(id);
  await s.load();
  current.store = s;
  return s;
}

describe("visão de todas as áreas", () => {
  beforeEach(() => fake.sheets.clear());

  it("período por competência ou mês do calendário, com cartão pela fatura", async () => {
    const s = await area("pessoal");
    const nov = s.insert("competencies", { userId: 1, year: 2026, month: 11, name: "Novembro de 2026" });
    const dez = s.insert("competencies", { userId: 1, year: 2026, month: 12, name: "Dezembro de 2026" });
    const card = s.insert("creditCards", { userId: 1, name: "Itaú", cutoffDay: 18, dueDay: 25, color: "#F97316", isActive: 1 });
    // Competência começando dia 25: 28/11 é de dezembro.
    s.insert("transactions", { userId: 1, competencyId: dez.id, type: "expense", category: "Lazer", description: "Cinema", amount: "60", transactionDate: new Date(2026, 10, 28) });
    s.insert("transactions", { userId: 1, competencyId: nov.id, type: "income", category: "Salário", amount: "5000", transactionDate: new Date(2026, 10, 5), isPaid: 1 });
    // Compra de 10/11 na fatura que fecha 18/11 e vence 25/11.
    s.insert("transactions", { userId: 1, competencyId: nov.id, type: "credit_card", creditCardId: card.id, category: "Compras", description: "Mercado", amount: "300", transactionDate: new Date(2026, 10, 10) });

    const names = (mode: "competency" | "monthly", m: number) =>
      periodTransactionsOf(s, 1, 2026, m, mode).map(t => t.description || t.category).sort();
    expect(names("competency", 11)).toEqual(["Mercado", "Salário"]);
    expect(names("competency", 12)).toEqual(["Cinema"]);
    expect(names("monthly", 11)).toEqual(["Cinema", "Mercado", "Salário"]);

    const { rows, totals } = consolidateWorkspace(s, 1, "pessoal", 2026, 11, "monthly");
    expect(totals).toEqual({ income: 5000, expense: 60, creditCard: 300, balance: 4640 });
    const mercado = rows.find(r => r.description === "Mercado")!;
    expect(mercado).toMatchObject({ key: expect.stringContaining("pessoal:"), card: { name: "Itaú", color: "#F97316" }, invoiceStatus: "open" });
    expect(mercado.dueDate).toEqual(new Date(2026, 10, 25));
  });
});
