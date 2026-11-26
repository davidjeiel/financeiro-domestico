/**
 * Lançamentos fixos/recorrentes sem data final.
 *
 * Em vez de gravar todas as ocorrências de uma vez (o que exigia data final),
 * a planilha guarda a **regra** (aba Recorrencias) e o app gera as ocorrências
 * só até o fim do mês seguinte (1 mês de antecedência). Cada ocorrência é um
 * lançamento normal, marcado com a série (recurrenceGroup) e a data da
 * ocorrência (recurrenceDate) — a chave que impede gerar duas vezes.
 *
 * Quando a regra diz que o valor varia, as ocorrências nascem como
 * "estimadas" (isEstimated = 1) até o usuário confirmar o valor real.
 *
 * Funções sobre o store, para testar sem sessão.
 */
import type { SheetStore } from "./sheetStore";
import type { RecurrenceRule, Transaction, TransactionType } from "./schema";
import { generateRecurringDates, getCompetencyForTransaction, type RecurrenceFrequency } from "./competencyLogic";
import { ensureCompetency, newRecurrenceGroup, recalcInvoice } from "./db";

/** Meses de antecedência com que as ocorrências são geradas. */
export const HORIZON_MONTHS = 1;

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Último dia do mês seguinte a `today` (até onde as ocorrências são geradas). */
export function horizonEnd(today: Date) {
  return new Date(today.getFullYear(), today.getMonth() + 1 + HORIZON_MONTHS, 0);
}

const skippedOf = (rule: RecurrenceRule): string[] => {
  try {
    return rule.skippedDates ? JSON.parse(rule.skippedDates) : [];
  } catch {
    return [];
  }
};

export type RuleInput = {
  type: TransactionType;
  category: string;
  description?: string;
  amount: string;
  creditCardId?: number | null;
  responsibleUserId?: number | null;
  notes?: string;
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date | null;
  variableAmount?: boolean;
};

export function createRule(s: SheetStore, ownerId: number, data: RuleInput, createdBy: number | null) {
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error("A data limite deve ser igual ou posterior à data inicial.");
  }
  if (data.type === "credit_card") {
    const card = data.creditCardId
      ? s.find("creditCards", c => c.id === data.creditCardId && c.userId === ownerId && c.isActive === 1)
      : null;
    if (!card) throw new Error("Selecione um cartão de crédito ativo.");
  }
  return s.insert("recurrenceRules", {
    userId: ownerId,
    groupKey: newRecurrenceGroup(),
    type: data.type,
    category: data.category,
    description: data.description ?? "",
    amount: Number(data.amount).toFixed(2),
    creditCardId: data.type === "credit_card" ? data.creditCardId ?? null : null,
    responsibleUserId: data.responsibleUserId ?? null,
    notes: data.notes ?? "",
    frequency: data.frequency,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    variableAmount: data.variableAmount === false ? 0 : 1,
    skippedDates: null,
    createdBy,
  });
}

/**
 * Gera as ocorrências que faltam até o horizonte e remove duplicadas (duas
 * pessoas gerando ao mesmo tempo numa área compartilhada). Grava no commit.
 */
