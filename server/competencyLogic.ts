/**
 * Competency and Credit Card Logic
 * 
 * This module handles the business logic for:
 * 1. Determining which competency a transaction belongs to
 * 2. Calculating credit card invoices based on cutoff dates
 * 3. Allocating expenses to the correct billing period
 */

import { Transaction, CreditCard, Invoice } from "../drizzle/schema";

/**
 * Determine which competency a transaction belongs to based on its date
 * and the credit card's cutoff day (if applicable)
 * 
 * For credit card transactions:
 * - If transaction date is on or after the cutoff day, it belongs to the NEXT month
 * - If transaction date is before the cutoff day, it belongs to the CURRENT month
 * 
 * For cash transactions (income/expense):
 * - Always belongs to the month of the transaction date
 */
export function getCompetencyForTransaction(
  transactionDate: Date,
  creditCard: CreditCard | null
): { year: number; month: number } {
  const date = new Date(transactionDate);
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // 1-12

  if (creditCard) {
    const dayOfMonth = date.getDate();
    const cutoffDay = creditCard.cutoffDay;

    // If transaction is on or after cutoff day, it belongs to next month
    if (dayOfMonth >= cutoffDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return { year, month };
}

/**
 * Calculate invoice dates for a credit card based on competency
 * 
 * Returns:
 * - closingDate: The date when the statement closes (cutoff day)
 * - dueDate: The date when payment is due (dueDay)
 */
export function calculateInvoiceDates(
  creditCard: CreditCard,
  year: number,
  month: number
): { closingDate: Date; dueDate: Date } {
  // Closing date is the cutoff day of the month
  const closingDate = new Date(year, month - 1, creditCard.cutoffDay);

  // Due date is the dueDay of the NEXT month
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  const dueDate = new Date(dueYear, dueMonth - 1, creditCard.dueDay);

  return { closingDate, dueDate };
}

/**
 * Get all transactions that belong to a credit card invoice for a given competency
 */
export function getTransactionsForInvoice(
  transactions: Transaction[],
  creditCard: CreditCard,
  year: number,
  month: number
): Transaction[] {
  return transactions.filter(t => {
    if (t.creditCardId !== creditCard.id) return false;

    const competency = getCompetencyForTransaction(new Date(t.transactionDate), creditCard);
    return competency.year === year && competency.month === month;
  });
}

/**
 * Calculate total amount for an invoice
 */
export function calculateInvoiceTotal(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => {
    const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
    return sum + amount;
  }, 0);
}

/**
 * Format currency for display (Brazilian Real)
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

/**
 * Format date for display (Brazilian format)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Get month name in Portuguese
 */
export function getMonthName(month: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return months[month - 1] || "";
}

/**
 * Get competency name (e.g., "Janeiro 2026")
 */
export function getCompetencyName(year: number, month: number): string {
  return `${getMonthName(month)} ${year}`;
}

/**
 * Calculate summary statistics for a competency
 */
export interface CompetencySummary {
  totalIncome: number;
  totalExpense: number;
  totalCreditCard: number;
  balance: number;
}

export function calculateCompetencySummary(transactions: Transaction[]): CompetencySummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalCreditCard = 0;

  transactions.forEach(t => {
    const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;

    if (t.type === "income") {
      totalIncome += amount;
    } else if (t.type === "expense") {
      totalExpense += amount;
    } else if (t.type === "credit_card") {
      totalCreditCard += amount;
    }
  });

  const balance = totalIncome - totalExpense - totalCreditCard;

  return {
    totalIncome,
    totalExpense,
    totalCreditCard,
    balance,
  };
}

/**
 * Group transactions by category
 */
export function groupTransactionsByCategory(
  transactions: Transaction[]
): Record<string, Transaction[]> {
  const grouped: Record<string, Transaction[]> = {};

  transactions.forEach(t => {
    if (!grouped[t.category]) {
      grouped[t.category] = [];
    }
    grouped[t.category].push(t);
  });

  return grouped;
}

/**
 * Calculate category totals
 */
export function calculateCategoryTotals(
  transactions: Transaction[]
): Record<string, number> {
  const totals: Record<string, number> = {};

  transactions.forEach(t => {
    const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
    if (!totals[t.category]) {
      totals[t.category] = 0;
    }
    totals[t.category] += amount;
  });

  return totals;
}
