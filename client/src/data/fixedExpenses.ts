/**
 * Despesas fixas × variáveis.
 *
 * Fixa = lançamento recorrente (criado como "Recorrente", ou marcado depois
 * como fixo): tem `recurrence` preenchido. Variável = todo o resto. Despesas
 * são os tipos "expense" e "credit_card"; o período é a competência.
 */
import type { SheetStore } from "./sheetStore";
import type { Transaction } from "./schema";
import { shiftCompetency } from "./competencyLogic";

const isExpense = (t: Transaction) => t.type === "expense" || t.type === "credit_card";
export const isFixed = (t: Pick<Transaction, "recurrence">) => !!t.recurrence;
const cents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100) || 0;
const toReais = (c: number) => c / 100;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function fixedVsVariableReport(
  s: SheetStore,
  ownerId: number,
  year: number,
  month: number,
  monthsBack = 6
) {
  const competencies = s.select("competencies", c => c.userId === ownerId);
  const compKey = (y: number, m: number) => `${y}-${m}`;
  const compIdsByKey = new Map<string, number[]>();
  for (const c of competencies) {
    const key = compKey(c.year, c.month);
    compIdsByKey.set(key, [...(compIdsByKey.get(key) ?? []), c.id]);
  }
  const txs = s.select("transactions", t => t.userId === ownerId);

  const months = Array.from({ length: monthsBack }, (_, i) => {
    const { year: y, month: m } = shiftCompetency(year, month, i - (monthsBack - 1));
    const ids = new Set(compIdsByKey.get(compKey(y, m)) ?? []);
    let fixed = 0, variable = 0, income = 0;
    for (const t of txs) {
      if (!ids.has(t.competencyId)) continue;
      if (t.type === "income") income += cents(t.amount);
      else if (isExpense(t)) isFixed(t) ? (fixed += cents(t.amount)) : (variable += cents(t.amount));
    }
    return {
      year: y,
      month: m,
      label: `${MONTHS[m - 1]}/${String(y).slice(2)}`,
      fixed: toReais(fixed),
      variable: toReais(variable),
      income: toReais(income),
    };
  });

  const currentIds = new Set(compIdsByKey.get(compKey(year, month)) ?? []);
  const currentExpenses = txs.filter(t => currentIds.has(t.competencyId) && isExpense(t));
  const byCategory = new Map<string, { fixed: number; variable: number }>();
  for (const t of currentExpenses) {
    const entry = byCategory.get(t.category) ?? { fixed: 0, variable: 0 };
    if (isFixed(t)) entry.fixed += cents(t.amount);
    else entry.variable += cents(t.amount);
    byCategory.set(t.category, entry);
  }

  return {
    months,
    current: months[months.length - 1],
    byCategory: Array.from(byCategory.entries())
      .map(([category, v]) => ({ category, fixed: toReais(v.fixed), variable: toReais(v.variable) }))
      .sort((a, b) => b.fixed + b.variable - (a.fixed + a.variable)),
    fixedItems: currentExpenses
      .filter(isFixed)
      .sort((a, b) => cents(b.amount) - cents(a.amount))
      .map(t => ({
        id: t.id,
        description: t.description || t.category,
        category: t.category,
        type: t.type,
        amount: Number(t.amount),
        recurrence: t.recurrence,
      })),
  };
}

export type RecurringSuggestion = {
  key: string;
  description: string;
  category: string;
  type: Transaction["type"];
  amount: number;
  months: number;
  ids: number[];
};

/**
 * Lançamentos antigos (sem a marca de recorrência) que parecem uma série:
 * mesma despesa — tipo, categoria, descrição, valor e cartão — em 3 ou mais
 * competências diferentes. Parcelas ficam de fora (não são fixas).
 */
export function suggestRecurringSeries(s: SheetStore, ownerId: number, minMonths = 3): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of s.select("transactions", t => t.userId === ownerId)) {
    if (!isExpense(t) || isFixed(t) || (t.installments ?? 1) > 1) continue;
    const key = [t.type, t.category.trim().toLowerCase(), (t.description ?? "").trim().toLowerCase(), cents(t.amount), t.creditCardId ?? ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return Array.from(groups.entries())
    .map(([key, items]) => ({ key, items, months: new Set(items.map(t => t.competencyId)).size }))
    .filter(g => g.months >= minMonths)
    .map(({ key, items, months }) => ({
      key,
      description: items[0].description || items[0].category,
      category: items[0].category,
      type: items[0].type,
      amount: Number(items[0].amount),
      months,
      ids: items.map(t => t.id),
    }))
    .sort((a, b) => b.amount * b.months - a.amount * a.months);
}
