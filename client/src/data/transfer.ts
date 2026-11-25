/**
 * Transferência de lançamentos entre áreas de trabalho.
 *
 * Cada área é uma planilha com seus próprios ids, então transferir é
 * recriar o lançamento na planilha de destino (com as referências
 * traduzidas) e removê-lo da origem:
 *
 * - competência: a mesma (ano/mês), criada no destino se faltar;
 * - categoria: o mesmo nome; a categoria é criada no destino se faltar;
 * - cartão: um cartão do destino escolhido pelo usuário, ou uma cópia do
 *   cartão de origem criada no destino (padrão: o de mesmo nome);
 * - responsável: a pessoa de mesmo e-mail no destino (ou, sem e-mail, de
 *   mesmo nome); sem correspondente, fica sem responsável;
 * - vínculos com receitas: removidos (as receitas ficam na origem);
 * - faturas dos cartões afetados são recalculadas nos dois lados.
 *
 * Funções puras sobre os stores, para testar sem sessão.
 */
import type { SheetStore } from "./sheetStore";
import type { CreditCard, Transaction, User } from "./schema";
import { competencyName, recalcInvoice } from "./db";
import { removeAllocationsOf } from "./allocations";

/** Para cada cartão de origem: id de um cartão do destino ou "new" (criar cópia). */
export type CardMap = Record<string, number | "new">;

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

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
};

export function previewTransfer(
  source: SheetStore,
  target: SheetStore,
  opts: { ids: number[]; sourceOwnerId: number; targetOwnerId: number }
): TransferPreview {
  const txs = selectTransactions(source, opts.sourceOwnerId, opts.ids);
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
  };
}

/**
 * Recria os lançamentos no destino e os remove da origem (em memória; quem
 * chama grava o destino primeiro e depois a origem).
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
  }
) {
  const txs = selectTransactions(source, opts.sourceOwnerId, opts.ids);
  const usersById = new Map(source.select("users").map(u => [u.id, u]));

  const competencyIds = new Map<number, number>();
  const targetCompetency = (sourceCompetencyId: number) => {
    const cached = competencyIds.get(sourceCompetencyId);
    if (cached) return cached;
    const c = source.find("competencies", x => x.id === sourceCompetencyId);
    if (!c) throw new Error("Competência do lançamento não encontrada.");
    const existing = target.find(
      "competencies",
      x => x.userId === opts.targetOwnerId && x.year === c.year && x.month === c.month
    );
    const id =
      existing?.id ??
      target.insert("competencies", {
        userId: opts.targetOwnerId,
        year: c.year,
        month: c.month,
        name: competencyName(c.year, c.month),
      }).id;
    competencyIds.set(sourceCompetencyId, id);
    return id;
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
    const competencyId = targetCompetency(t.competencyId);
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

  // Origem: remove os lançamentos e os vínculos deles.
  const ids = new Set(txs.map(t => t.id));
  source.delete("transactions", t => ids.has(t.id));
  let allocationsRemoved = 0;
  ids.forEach(id => (allocationsRemoved += removeAllocationsOf(source, id)));

  touchedTarget.forEach(key => {
    const [card, comp] = key.split(":").map(Number);
    recalcInvoice(target, opts.targetOwnerId, card, comp);
  });
  touchedSource.forEach(key => {
    const [card, comp] = key.split(":").map(Number);
    recalcInvoice(source, opts.sourceOwnerId, card, comp);
  });

  return { created, allocationsRemoved };
}
