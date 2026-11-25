import { describe, expect, it } from "vitest";
import { buildTransactionsUrl, parseTransactionsSearch, toColumnFilters } from "./transactionFilters";

describe("filtros dos lançamentos pela URL", () => {
  it("ida e volta", () => {
    const url = buildTransactionsUrl({ tipo: "expense", situacao: "aberto", categoria: "Saúde & bem-estar", visao: "monthly" });
    expect(url).toBe("/lancamentos?tipo=expense&situacao=aberto&categoria=Sa%C3%BAde+%26+bem-estar&visao=monthly");
    expect(parseTransactionsSearch(url.split("?")[1])).toEqual({
      tipo: "expense",
      situacao: "aberto",
      cartao: undefined,
      categoria: "Saúde & bem-estar",
      visao: "monthly",
      natureza: undefined,
    });
    expect(parseTransactionsSearch("natureza=fixa").natureza).toBe("fixa");
    expect(toColumnFilters({ natureza: "variavel", categoria: "Lazer" })).toEqual({ category: "Lazer", recurrence: "variavel" });
    expect(buildTransactionsUrl({})).toBe("/lancamentos");
  });

  it("ignora valores inválidos", () => {
    expect(parseTransactionsSearch("?tipo=xyz&situacao=talvez&cartao=abc")).toEqual({
      tipo: undefined, situacao: undefined, cartao: undefined, categoria: undefined, visao: undefined, natureza: undefined,
    });
  });

  it("situação vira 'pago' do lançamento ou situação da fatura no cartão", () => {
    expect(toColumnFilters({ tipo: "income", situacao: "pago" })).toEqual({ type: "income", isPaid: "1" });
    expect(toColumnFilters({ tipo: "expense", situacao: "aberto" })).toEqual({ type: "expense", isPaid: "0" });
    expect(toColumnFilters({ tipo: "credit_card", situacao: "aberto" })).toEqual({ type: "credit_card", invoiceStatus: "aberto" });
    expect(toColumnFilters({ cartao: 3 })).toEqual({ type: "credit_card", creditCardId: "3" });
  });
});
