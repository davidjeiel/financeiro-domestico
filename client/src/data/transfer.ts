/**
 * Transferência de lançamentos entre áreas de trabalho.
 *
 * Cada área é uma planilha com seus próprios ids, então transferir é
 * recriar o lançamento na planilha de destino (com as referências
 * traduzidas). Ao **mover**, ele é removido da origem; ao **copiar**, a
 * origem fica como está:
 *
 * - competência: no cartão, a mesma (ano/mês) da fatura; nos demais, a
 *   competência da data pelo período configurado no destino; criada se faltar;
 * - categoria: o mesmo nome; a categoria é criada no destino se faltar;
 * - cartão: um cartão do destino escolhido pelo usuário, ou uma cópia do
 *   cartão de origem criada no destino (padrão: o de mesmo nome);
 * - responsável: a pessoa de mesmo e-mail no destino (ou, sem e-mail, de
 *   mesmo nome); sem correspondente, fica sem responsável;
 * - vínculos com receitas: não vão para o destino; ao mover, são removidos
 *   da origem (ao copiar, continuam lá);
 * - faturas dos cartões afetados são recalculadas no destino (e, ao mover,
 *   na origem);
 * - recorrências: com `seriesScope`, vão também as outras ocorrências da série
 *   (as seguintes ou todas) e a regra, que passa a gerar no destino. Ao mover
 *   a série toda, a regra sai da origem; ao mover "desta em diante", a regra
 *   da origem termina no dia anterior.
 *
 * Funções puras sobre os stores, para testar sem sessão.
 */
import type { SheetStore } from "./sheetStore";
import type { CreditCard, RecurrenceRule, Transaction, User } from "./schema";
import { competencyName, competencyStartDayOf, recalcInvoice } from "./db";
import { competencyOfDate } from "./competencyLogic";
import { removeAllocationsOf } from "./allocations";
import { occurrenceKey, skipOccurrence } from "./recurrences";

/** Para cada cartão de origem: id de um cartão do destino ou "new" (criar cópia). */
export type CardMap = Record<string, number | "new">;

/** "move" tira os lançamentos da origem; "copy" mantém a origem como está. */
export type TransferMode = "move" | "copy";

/**
 * Lançamentos recorrentes selecionados: "selected" leva só eles; "following",
 * também as ocorrências seguintes da série; "all", a série inteira.
 */
export type SeriesScope = "selected" | "following" | "all";

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/**
 * Acrescenta à seleção as outras ocorrências das séries. Devolve os ids e, por
 * série, a partir de qual data ela vai (null = desde o início).
 */
export function expandSeriesSelection(
  source: SheetStore,
  sourceOwnerId: number,
  ids: number[],
  scope: SeriesScope
) {
  const selected = source.select("transactions", t => ids.includes(t.id) && t.userId === sourceOwnerId);
  const from = new Map<string, string | null>();
  for (const t of selected) {
    if (!t.recurrenceGroup || scope === "selected") continue;
    const key = scope === "all" ? null : occurrenceKey(t);
    const prev = from.get(t.recurrenceGroup);
    from.set(t.recurrenceGroup, prev === undefined ? key : prev === null || key === null ? null : prev < key ? prev : key);
  }
  const all = new Set(ids);
  from.forEach((key, group) => {
    source
      .select("transactions", t => t.userId === sourceOwnerId && t.recurrenceGroup === group)
      .filter(t => key === null || occurrenceKey(t) >= key)
      .forEach(t => all.add(t.id));
  });
  return { ids: Array.from(all), seriesFrom: from };
}

/** Quantos lançamentos cada opção leva (para a pergunta ao usuário). */
export function seriesTransferCounts(source: SheetStore, sourceOwnerId: number, ids: number[]) {
  const recurring = source.select(
    "transactions",
    t => ids.includes(t.id) && t.userId === sourceOwnerId && !!t.recurrenceGroup
  ).length;
  return {
    recurringSelected: recurring,
    selected: ids.length,
    following: expandSeriesSelection(source, sourceOwnerId, ids, "following").ids.length,
    all: expandSeriesSelection(source, sourceOwnerId, ids, "all").ids.length,
  };
}

