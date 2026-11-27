/**
 * Visão de todas as áreas de trabalho: os lançamentos de um período em cada
 * planilha, lado a lado, só para leitura.
 *
 * O período segue as mesmas regras de Lançamentos, aplicadas em cada área:
 * - competência: a competência (ano/mês) da área — cada área pode ter o
 *   próprio dia de início; compras no cartão entram pela fatura;
 * - mensal: o mês do calendário pela data; no cartão, pelo vencimento da fatura.
 *
 * Funções puras sobre o store, para testar sem sessão.
 */
import type { SheetStore } from "./sheetStore";
import type { Transaction } from "./schema";
import { invoiceDueDateOf, monthOfTransaction } from "./db";

export type PeriodMode = "competency" | "monthly";

export function periodTransactionsOf(
  s: SheetStore,
  ownerId: number,
  year: number,
  month: number,
  mode: PeriodMode
): Transaction[] {
  const all = s.select("transactions", t => t.userId === ownerId);
  if (mode === "monthly") {
    return all.filter(t => {
      const d = (t.type === "credit_card" && invoiceDueDateOf(s, t)) || t.transactionDate;
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }
  const comp = s.find("competencies", c => c.userId === ownerId && c.year === year && c.month === month);
  return all.filter(t => {
    if (t.type === "credit_card" && t.creditCardId) {
      const m = monthOfTransaction(s, t);
      return !!m && m.year === year && m.month === month;
    }
    return !!comp && t.competencyId === comp.id;
  });
}

export type ConsolidatedRow = {
  /** Único entre as áreas. */
  key: string;
  id: number;
  workspaceId: string;
  transactionDate: Date;
  description: string;
  category: string;
  type: Transaction["type"];
  amount: number;
  isPaid: boolean;
  isEstimated: boolean;
  recurring: boolean;
  /** Vencimento: da fatura (cartão), do lançamento ou a própria data. */
  dueDate: Date;
  card: { name: string; color: string | null } | null;
  /** Situação da fatura, para compras no cartão. */
  invoiceStatus: "paid" | "partial" | "open" | null;
  responsible: string | null;
};

const cents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100) || 0;

/** Linhas e totais de uma área no período. */
export function consolidateWorkspace(
  s: SheetStore,
  ownerId: number,
  workspaceId: string,
  year: number,
  month: number,
  mode: PeriodMode
) {
  const txs = periodTransactionsOf(s, ownerId, year, month, mode);
  const cards = new Map(s.select("creditCards").map(c => [c.id, c]));
  const users = new Map(s.select("users").map(u => [u.id, u]));
  const totals = { income: 0, expense: 0, creditCard: 0 };

  const rows: ConsolidatedRow[] = txs.map(t => {
    const amount = cents(t.amount);
    if (t.type === "income") totals.income += amount;
    else if (t.type === "expense") totals.expense += amount;
    else totals.creditCard += amount;

    const card = t.type === "credit_card" && t.creditCardId ? cards.get(t.creditCardId) : undefined;
    let invoiceStatus: ConsolidatedRow["invoiceStatus"] = null;
    if (card) {
      const inv = s.find("invoices", i => i.creditCardId === card.id && i.competencyId === t.competencyId);
      const total = cents(inv?.totalAmount);
      const paid = cents(inv?.paidAmount);
      invoiceStatus = inv && total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "open";
    }
    return {
      key: `${workspaceId}:${t.id}`,
      id: t.id,
      workspaceId,
      transactionDate: t.transactionDate,
      description: t.description || t.category,
      category: t.category,
      type: t.type,
      amount: amount / 100,
      isPaid: !!t.isPaid,
      isEstimated: !!t.isEstimated,
      recurring: !!t.recurrence,
      dueDate: (card && invoiceDueDateOf(s, t)) || t.dueDate || t.transactionDate,
      card: card ? { name: card.name, color: card.color } : null,
      invoiceStatus,
      responsible: t.responsibleUserId != null ? users.get(t.responsibleUserId)?.name ?? null : null,
    };
  });

  return {
    rows,
    totals: {
      income: totals.income / 100,
      expense: totals.expense / 100,
      creditCard: totals.creditCard / 100,
      balance: (totals.income - totals.expense - totals.creditCard) / 100,
    },
  };
}
