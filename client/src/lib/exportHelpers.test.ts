import { describe, it, expect } from "vitest";
import { prepareExportData, calculateCategoryDistribution } from "./exportHelpers";

describe("exportHelpers", () => {
  const mockTransactions = [
    {
      id: 1,
      transactionDate: new Date("2026-03-15"),
      description: "Salário",
      category: "Salário",
      type: "income" as const,
      amount: 5000,
      notes: "Salário mensal",
    },
    {
      id: 2,
      transactionDate: new Date("2026-03-10"),
      description: "Supermercado",
      category: "Alimentação",
      type: "expense" as const,
      amount: 250,
      notes: "Compras semanais",
    },
    {
      id: 3,
      transactionDate: new Date("2026-03-12"),
      description: "Restaurante",
      category: "Alimentação",
      type: "expense" as const,
      amount: 150,
      notes: "Almoço",
    },
    {
      id: 4,
      transactionDate: new Date("2026-03-08"),
      description: "Compra Online",
      category: "Compras",
      type: "credit_card" as const,
      amount: 300,
      notes: "Eletrônicos",
    },
  ];

  it("deve preparar dados para exportação corretamente", () => {
    const result = prepareExportData(
      mockTransactions,
      "Março/2026",
      2026,
      3
    );

    expect(result.competency.name).toBe("Março/2026");
    expect(result.competency.year).toBe(2026);
    expect(result.competency.month).toBe(3);
    expect(result.transactions).toHaveLength(4);
  });

  it("deve formatar datas corretamente", () => {
    const result = prepareExportData(
      mockTransactions,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].date).toBe("15/03/2026");
    expect(result.transactions[1].date).toBe("10/03/2026");
  });

  it("deve converter tipos de transação para labels", () => {
    const result = prepareExportData(
      mockTransactions,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].type).toBe("Receita");
    expect(result.transactions[1].type).toBe("Despesa");
    expect(result.transactions[3].type).toBe("Cartão de Crédito");
  });

  it("deve manter valores numéricos", () => {
    const result = prepareExportData(
      mockTransactions,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].amount).toBe(5000);
    expect(result.transactions[1].amount).toBe(250);
    expect(typeof result.transactions[0].amount).toBe("number");
  });

  it("deve substituir descrição vazia por hífen", () => {
    const transactionsWithEmpty = [
      {
        id: 1,
        transactionDate: new Date("2026-03-15"),
        description: undefined,
        category: "Teste",
        type: "income" as const,
        amount: 100,
      },
    ];

    const result = prepareExportData(
      transactionsWithEmpty,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].description).toBe("-");
  });

  it("deve manter notas quando presentes", () => {
    const result = prepareExportData(
      mockTransactions,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].notes).toBe("Salário mensal");
    expect(result.transactions[1].notes).toBe("Compras semanais");
  });

  it("deve substituir notas vazias por string vazia", () => {
    const transactionsWithoutNotes = [
      {
        id: 1,
        transactionDate: new Date("2026-03-15"),
        description: "Teste",
        category: "Teste",
        type: "income" as const,
        amount: 100,
      },
    ];

    const result = prepareExportData(
      transactionsWithoutNotes,
      "Março/2026",
      2026,
      3
    );

    expect(result.transactions[0].notes).toBe("");
  });
});