function selectTransactions(source: SheetStore, sourceOwnerId: number, ids: number[]) {
  const wanted = new Set(ids);
  const txs = source.select("transactions", t => wanted.has(t.id) && t.userId === sourceOwnerId);
  if (txs.length !== wanted.size) {
    throw new Error("Alguns lançamentos não foram encontrados nesta área. Recarregue e tente de novo.");
  }
  return txs;
}

/** Cartão de mesmo nome no destino, se houver. */
function sameNameCard(target: SheetStore, targetOwnerId: number, card: CreditCard) {
  return target.find(
    "creditCards",
    c => c.userId === targetOwnerId && c.isActive === 1 && norm(c.name) === norm(card.name)
  );
}

function matchPerson(target: SheetStore, person: User | null): number | null {
  if (!person) return null;
  const candidates = target.select("users", u => u.status !== "removed");
  const byEmail = person.email && candidates.find(u => norm(u.email) === norm(person.email));
  if (byEmail) return byEmail.id;
  if (!person.email && person.name) {
    const byName = candidates.find(u => !u.email && norm(u.name) === norm(person.name));
    if (byName) return byName.id;
  }
  return null;
}

export type TransferPreview = {
  count: number;
  /** Cartões de origem usados pelos lançamentos, com a sugestão no destino. */
  cards: { sourceCardId: number; name: string; suggested: number | "new" }[];
  /** Cartões ativos do destino, para escolher. */
  targetCards: { id: number; name: string }[];
  /** Vínculos com receitas que serão desfeitos. */
  allocationsRemoved: number;
  /** Lançamentos cujo responsável não existe no destino (ficarão sem). */
  responsiblesUnmatched: number;
  /** Quantos lançamentos cada opção de série leva. */
  series: ReturnType<typeof seriesTransferCounts>;
};

export function previewTransfer(
  source: SheetStore,
  target: SheetStore,
  opts: { ids: number[]; sourceOwnerId: number; targetOwnerId: number; seriesScope?: SeriesScope }
): TransferPreview {
  const series = seriesTransferCounts(source, opts.sourceOwnerId, opts.ids);
  const expanded = expandSeriesSelection(source, opts.sourceOwnerId, opts.ids, opts.seriesScope ?? "selected").ids;
  const txs = selectTransactions(source, opts.sourceOwnerId, expanded);
  const ids = new Set(txs.map(t => t.id));
  const cardIds = Array.from(
    new Set(txs.filter(t => t.type === "credit_card" && t.creditCardId).map(t => t.creditCardId!))
  );
  const cards = cardIds.map(id => {
    const card = source.find("creditCards", c => c.id === id);
    const match = card ? sameNameCard(target, opts.targetOwnerId, card) : null;
    return { sourceCardId: id, name: card?.name ?? `Cartão ${id}`, suggested: match?.id ?? ("new" as const) };
  });
  const usersById = new Map(source.select("users").map(u => [u.id, u]));
  return {
    count: txs.length,
    cards,
    targetCards: target
      .select("creditCards", c => c.userId === opts.targetOwnerId && c.isActive === 1)
      .map(c => ({ id: c.id, name: c.name })),
    allocationsRemoved: source.select(
      "incomeAllocations",
      a => ids.has(a.expenseId) || ids.has(a.incomeId)
    ).length,
    responsiblesUnmatched: txs.filter(
      t =>
        t.responsibleUserId != null &&
        matchPerson(target, usersById.get(t.responsibleUserId) ?? null) === null
    ).length,
    series,
  };
}

/**
 * Recria os lançamentos no destino e, ao mover, os remove da origem (em
 * memória; quem chama grava o destino primeiro e depois a origem).
 */
