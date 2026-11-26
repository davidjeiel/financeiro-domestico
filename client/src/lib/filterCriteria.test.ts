import { describe, expect, it } from "vitest";
import {
  applyFilterCriteria,
  compactCriteria,
  countCriteria,
  describeCriteria,
  matchesDescription,
  savedFilterToState,
  stateToSavedFilter,
  toLocalDateInput,
} from "./filterCriteria";

const txs = [
  { id: 1, description: "Farmácia São João", type: "expense", category: "Saúde", creditCardId: null, amount: "89.90" },
  { id: 2, description: "Mercado Extra", type: "credit_card", category: "Alimentação", creditCardId: 1, amount: "420.50" },
  { id: 3, description: "Salário", type: "income", category: "Salário", creditCardId: null, amount: "5000.00" },
  { id: 4, description: "  MERCADO  livre ", type: "credit_card", category: "Compras", creditCardId: 2, amount: "130" },
  { id: 5, description: null, type: "expense", category: "Outros", creditCardId: null, amount: "10" },
];
const ids = (list: { id: number }[]) => list.map(t => t.id);

describe("descrição", () => {
  it("ignora maiúsculas, acentos e espaços", () => {
    expect(matchesDescription("Farmácia São João", "farmacia sao")).toBe(true);
    expect(ids(applyFilterCriteria(txs, { description: "  mercado " }))).toEqual([2, 4]);
    expect(ids(applyFilterCriteria(txs, { description: "mercado livre" }))).toEqual([4]);
  });
  it("vazia não filtra; sem descrição não casa com busca", () => {
    expect(ids(applyFilterCriteria(txs, { description: "   " }))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(applyFilterCriteria(txs, { description: "zzz" }))).toEqual([]);
  });
});

describe("demais critérios", () => {
  it("tipo único ou vários", () => {
    expect(ids(applyFilterCriteria(txs, { type: "income" }))).toEqual([3]);
    expect(ids(applyFilterCriteria(txs, { types: ["income", "expense"] }))).toEqual([1, 3, 5]);
  });
  it("categoria única ou várias", () => {
    expect(ids(applyFilterCriteria(txs, { category: "Saúde" }))).toEqual([1]);
    expect(ids(applyFilterCriteria(txs, { categories: ["Saúde", "Compras"] }))).toEqual([1, 4]);
  });
  it("cartão do select (string) ou vários", () => {
    expect(ids(applyFilterCriteria(txs, { creditCardId: "2" }))).toEqual([4]);
    expect(ids(applyFilterCriteria(txs, { creditCardIds: [1, 2] }))).toEqual([2, 4]);
  });
  it("faixa de valores (inclusiva)", () => {
    expect(ids(applyFilterCriteria(txs, { minAmount: 89.9, maxAmount: 420.5 }))).toEqual([1, 2, 4]);
    expect(ids(applyFilterCriteria(txs, { maxAmount: 100 }))).toEqual([1, 5]);
  });
  it("combina tudo", () => {
    expect(ids(applyFilterCriteria(txs, { description: "mercado", type: "credit_card", minAmount: 200 }))).toEqual([2]);
  });
  it("conta e compacta só o que está preenchido", () => {
    expect(countCriteria({ description: " ", types: [], creditCardIds: [] })).toBe(0);
    expect(countCriteria({ description: "a", minAmount: 1, maxAmount: 2 })).toBe(2);
    expect(compactCriteria({ description: " a ", types: ["expense"], categories: [], minAmount: undefined })).toEqual({
      description: "a",
      type: "expense",
    });
  });
});

describe("filtros salvos", () => {
  it("ida e volta preserva descrição e todos os critérios", () => {
    const input = stateToSavedFilter(
      " Mercado ",
      { startDate: "2026-11-01", endDate: "" },
      { description: "mercado", type: "credit_card", creditCardId: "1", minAmount: 50 }
    );
    expect(input).toEqual({
      name: "Mercado",
      startDate: "2026-11-01",
      endDate: undefined,
      description: "mercado",
      types: ["credit_card"],
      categories: undefined,
      creditCardIds: [1],
      minAmount: 50,
      maxAmount: undefined,
    });
    const row = {
      id: 1,
      name: input.name,
      startDate: new Date(2026, 10, 1),
      endDate: null,
      description: input.description,
      types: JSON.stringify(input.types),
      categories: null,
      creditCardIds: JSON.stringify(input.creditCardIds),
      minAmount: "50.00",
      maxAmount: null,
    };
    const state = savedFilterToState(row);
    expect(state.startDate).toBe("2026-11-01");
    expect(state.endDate).toBe("");
    expect(ids(applyFilterCriteria(txs, state.criteria))).toEqual([2]);
  });
  it("aguenta linhas antigas ou com JSON inválido", () => {
    const state = savedFilterToState({ id: 2, name: "x", types: "não é json", categories: '["Saúde"]' });
    expect(state.criteria).toEqual({ category: "Saúde" });
  });
  it("data no fuso local, sem voltar um dia", () => {
    expect(toLocalDateInput(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(toLocalDateInput("2026-03-05")).toBe("2026-03-05");
  });
  it("resumo legível", () => {
    expect(describeCriteria({ description: "mercado", types: ["expense", "credit_card"], maxAmount: 100 })).toEqual([
      'Descrição contém "mercado"',
      "Despesa, Cartão",
      "Até R$\u00a0100,00",
    ]);
  });
});
