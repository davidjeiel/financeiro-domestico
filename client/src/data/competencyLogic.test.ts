import { describe, it, expect } from "vitest";
import {
  getCompetencyForTransaction,
  calculateInvoiceDates,
  calculateInvoiceTotal,
  formatCurrency,
  formatDate,
  getMonthName,
  getCompetencyName,
  calculateCompetencySummary,
  groupTransactionsByCategory,
  calculateCategoryTotals,
} from "./competencyLogic";
import { CreditCard, Transaction } from "./schema";

describe("competencyLogic", () => {
  describe("getCompetencyForTransaction", () => {
    it("should return current month for cash transaction", () => {
      const date = new Date(2026, 2, 15); // March 15, 2026
      const result = getCompetencyForTransaction(date, null);
      expect(result).toEqual({ year: 2026, month: 3 });
    });

    it("should return current month if before cutoff day", () => {
      const creditCard: CreditCard = {
        id: 1,
        userId: 1,
        name: "Test Card",
        lastDigits: "1234",
        cutoffDay: 20,
        dueDay: 5,
        limit: "5000",
        color: "#3B82F6",
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const date = new Date(2026, 2, 15); // March 15, before cutoff day 20
      const result = getCompetencyForTransaction(date, creditCard);
      expect(result).toEqual({ year: 2026, month: 3 });
    });

    it("should return next month if on or after cutoff day", () => {
      const creditCard: CreditCard = {
        id: 1,
        userId: 1,
        name: "Test Card",
        lastDigits: "1234",
        cutoffDay: 20,
        dueDay: 5,
        limit: "5000",
        color: "#3B82F6",
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const date = new Date(2026, 2, 20); // March 20, on cutoff day
      const result = getCompetencyForTransaction(date, creditCard);
      expect(result).toEqual({ year: 2026, month: 4 });
    });

    it("should handle year rollover for cutoff", () => {
      const creditCard: CreditCard = {
        id: 1,
        userId: 1,
        name: "Test Card",
        lastDigits: "1234",
        cutoffDay: 20,
        dueDay: 5,
        limit: "5000",
        color: "#3B82F6",
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const date = new Date(2026, 11, 25); // December 25, after cutoff day
      const result = getCompetencyForTransaction(date, creditCard);
      expect(result).toEqual({ year: 2027, month: 1 });
    });
  });

  describe("calculateInvoiceDates", () => {
    it("should calculate correct closing and due dates", () => {
      const creditCard: CreditCard = {
        id: 1,
        userId: 1,
        name: "Test Card",
        lastDigits: "1234",
        cutoffDay: 10,
        dueDay: 25,
        limit: "5000",
        color: "#3B82F6",
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = calculateInvoiceDates(creditCard, 2026, 3);
      expect(result.closingDate).toEqual(new Date(2026, 2, 10));
      expect(result.dueDate).toEqual(new Date(2026, 3, 25));
    });
  });

  describe("calculateInvoiceTotal", () => {
    it("should sum all transaction amounts", () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          userId: 1,
          competencyId: 1,
          creditCardId: 1,
          type: "credit_card",
          category: "Food",
          description: "Lunch",
          amount: "50.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          competencyId: 1,
          creditCardId: 1,
          type: "credit_card",
          category: "Transport",
          description: "Uber",
          amount: "25.50",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const total = calculateInvoiceTotal(transactions);
      expect(total).toBe(75.5);
    });
  });

  describe("formatCurrency", () => {
    it("should format number as BRL currency", () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain("R$");
      expect(result).toContain("1.234");
    });

    it("should format string as BRL currency", () => {
      const result = formatCurrency("1234.56");
      expect(result).toContain("R$");
    });
  });

  describe("formatDate", () => {
    it("should format date in pt-BR format", () => {
      const date = new Date(2026, 2, 15);
      const result = formatDate(date);
      expect(result).toMatch(/15\/03\/2026/);
    });


  });

  describe("getMonthName", () => {
    it("should return Portuguese month names", () => {
      expect(getMonthName(1)).toBe("Janeiro");
      expect(getMonthName(3)).toBe("Março");
      expect(getMonthName(12)).toBe("Dezembro");
    });
  });

  describe("getCompetencyName", () => {
    it("should return formatted competency name", () => {
      const result = getCompetencyName(2026, 3);
      expect(result).toBe("Março 2026");
    });
  });

  describe("calculateCompetencySummary", () => {
    it("should calculate income, expense, and credit card totals", () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "income",
          category: "Salary",
          description: "Monthly salary",
          amount: "5000.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Rent",
          description: "Monthly rent",
          amount: "1500.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          userId: 1,
          competencyId: 1,
          creditCardId: 1,
          type: "credit_card",
          category: "Food",
          description: "Groceries",
          amount: "500.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const summary = calculateCompetencySummary(transactions);
      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpense).toBe(1500);
      expect(summary.totalCreditCard).toBe(500);
      expect(summary.balance).toBe(3000);
    });
  });

  describe("groupTransactionsByCategory", () => {
    it("should group transactions by category", () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Food",
          description: "Lunch",
          amount: "50.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Food",
          description: "Dinner",
          amount: "80.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Transport",
          description: "Uber",
          amount: "25.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const grouped = groupTransactionsByCategory(transactions);
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped["Food"]).toHaveLength(2);
      expect(grouped["Transport"]).toHaveLength(1);
    });
  });

  describe("calculateCategoryTotals", () => {
    it("should calculate totals by category", () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Food",
          description: "Lunch",
          amount: "50.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          competencyId: 1,
          creditCardId: null,
          type: "expense",
          category: "Food",
          description: "Dinner",
          amount: "80.00",
          transactionDate: new Date(),
          dueDate: null,
          installments: 1,
          currentInstallment: 1,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const totals = calculateCategoryTotals(transactions);
      expect(totals["Food"]).toBe(130);
    });
  });
});