export function materializeRecurrences(s: SheetStore, ownerId: number, today = new Date()) {
  const limit = horizonEnd(today);
  const rules = s.select("recurrenceRules", r => r.userId === ownerId);
  const created: Transaction[] = [];
  const touchedInvoices = new Set<string>();
  let duplicatesRemoved = 0;

  for (const rule of rules) {
    const occurrences = s.select(
      "transactions",
      t => t.userId === ownerId && t.recurrenceGroup === rule.groupKey
    );

    // Duplicadas: fica a paga, depois a confirmada, depois a mais antiga.
    const byDate = new Map<string, Transaction[]>();
    for (const t of occurrences) {
      if (!t.recurrenceDate) continue;
      byDate.set(t.recurrenceDate, [...(byDate.get(t.recurrenceDate) ?? []), t]);
    }
    byDate.forEach(list => {
      if (list.length < 2) return;
      const keep = [...list].sort(
        (a, b) => b.isPaid - a.isPaid || a.isEstimated - b.isEstimated || a.id - b.id
      )[0];
      for (const t of list) {
        if (t.id === keep.id) continue;
        s.delete("transactions", x => x.id === t.id);
        if (t.creditCardId) touchedInvoices.add(`${t.creditCardId}:${t.competencyId}`);
        duplicatesRemoved++;
      }
    });

    const end = rule.endDate && rule.endDate < limit ? rule.endDate : limit;
    if (end < rule.startDate) continue;
    const skipped = new Set(skippedOf(rule));
    const card = rule.creditCardId ? s.find("creditCards", c => c.id === rule.creditCardId) : null;
    if (rule.type === "credit_card" && !card) continue;

    for (const date of generateRecurringDates(rule.startDate, end, rule.frequency as RecurrenceFrequency)) {
      const key = dateKey(date);
      if (skipped.has(key) || byDate.has(key)) continue;
      const { year, month } = getCompetencyForTransaction(date, card);
      const competencyId = ensureCompetency(s, ownerId, year, month);
      created.push(
        s.insert("transactions", {
          userId: ownerId,
          competencyId,
          creditCardId: card?.id ?? null,
          type: rule.type,
          category: rule.category,
          description: rule.description ?? "",
          amount: rule.amount,
          transactionDate: date,
          notes: rule.notes ?? "",
          responsibleUserId: rule.responsibleUserId,
          createdBy: rule.createdBy,
          recurrence: rule.frequency,
          recurrenceGroup: rule.groupKey,
          recurrenceDate: key,
          isEstimated: rule.variableAmount ? 1 : 0,
        })
      );
      if (card) touchedInvoices.add(`${card.id}:${competencyId}`);
    }
  }

  touchedInvoices.forEach(k => {
    const [card, comp] = k.split(":").map(Number);
    recalcInvoice(s, ownerId, card, comp);
  });
  return { created, duplicatesRemoved };
}

export function ruleOfTransaction(s: SheetStore, t: Pick<Transaction, "recurrenceGroup" | "userId">) {
  if (!t.recurrenceGroup) return null;
  return s.find("recurrenceRules", r => r.groupKey === t.recurrenceGroup && r.userId === t.userId);
}

/** Ao excluir uma ocorrência: anota a data para a regra não gerá-la de novo. */
export function skipOccurrence(s: SheetStore, t: Transaction) {
  const rule = ruleOfTransaction(s, t);
  if (!rule || !t.recurrenceDate) return;
  const skipped = new Set(skippedOf(rule));
  skipped.add(t.recurrenceDate);
  s.update("recurrenceRules", r => r.id === rule.id, { skippedDates: JSON.stringify(Array.from(skipped).sort()) });
}

/**
 * "Alterar a partir deste mês": muda a regra e as ocorrências futuras ainda
 * não pagas (data igual ou posterior à desta ocorrência).
 */
export function applyFromOccurrence(
  s: SheetStore,
  transactionId: number,
  changes: { amount?: string; description?: string; category?: string; responsibleUserId?: number | null }
) {
  const t = s.find("transactions", x => x.id === transactionId);
  if (!t) throw new Error("Lançamento não encontrado.");
  const rule = ruleOfTransaction(s, t);
  if (!rule) throw new Error("Este lançamento não faz parte de uma recorrência.");
  const from = t.recurrenceDate ?? dateKey(t.transactionDate);
  const patch = {
    amount: changes.amount !== undefined ? Number(changes.amount).toFixed(2) : undefined,
    description: changes.description,
    category: changes.category,
    responsibleUserId: changes.responsibleUserId,
  };
  s.update("recurrenceRules", r => r.id === rule.id, patch);
  const touched = new Set<string>();
  const updated = s.update(
    "transactions",
    x =>
      x.recurrenceGroup === rule.groupKey &&
      x.userId === rule.userId &&
      x.id !== t.id &&
      !x.isPaid &&
      (x.recurrenceDate ?? dateKey(x.transactionDate)) > from,
    // As futuras continuam estimadas (se a regra varia): o valor real vem na confirmação.
    patch
  );
  s.select("transactions", x => x.recurrenceGroup === rule.groupKey && !!x.creditCardId).forEach(x =>
    touched.add(`${x.creditCardId}:${x.competencyId}`)
  );
  touched.forEach(k => {
    const [card, comp] = k.split(":").map(Number);
    recalcInvoice(s, rule.userId, card, comp);
  });
  return { updated };
}

/**
 * Encerra a recorrência depois de uma data: a regra deixa de gerar e as
 * ocorrências futuras ainda não pagas são removidas.
 */