export function transferTransactions(
  source: SheetStore,
  target: SheetStore,
  opts: {
    ids: number[];
    sourceOwnerId: number;
    targetOwnerId: number;
    /** Quem está transferindo, na aba Usuarios do destino. */
    actorTargetUserId: number;
    cardMap?: CardMap;
    /** Padrão: mover. */
    mode?: TransferMode;
    /** Padrão: só os selecionados. */
    seriesScope?: SeriesScope;
  }
) {
  const mode: TransferMode = opts.mode ?? "move";
  const { ids: expandedIds, seriesFrom } = expandSeriesSelection(
    source,
    opts.sourceOwnerId,
    opts.ids,
    opts.seriesScope ?? "selected"
  );
  const txs = selectTransactions(source, opts.sourceOwnerId, expandedIds);
  const usersById = new Map(source.select("users").map(u => [u.id, u]));

  const competencyIds = new Map<string, number>();
  const competencyIn = (year: number, month: number) => {
    const key = `${year}-${month}`;
    const cached = competencyIds.get(key);
    if (cached) return cached;
    const existing = target.find(
      "competencies",
      x => x.userId === opts.targetOwnerId && x.year === year && x.month === month
    );
    const id =
      existing?.id ??
      target.insert("competencies", {
        userId: opts.targetOwnerId,
        year,
        month,
        name: competencyName(year, month),
      }).id;
    competencyIds.set(key, id);
    return id;
  };
  // O destino pode ter outro dia de início da competência.
  const targetStartDay = competencyStartDayOf(target, opts.targetOwnerId);
  const targetCompetency = (t: Transaction) => {
    if (t.type !== "credit_card") {
      const { year, month } = competencyOfDate(t.transactionDate, targetStartDay);
      return competencyIn(year, month);
    }
    const c = source.find("competencies", x => x.id === t.competencyId);
    if (!c) throw new Error("Competência do lançamento não encontrada.");
    return competencyIn(c.year, c.month);
  };

  const cardIds = new Map<number, number>();
  const targetCard = (sourceCardId: number) => {
    const cached = cardIds.get(sourceCardId);
    if (cached) return cached;
    const card = source.find("creditCards", c => c.id === sourceCardId);
    if (!card) throw new Error("Cartão do lançamento não encontrado.");
    const choice = opts.cardMap?.[String(sourceCardId)] ?? sameNameCard(target, opts.targetOwnerId, card)?.id ?? "new";
    let id: number;
    if (choice === "new") {
      id = target.insert("creditCards", {
        userId: opts.targetOwnerId,
        name: card.name,
        lastDigits: card.lastDigits,
        cutoffDay: card.cutoffDay,
        dueDay: card.dueDay,
        limit: card.limit,
        color: card.color,
        isActive: 1,
      }).id;
    } else {
      const chosen = target.find("creditCards", c => c.id === choice && c.userId === opts.targetOwnerId);
      if (!chosen) throw new Error(`Escolha um cartão da área de destino para "${card.name}".`);
      id = chosen.id;
    }
    cardIds.set(sourceCardId, id);
    return id;
  };

  const ensureCategory = (t: Transaction) => {
    const exists = target.find(
      "typologies",
      x => x.userId === opts.targetOwnerId && x.type === t.type && norm(x.name) === norm(t.category)
    );
    if (exists) return;
    const original = source.find(
      "typologies",
      x => x.userId === opts.sourceOwnerId && x.type === t.type && norm(x.name) === norm(t.category)
    );
    target.insert("typologies", {
      userId: opts.targetOwnerId,
      name: t.category,
      type: t.type,
      icon: original?.icon ?? null,
      color: original?.color ?? null,
      isActive: 1,
      sortOrder: 99,
    });
  };

  const created: Transaction[] = [];
  const touchedTarget = new Set<string>();
  const touchedSource = new Set<string>();

  for (const t of txs) {
    ensureCategory(t);
    const competencyId = targetCompetency(t);
    const creditCardId = t.type === "credit_card" && t.creditCardId ? targetCard(t.creditCardId) : null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = t;
    created.push(
      target.insert("transactions", {
        ...rest,
        userId: opts.targetOwnerId,
        competencyId,
        creditCardId,
        responsibleUserId: matchPerson(target, usersById.get(t.responsibleUserId ?? -1) ?? null),
        createdBy: opts.actorTargetUserId,
      })
    );
    if (creditCardId) touchedTarget.add(`${creditCardId}:${competencyId}`);
    if (t.type === "credit_card" && t.creditCardId) touchedSource.add(`${t.creditCardId}:${t.competencyId}`);
  }

  touchedTarget.forEach(key => {
    const [card, comp] = key.split(":").map(Number);
    recalcInvoice(target, opts.targetOwnerId, card, comp);
  });

  // Regras das séries levadas: passam a gerar no destino.
  const rulesToSource: { rule: RecurrenceRule; fromKey: string | null }[] = [];
  seriesFrom.forEach((fromKey, groupKey) => {
    const rule = source.find("recurrenceRules", r => r.groupKey === groupKey && r.userId === opts.sourceOwnerId);
    if (!rule) return; // série antiga, sem regra: vão só os lançamentos
    rulesToSource.push({ rule, fromKey });
    if (target.find("recurrenceRules", r => r.groupKey === groupKey && r.userId === opts.targetOwnerId)) return;
    const fromDate = fromKey ? keyToDate(fromKey) : null;
    const startDate = fromDate && fromDate > rule.startDate ? fromDate : rule.startDate;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = rule;
    target.insert("recurrenceRules", {
      ...rest,
      userId: opts.targetOwnerId,
      startDate,
      creditCardId: rule.type === "credit_card" && rule.creditCardId ? targetCard(rule.creditCardId) : null,
      responsibleUserId: matchPerson(target, usersById.get(rule.responsibleUserId ?? -1) ?? null),
      skippedDates: skippedFrom(rule.skippedDates, fromKey),
      createdBy: opts.actorTargetUserId,
    });
  });

  // Cópia: a origem fica como está.
  if (mode === "copy") return { created, allocationsRemoved: 0, mode, rulesTransferred: rulesToSource.length };

  // Origem: remove os lançamentos e os vínculos deles.
  const ids = new Set(txs.map(t => t.id));
  // Ocorrências de recorrência: a regra da origem não deve recriá-las.
  txs.forEach(t => skipOccurrence(source, t));
  source.delete("transactions", t => ids.has(t.id));
  let allocationsRemoved = 0;
  ids.forEach(id => (allocationsRemoved += removeAllocationsOf(source, id)));

  touchedSource.forEach(key => {
    const [card, comp] = key.split(":").map(Number);
    recalcInvoice(source, opts.sourceOwnerId, card, comp);
  });

  // Origem: a série toda saiu → a regra sai; "desta em diante" → a regra
  // termina no dia anterior (as ocorrências anteriores ficam aqui).
  for (const { rule, fromKey } of rulesToSource) {
    if (fromKey === null) {
      source.delete("recurrenceRules", r => r.id === rule.id);
      continue;
    }
    const from = keyToDate(fromKey);
    const lastDay = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const end = rule.endDate && rule.endDate < lastDay ? rule.endDate : lastDay;
    source.update("recurrenceRules", r => r.id === rule.id, { endDate: end });
  }

  return { created, allocationsRemoved, mode, rulesTransferred: rulesToSource.length };
}

function keyToDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Datas puladas a partir de `fromKey` (null = todas). */
function skippedFrom(raw: string | null, fromKey: string | null) {
  if (!raw) return null;
  try {
    const list: string[] = JSON.parse(raw);
    const kept = fromKey ? list.filter(k => k >= fromKey) : list;
    return kept.length ? JSON.stringify(kept) : null;
  } catch {
    return null;
  }
}
