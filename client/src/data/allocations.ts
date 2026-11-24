/**
 * Vínculos entre despesas e receitas: "esta conta sai do salário de março".
 *
 * Uma despesa (ou compra no cartão) pode ser paga por uma ou mais receitas,
 * informando quanto sai de cada uma. Cada receita mostra quanto já está
 * comprometido e quanto ainda sobra.
 *
 * As funções recebem o store para poderem ser testadas sem sessão.
 */
import type { SheetStore } from "./sheetStore";
import type { Transaction } from "./schema";

export type AllocationInput = { incomeId: number; amount: string | number };

/** Valores em centavos, para somar sem erro de ponto flutuante. */
export const toCents = (value: string | number | null | undefined) =>
  Math.round(Number(String(value ?? 0).replace(",", ".")) * 100) || 0;
const fromCents = (cents: number) => (cents / 100).toFixed(2);

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isExpense = (t: Transaction) => t.type === "expense" || t.type === "credit_card";

function label(t: Transaction) {
  const date = t.transactionDate instanceof Date ? t.transactionDate.toLocaleDateString("pt-BR") : "";
  return `${t.description || t.category}${date ? ` (${date})` : ""}`;
}

/** Total vinculado por lançamento: numa despesa, quanto está coberto; numa receita, quanto está comprometido. */
export function allocationTotals(s: SheetStore) {
  const totals = new Map<number, number>();
  for (const a of s.select("incomeAllocations")) {
    const cents = toCents(a.amount);
    totals.set(a.expenseId, (totals.get(a.expenseId) ?? 0) + cents);
    totals.set(a.incomeId, (totals.get(a.incomeId) ?? 0) + cents);
  }
  return totals;
}

/** Valida e junta vínculos repetidos para a mesma receita. Lança erro com mensagem para o usuário. */
export function validateAllocations(
  s: SheetStore,
  expenseId: number,
  links: AllocationInput[]
): { incomeId: number; cents: number }[] {
  const expense = s.find("transactions", t => t.id === expenseId);
  if (!expense) throw new Error("Lançamento não encontrado.");
  if (!isExpense(expense)) {
    throw new Error("Só despesas e compras no cartão podem ser vinculadas a receitas.");
  }

  const merged = new Map<number, number>();
  for (const link of links) {
    const cents = toCents(link.amount);
    if (cents <= 0) throw new Error("Informe um valor maior que zero em cada receita vinculada.");
    merged.set(link.incomeId, (merged.get(link.incomeId) ?? 0) + cents);
  }

  const expenseCents = toCents(expense.amount);
  const total = Array.from(merged.values()).reduce((sum, c) => sum + c, 0);
  if (total > expenseCents) {
    throw new Error(
      `Os vínculos somam ${brl(total)}, mais que o valor da despesa (${brl(expenseCents)}).`
    );
  }

  // Quanto de cada receita já está comprometido com *outras* despesas.
  const committedElsewhere = new Map<number, number>();
  for (const a of s.select("incomeAllocations", a => a.expenseId !== expenseId)) {
    committedElsewhere.set(a.incomeId, (committedElsewhere.get(a.incomeId) ?? 0) + toCents(a.amount));
  }

  for (const [incomeId, cents] of Array.from(merged.entries())) {
    const income = s.find("transactions", t => t.id === incomeId);
    if (!income || income.type !== "income") {
      throw new Error("Escolha uma receita válida para o vínculo.");
    }
    const available = toCents(income.amount) - (committedElsewhere.get(incomeId) ?? 0);
    if (cents > available) {
      throw new Error(
        `A receita "${label(income)}" só tem ${brl(Math.max(available, 0))} disponível.`
      );
    }
  }

  return Array.from(merged.entries()).map(([incomeId, cents]) => ({ incomeId, cents }));
}

/** Substitui todos os vínculos de uma despesa (gravado no próximo commit). */
export function setAllocations(
  s: SheetStore,
  expenseId: number,
  links: AllocationInput[],
  createdBy: number | null
) {
  const valid = validateAllocations(s, expenseId, links);
  s.delete("incomeAllocations", a => a.expenseId === expenseId);
  return valid.map(({ incomeId, cents }) =>
    s.insert("incomeAllocations", { expenseId, incomeId, amount: fromCents(cents), createdBy })
  );
}

/** Remove os vínculos em que o lançamento aparece (ao excluir ou mudar de tipo). */
export function removeAllocationsOf(s: SheetStore, transactionId: number) {
  return s.delete(
    "incomeAllocations",
    a => a.expenseId === transactionId || a.incomeId === transactionId
  );
}

/** Depois de editar um lançamento: apaga vínculos que deixaram de fazer sentido pelo tipo. */
export function cleanupAllocationsAfterUpdate(s: SheetStore, transactionId: number) {
  const t = s.find("transactions", x => x.id === transactionId);
  if (!t) return removeAllocationsOf(s, transactionId);
  return s.delete("incomeAllocations", a =>
    t.type === "income" ? a.expenseId === transactionId : a.incomeId === transactionId
  );
}

export type IncomeOption = {
  id: number;
  description: string;
  category: string;
  transactionDate: Date;
  amount: string;
  committed: string;
  available: string;
};

/**
 * Receitas que podem pagar despesas, com o saldo disponível. Ao editar uma
 * despesa, os vínculos dela não contam como comprometidos (vão ser substituídos).
 */
export function incomeOptions(s: SheetStore, dataUserId: number, expenseId?: number): IncomeOption[] {
  const committed = new Map<number, number>();
  for (const a of s.select("incomeAllocations", a => a.expenseId !== expenseId)) {
    committed.set(a.incomeId, (committed.get(a.incomeId) ?? 0) + toCents(a.amount));
  }
  return s
    .select("transactions", t => t.userId === dataUserId && t.type === "income")
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
    .map(t => {
      const used = committed.get(t.id) ?? 0;
      return {
        id: t.id,
        description: t.description || t.category,
        category: t.category,
        transactionDate: t.transactionDate,
        amount: t.amount,
        committed: fromCents(used),
        available: fromCents(toCents(t.amount) - used),
      };
    });
}

export type AllocationDetail = {
  id: number;
  amount: string;
  /** O outro lado do vínculo: a receita (para despesas) ou a despesa (para receitas). */
  counterpart: {
    id: number;
    type: Transaction["type"];
    description: string;
    transactionDate: Date;
    amount: string;
    isPaid: number;
  } | null;
};

/** Vínculos de um lançamento, com o resumo do saldo. */
export function allocationsOf(s: SheetStore, transactionId: number) {
  const t = s.find("transactions", x => x.id === transactionId);
  if (!t) return null;
  const asIncome = t.type === "income";
  const rows = s.select("incomeAllocations", a =>
    asIncome ? a.incomeId === transactionId : a.expenseId === transactionId
  );
  const links: AllocationDetail[] = rows.map(a => {
    const other = s.find("transactions", x => x.id === (asIncome ? a.expenseId : a.incomeId));
    return {
      id: a.id,
      amount: a.amount,
      counterpart: other
        ? {
            id: other.id,
            type: other.type,
            description: other.description || other.category,
            transactionDate: other.transactionDate,
            amount: other.amount,
            isPaid: other.isPaid,
          }
        : null,
    };
  });
  const linked = rows.reduce((sum, a) => sum + toCents(a.amount), 0);
  return {
    role: asIncome ? ("income" as const) : ("expense" as const),
    amount: t.amount,
    linked: fromCents(linked),
    remaining: fromCents(toCents(t.amount) - linked),
    links,
  };
}