export function endRecurrence(s: SheetStore, groupKey: string, ownerId: number, lastDate: Date) {
  const rule = s.find("recurrenceRules", r => r.groupKey === groupKey && r.userId === ownerId);
  if (!rule) throw new Error("Recorrência não encontrada.");
  const last = dateKey(lastDate);
  s.update("recurrenceRules", r => r.id === rule.id, { endDate: lastDate });
  const doomed = s.select(
    "transactions",
    t => t.recurrenceGroup === groupKey && t.userId === ownerId && !t.isPaid && (t.recurrenceDate ?? dateKey(t.transactionDate)) > last
  );
  const ids = new Set(doomed.map(t => t.id));
  s.delete("transactions", t => ids.has(t.id));
  s.delete("incomeAllocations", a => ids.has(a.expenseId) || ids.has(a.incomeId));
  new Set(doomed.filter(t => t.creditCardId).map(t => `${t.creditCardId}:${t.competencyId}`)).forEach(k => {
    const [card, comp] = k.split(":").map(Number);
    recalcInvoice(s, ownerId, card, comp);
  });
  return { removed: doomed.length };
}

/**
 * Séries antigas (criadas com data final, sem regra): cria a regra a partir
 * da última ocorrência, sem data final, para que continuem sendo geradas.
 */
export function continueSeries(s: SheetStore, ownerId: number, groupKey: string, createdBy: number | null) {
  if (s.find("recurrenceRules", r => r.groupKey === groupKey && r.userId === ownerId)) {
    throw new Error("Esta série já continua automaticamente.");
  }
  const items = s
    .select("transactions", t => t.userId === ownerId && t.recurrenceGroup === groupKey)
    .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
  if (items.length === 0) throw new Error("Série não encontrada.");
  // Marca as ocorrências existentes com a data, para não duplicá-las.
  for (const t of items) {
    if (!t.recurrenceDate) s.update("transactions", x => x.id === t.id, { recurrenceDate: dateKey(t.transactionDate) });
  }
  const first = items[0];
  const last = items[items.length - 1];
  return s.insert("recurrenceRules", {
    userId: ownerId,
    groupKey,
    type: last.type,
    category: last.category,
    description: last.description ?? "",
    amount: Number(last.amount).toFixed(2),
    creditCardId: last.creditCardId,
    responsibleUserId: last.responsibleUserId,
    notes: last.notes ?? "",
    frequency: last.recurrence || "monthly",
    startDate: first.transactionDate,
    endDate: null,
    variableAmount: 1,
    skippedDates: null,
    createdBy,
  });
}

/** Regras e séries antigas da área, para a tela de Fixos. */
export function listRecurrences(s: SheetStore, ownerId: number, today = new Date()) {
  const all = s.select("transactions", t => t.userId === ownerId && !!t.recurrenceGroup);
  const byGroup = new Map<string, Transaction[]>();
  for (const t of all) byGroup.set(t.recurrenceGroup!, [...(byGroup.get(t.recurrenceGroup!) ?? []), t]);
  const todayKey = dateKey(today);

  const rules = s.select("recurrenceRules", r => r.userId === ownerId).map(rule => {
    const items = (byGroup.get(rule.groupKey) ?? []).sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
    );
    byGroup.delete(rule.groupKey);
    const next = items.find(t => dateKey(t.transactionDate) >= todayKey) ?? null;
    const ended = !!rule.endDate && dateKey(rule.endDate) < todayKey;
    return {
      kind: "rule" as const,
      groupKey: rule.groupKey,
      description: rule.description || rule.category,
      category: rule.category,
      type: rule.type,
      amount: Number(rule.amount),
      frequency: rule.frequency,
      startDate: rule.startDate,
      endDate: rule.endDate,
      variableAmount: rule.variableAmount === 1,
      ended,
      count: items.length,
      nextDate: next?.transactionDate ?? null,
      pendingConfirmation: items.filter(t => t.isEstimated === 1).length,
    };
  });

  const legacy = Array.from(byGroup.entries()).map(([groupKey, items]) => {
    const sorted = items.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    const last = sorted[sorted.length - 1];
    return {
      kind: "legacy" as const,
      groupKey,
      description: last.description || last.category,
      category: last.category,
      type: last.type,
      amount: Number(last.amount),
      frequency: last.recurrence ?? "monthly",
      startDate: sorted[0].transactionDate,
      endDate: last.transactionDate,
      variableAmount: false,
      ended: dateKey(last.transactionDate) < todayKey,
      count: sorted.length,
      nextDate: null as Date | null,
      pendingConfirmation: 0,
    };
  });

  return [...rules, ...legacy].sort(
    (a, b) => Number(a.ended) - Number(b.ended) || a.description.localeCompare(b.description, "pt-BR")
  );
}
