/**
 * Competency and Credit Card Logic
 * 
 * This module handles the business logic for:
 * 1. Determining which competency a transaction belongs to
 * 2. Calculating credit card invoices based on cutoff dates
 * 3. Allocating expenses to the correct billing period
 */

import { Transaction, CreditCard, Invoice } from "./schema";

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annual";

export function filterTransactionsByDateRange<T extends Pick<Transaction, "transactionDate">>(
  transactions: T[],
  startDate?: string,
  endDate?: string
): T[] {
  return transactions.filter(transaction => {
    const date = transaction.transactionDate.toISOString().slice(0, 10);
    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
}

export function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  frequency: RecurrenceFrequency
): Date[] {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    throw new RangeError("A data limite deve ser igual ou posterior à data inicial.");
  }

  const dayStep =
    frequency === "daily" ? 1 : frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : null;
  const monthStep =
    frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : frequency === "annual" ? 12 : null;
  const dates: Date[] = [];

  for (let occurrence = 0; ; occurrence++) {
    let date: Date;
    if (dayStep !== null) {
      date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + occurrence * dayStep
      );
    } else if (monthStep !== null) {
      const monthIndex =
        start.getFullYear() * 12 + start.getMonth() + occurrence * monthStep;
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const day = Math.min(start.getDate(), new Date(year, month + 1, 0).getDate());
      date = new Date(year, month, day);
    } else {
      throw new Error(`Frequência recorrente inválida: ${frequency}`);
    }

    if (date > end) break;
    dates.push(date);
  }

  return dates;
}

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
  creditCard: Pick<CreditCard, "cutoffDay" | "dueDay">,
  year: number,
  month: number
): { closingDate: Date; dueDate: Date } {
  const clampDay = (y: number, m0: number, day: number) =>
    new Date(y, m0, Math.min(day, new Date(y, m0 + 1, 0).getDate()));

  // A competência é o mês em que a fatura fecha.
  const closingDate = clampDay(year, month - 1, creditCard.cutoffDay);

  // O vencimento é o próximo dia `dueDay` depois do fechamento: no mesmo mês
  // quando vence depois do dia de fechamento (fecha 18, vence 25), ou no mês
  // seguinte quando vence antes (fecha 28, vence 5).
  const sameMonth = creditCard.dueDay > creditCard.cutoffDay;
  const dueIndex = year * 12 + (month - 1) + (sameMonth ? 0 : 1);
  const dueDate = clampDay(Math.floor(dueIndex / 12), dueIndex % 12, creditCard.dueDay);

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

// ─── Parcelamento ────────────────────────────────────────────────────────────

/**
 * Divide um valor (em centavos) em `count` parcelas. A diferença de
 * arredondamento vai para a primeira parcela, como fazem os cartões.
 */
export function splitInstallmentCents(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("Número de parcelas inválido.");
  const base = Math.floor(totalCents / count);
  const parts = Array<number>(count).fill(base);
  parts[0] += totalCents - base * count;
  return parts;
}

/** Soma meses a uma data, sem pular mês quando o dia não existe (31/01 + 1 → 28/02). */
export function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Avança `months` meses a partir de uma competência (mês 1–12). */
export function shiftCompetency(year: number, month: number, months: number) {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// ─── Período da competência ──────────────────────────────────────────────────
//
// A competência pode começar num dia diferente do dia 1 (ex.: quem recebe no
// dia 30). Ela vai do dia inicial até a véspera do dia inicial do mês seguinte
// e leva o nome do mês em que começa: com início no dia 30, "Novembro" vai de
// 30/11 a 29/12. Em meses mais curtos o início cai no último dia do mês
// (início 30 → 28/02), sem buracos nem sobreposição entre competências.

/** Dia inicial válido (1–31); qualquer outro valor vira 1 (mês do calendário). */
export function normalizeStartDay(day: unknown): number {
  const n = Number(day);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 1;
}

/** Último dia da competência, para exibir (0 = último dia do mês, como no cadastro). */
export function competencyEndDayFor(startDay: number): number {
  const start = normalizeStartDay(startDay);
  return start === 1 ? 0 : start - 1;
}

/** Primeiro dia da competência ano/mês (mês 1–12). */
export function competencyStartDate(year: number, month: number, startDay: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(normalizeStartDay(startDay), daysInMonth));
}

/** Intervalo de datas (inclusivo, à meia-noite local) da competência ano/mês. */
export function competencyPeriod(
  year: number,
  month: number,
  startDay: number
): { start: Date; end: Date } {
  const start = competencyStartDate(year, month, startDay);
  const next = shiftCompetency(year, month, 1);
  const nextStart = competencyStartDate(next.year, next.month, startDay);
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1);
  return { start, end };
}

/** Competência (ano/mês) a que uma data pertence. */
export function competencyOfDate(date: Date, startDay: number): { year: number; month: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = competencyStartDate(year, month, startDay);
  return date.getDate() >= start.getDate() ? { year, month } : shiftCompetency(year, month, -1);
}
