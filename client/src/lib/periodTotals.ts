/**
 * Totais de entradas e saídas por dia e por período (hoje, semana, mês, ano),
 * usados nos cards totalizadores e no calendário do dashboard.
 *
 * Entradas = receitas. Saídas = despesas + compras no cartão, na data do
 * lançamento (mesmo critério da tela de calendário).
 */
import { endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from "date-fns";

export type DayTotals = { income: number; expense: number; count: number };

type TxLike = { type: string; amount: string | number; transactionDate: Date | string };

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Soma por dia (chave YYYY-MM-DD no fuso local). */
export function dailyTotals(transactions: readonly TxLike[]): Map<string, DayTotals> {
  const byDay = new Map<string, DayTotals>();
  for (const t of transactions) {
    const date = new Date(t.transactionDate);
    if (Number.isNaN(date.getTime())) continue;
    const amount = typeof t.amount === "number" ? t.amount : parseFloat(t.amount) || 0;
    const key = dateKey(date);
    const day = byDay.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "income") day.income += amount;
    else day.expense += amount;
    day.count += 1;
    byDay.set(key, day);
  }
  return byDay;
}

export type PeriodId = "today" | "week" | "month" | "year";
export type Period = { id: PeriodId; start: Date; end: Date };

/** Semana de domingo a sábado, como no calendário. */
export function periodRanges(now: Date): Period[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [
    { id: "today", start: today, end: today },
    { id: "week", start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) },
    { id: "month", start: startOfMonth(today), end: endOfMonth(today) },
    { id: "year", start: startOfYear(today), end: endOfYear(today) },
  ];
}

/** Anos que precisam ser carregados para cobrir os períodos (a semana pode virar o ano). */
export function yearsFor(periods: readonly Period[]): number[] {
  const years = new Set<number>();
  for (const p of periods) {
    years.add(p.start.getFullYear());
    years.add(p.end.getFullYear());
  }
  return Array.from(years).sort((a, b) => a - b);
}

/** Soma os dias entre start e end (inclusive). */
export function sumRange(byDay: Map<string, DayTotals>, start: Date, end: Date): DayTotals {
  const from = dateKey(start);
  const to = dateKey(end);
  const total: DayTotals = { income: 0, expense: 0, count: 0 };
  byDay.forEach((day, key) => {
    if (key >= from && key <= to) {
      total.income += day.income;
      total.expense += day.expense;
      total.count += day.count;
    }
  });
  return total;
}

const compact0 = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
const compact1 = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Valor curto para células estreitas do calendário: 81352,70 → "81,4 mil";
 * com `digits = 0`, "81 mil". Valores abaixo de mil ficam inteiros.
 */
export function formatCompact(value: number, digits: 0 | 1 = 1) {
  return (digits === 0 ? compact0 : compact1).format(Math.round(value));
}
