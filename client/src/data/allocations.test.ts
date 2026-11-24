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

import { SheetStore } from "./sheetStore";
import {
  allocationTotals,
  allocationsOf,
  cleanupAllocationsAfterUpdate,
  incomeOptions,
  removeAllocationsOf,
  setAllocations,
} from "./allocations";

async function setup() {
  const s = new SheetStore("abc");
  await s.load();
  const tx = (type: "income" | "expense" | "credit_card", amount: string, description: string) =>
    s.insert("transactions", {
      userId: 1,
      competencyId: 1,
      type,
      category: "X",
      description,
      amount,
      transactionDate: new Date(2026, 2, 5),
    });
  return {
    s,
    salario: tx("income", "5000.00", "Salário"),
    freela: tx("income", "800.00", "Freela"),
    aluguel: tx("expense", "2000.00", "Aluguel"),
    luz: tx("expense", "300.00", "Luz"),
    mercado: tx("credit_card", "900.00", "Mercado"),
  };
}

describe("vínculos despesa ↔ receita", () => {
  beforeEach(() => fake.sheets.clear());

  it("divide uma despesa entre várias receitas e calcula o saldo de cada uma", async () => {
    const { s, salario, freela, mercado, aluguel } = await setup();
    setAllocations(s, aluguel.id, [{ incomeId: salario.id, amount: "2000" }], 1);
    setAllocations(s, mercado.id, [
      { incomeId: salario.id, amount: "500" },
      { incomeId: freela.id, amount: "400.00" },
    ], 1);
    await s.commit();

    expect(allocationsOf(s, salario.id)).toMatchObject({
      role: "income",
      linked: "2500.00",
      remaining: "2500.00",
    });
    expect(allocationsOf(s, mercado.id)).toMatchObject({ role: "expense", linked: "900.00", remaining: "0.00" });
    expect(allocationsOf(s, mercado.id)!.links.map(l => l.counterpart?.description)).toEqual(["Salário", "Freela"]);
    expect(allocationTotals(s).get(freela.id)).toBe(40000);

    // Persistido na aba Vinculos.
    const reloaded = new SheetStore("abc");
    await reloaded.load();
    expect(reloaded.select("incomeAllocations")).toHaveLength(3);
  });

  it("não deixa vincular mais que a despesa nem mais que o disponível da receita", async () => {
    const { s, salario, freela, luz, aluguel } = await setup();
    expect(() => setAllocations(s, luz.id, [{ incomeId: salario.id, amount: "301" }], 1)).toThrow(/mais que o valor da despesa/);

    setAllocations(s, aluguel.id, [{ incomeId: freela.id, amount: "700" }], 1);
    expect(() => setAllocations(s, luz.id, [{ incomeId: freela.id, amount: "150" }], 1)).toThrow(/só tem R\$\s?100,00 disponível/);
    // Ao editar a própria despesa, o valor dela não conta como já comprometido.
    expect(() => setAllocations(s, aluguel.id, [{ incomeId: freela.id, amount: "800" }], 1)).not.toThrow();
    expect(incomeOptions(s, 1, luz.id).find(o => o.id === freela.id)?.available).toBe("0.00");
    expect(incomeOptions(s, 1, aluguel.id).find(o => o.id === freela.id)?.available).toBe("800.00");
  });

  it("só aceita despesa ↔ receita", async () => {
    const { s, salario, luz, freela } = await setup();
    expect(() => setAllocations(s, salario.id, [{ incomeId: freela.id, amount: "10" }], 1)).toThrow(/Só despesas/);
    expect(() => setAllocations(s, luz.id, [{ incomeId: luz.id, amount: "10" }], 1)).toThrow(/área de trabalho ativa/);
    expect(() => setAllocations(s, luz.id, [{ incomeId: salario.id, amount: "0" }], 1)).toThrow(/maior que zero/);
  });

  it("recusa receita que não é da mesma área (outro dono dos dados)", async () => {
    const { s, luz } = await setup();
    const alheia = s.insert("transactions", {
      userId: 2,
      competencyId: 1,
      type: "income",
      category: "X",
      description: "Salário de outra área",
      amount: "1000.00",
      transactionDate: new Date(2026, 2, 5),
    });
    expect(() => setAllocations(s, luz.id, [{ incomeId: alheia.id, amount: "10" }], 1)).toThrow(
      /área de trabalho ativa/
    );
    expect(incomeOptions(s, 1).some(o => o.id === alheia.id)).toBe(false);
  });

  it("limpa vínculos ao excluir ou trocar o tipo do lançamento", async () => {
    const { s, salario, luz, aluguel } = await setup();
    setAllocations(s, luz.id, [{ incomeId: salario.id, amount: "300" }], 1);
    setAllocations(s, aluguel.id, [{ incomeId: salario.id, amount: "100" }], 1);

    removeAllocationsOf(s, luz.id);
    expect(s.select("incomeAllocations").map(a => a.expenseId)).toEqual([aluguel.id]);

    s.update("transactions", t => t.id === aluguel.id, { type: "income" });
    cleanupAllocationsAfterUpdate(s, aluguel.id);
    expect(s.select("incomeAllocations")).toHaveLength(0);
  });
});
