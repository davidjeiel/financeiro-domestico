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
import { createSavedFilter, getSavedFilters, updateSavedFilter } from "./db";
import { applyFilterCriteria, savedFilterToState, stateToSavedFilter } from "../lib/filterCriteria";

async function setup() {
  const s = new SheetStore("abc");
  await s.load();
  current.store = s;
  return s;
}

describe("filtros salvos na planilha", () => {
  beforeEach(() => fake.sheets.clear());

  it("grava descrição, cartões e valores e devolve os mesmos resultados", async () => {
    const s = await setup();
    await createSavedFilter(
      1,
      stateToSavedFilter("Mercado", { startDate: "2026-11-01" }, { description: "Mercado", creditCardIds: [7], minAmount: 10 })
    );
    // Relê da planilha, como ao abrir o app de novo.
    const reloaded = new SheetStore("abc");
    await reloaded.load();
    current.store = reloaded;
    const [row] = await getSavedFilters(1);
    expect(row.description).toBe("Mercado");
    const state = savedFilterToState(row);
    expect(state.startDate).toBe("2026-11-01");
    const txs = [
      { id: 1, description: "mercado do bairro", type: "credit_card", category: "Alimentação", creditCardId: 7, amount: "50" },
      { id: 2, description: "Mercado", type: "credit_card", category: "Alimentação", creditCardId: 8, amount: "50" },
      { id: 3, description: "Farmácia", type: "credit_card", category: "Saúde", creditCardId: 7, amount: "50" },
    ];
    expect(applyFilterCriteria(txs, state.criteria).map(t => t.id)).toEqual([1]);
    expect(s).toBeTruthy();
  });

  it("mantém um único filtro padrão e apaga critérios removidos na edição", async () => {
    await setup();
    const a = await createSavedFilter(1, { name: "A", description: "a", isDefault: true });
    const b = await createSavedFilter(1, { name: "B", description: "b" });
    await updateSavedFilter(b.id, { isDefault: true });
    let rows = await getSavedFilters(1);
    expect(rows.map(r => [r.name, r.isDefault])).toEqual([["A", 0], ["B", 1]]);

    await updateSavedFilter(a.id, { name: "A2", criteria: { types: ["expense"] } });
    rows = await getSavedFilters(1);
    const edited = rows.find(r => r.id === a.id)!;
    expect(edited.name).toBe("A2");
    expect(edited.description ?? null).toBeNull();
    expect(savedFilterToState(edited).criteria).toEqual({ type: "expense" });
  });
});
