import { beforeEach, describe, expect, it, vi } from "vitest";

type Cell = string | number | null;

// Planilha falsa em memória que imita as respostas da API do Google Sheets.
const fake = vi.hoisted(() => ({ sheets: new Map<string, Cell[][]>() }));

const unquote = (range: string) => range.split("!")[0].replace(/^'|'$/g, "").replace(/''/g, "'");

vi.mock("./google", () => ({
  googleFetch: async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;

    if (url.includes("?fields=sheets.properties")) {
      return {
        sheets: Array.from(fake.sheets.keys()).map((title, sheetId) => ({
          properties: { sheetId, title },
        })),
      };
    }
    if (url.endsWith(":batchUpdate") && !url.includes("/values:")) {
      const titles = Array.from(fake.sheets.keys());
      for (const req of body.requests) {
        if (req.addSheet) fake.sheets.set(req.addSheet.properties.title, []);
        if (req.deleteSheet) fake.sheets.delete(titles[req.deleteSheet.sheetId]);
      }
      return {};
    }
    if (url.includes("/values:batchGet")) {
      const ranges = new URL(url).searchParams.getAll("ranges");
      return {
        valueRanges: ranges.map(range => {
          // A API omite células e linhas vazias no fim.
          const rows = (fake.sheets.get(unquote(range)) ?? []).map(row => {
            const copy = [...row];
            while (copy.length && (copy[copy.length - 1] ?? "") === "") copy.pop();
            return copy;
          });
          while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
          return rows.length ? { values: rows } : {};
        }),
      };
    }
    if (url.includes("/values:batchUpdate")) {
      for (const { range, values } of body.data) {
        const grid = fake.sheets.get(unquote(range))!;
        values.forEach((row: Cell[], r: number) => {
          grid[r] = grid[r] ?? [];
          row.forEach((cell, c) => (grid[r][c] = cell));
        });
      }
      return {};
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  },
}));

import { SheetStore } from "./sheetStore";
import { tables } from "./schema";

describe("SheetStore", () => {
  beforeEach(() => {
    fake.sheets.clear();
    fake.sheets.set("Página1", []);
  });

  it("cria uma aba por tabela com cabeçalho e remove a aba padrão", async () => {
    const store = new SheetStore("abc");
    await store.load();

    expect(fake.sheets.has("Página1")).toBe(false);
    expect(fake.sheets.get("Lancamentos")![0]).toEqual(Object.keys(tables.transactions.columns));
    expect(fake.sheets.size).toBe(Object.keys(tables).length);
  });

  it("grava e relê registros preservando tipos", async () => {
    const store = new SheetStore("abc");
    await store.load();

    const date = new Date("2026-03-15T12:00:00.000Z");
    const created = store.insert("transactions", {
      userId: 1,
      competencyId: 2,
      type: "expense",
      category: "Alimentação",
      description: "Mercado",
      amount: "123.4",
      transactionDate: date,
    });
    await store.commit();

    expect(created.id).toBe(1);
    expect(created.isPaid).toBe(0);

    const reloaded = new SheetStore("abc");
    await reloaded.load();
    const [tx] = reloaded.select("transactions");

    expect(tx).toMatchObject({
      id: 1,
      competencyId: 2,
      description: "Mercado",
      amount: "123.40",
      creditCardId: null,
      isPaid: 0,
      installments: 1,
    });
    expect(tx.transactionDate).toEqual(date);
    expect(tx.createdAt).toBeInstanceOf(Date);
  });

  it("apaga da planilha as linhas removidas", async () => {
    const store = new SheetStore("abc");
    await store.load();
    store.insert("accounts", { userId: 1, name: "A" });
    store.insert("accounts", { userId: 1, name: "B" });
    await store.commit();

    store.delete("accounts", a => a.name === "A");
    await store.commit();

    const reloaded = new SheetStore("abc");
    await reloaded.load();
    expect(reloaded.select("accounts").map(a => a.name)).toEqual(["B"]);
  });

  it("não deixa quem lê alterar os dados em memória", async () => {
    const store = new SheetStore("abc");
    await store.load();
    store.insert("accounts", { userId: 1, name: "A" });

    store.select("accounts")[0].name = "alterado";
    expect(store.select("accounts")[0].name).toBe("A");
  });
});
