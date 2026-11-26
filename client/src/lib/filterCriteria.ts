/**
 * Critérios de filtro de lançamentos — os mesmos para o painel de filtros da
 * tela de Lançamentos, para os filtros salvos e para a página Filtros.
 */

export type TxType = "income" | "expense" | "credit_card";
const TX_TYPES: TxType[] = ["income", "expense", "credit_card"];

export type FilterCriteria = {
  /** Trecho da descrição (sem diferenciar maiúsculas nem acentos). */
  description?: string;
  type?: TxType;
  types?: TxType[];
  category?: string;
  categories?: string[];
  /** Um cartão (string, vindo de um select) ou vários. */
  creditCardId?: string;
  creditCardIds?: number[];
  minAmount?: number;
  maxAmount?: number;
};

type FilterableTx = {
  description?: string | null;
  type: string;
  category?: string | null;
  creditCardId?: number | null;
  amount: string | number;
};

/** Minúsculas, sem acentos e sem espaços sobrando. */
export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesDescription(description: string | null | undefined, query: string | undefined) {
  const q = normalizeText(query);
  return !q || normalizeText(description).includes(q);
}

const nonEmpty = <T,>(list: T[] | undefined): list is T[] => !!list && list.length > 0;
const isNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Tipos, categorias e cartões escolhidos, juntando a forma única e a lista. */
export function selectedTypes(c: FilterCriteria): TxType[] {
  return nonEmpty(c.types) ? c.types : c.type ? [c.type] : [];
}
export function selectedCategories(c: FilterCriteria): string[] {
  return nonEmpty(c.categories) ? c.categories : c.category ? [c.category] : [];
}
export function selectedCardIds(c: FilterCriteria): number[] {
  if (nonEmpty(c.creditCardIds)) return c.creditCardIds;
  const single = Number(c.creditCardId);
  return c.creditCardId && Number.isInteger(single) ? [single] : [];
}

export function applyFilterCriteria<T extends FilterableTx>(transactions: T[], c: FilterCriteria): T[] {
  const types = selectedTypes(c);
  const categories = selectedCategories(c);
  const cardIds = selectedCardIds(c);
  return transactions.filter(t => {
    if (!matchesDescription(t.description, c.description)) return false;
    if (types.length && !types.includes(t.type as TxType)) return false;
    if (categories.length && !categories.includes(t.category ?? "")) return false;
    if (cardIds.length && (t.creditCardId == null || !cardIds.includes(t.creditCardId))) return false;
    const amount = Math.abs(Number(t.amount));
    if (isNumber(c.minAmount) && amount < c.minAmount) return false;
    if (isNumber(c.maxAmount) && amount > c.maxAmount) return false;
    return true;
  });
}

/** Quantos critérios estão realmente preenchidos. */
export function countCriteria(c: FilterCriteria) {
  return [
    normalizeText(c.description) ? 1 : 0,
    selectedTypes(c).length ? 1 : 0,
    selectedCategories(c).length ? 1 : 0,
    selectedCardIds(c).length ? 1 : 0,
    isNumber(c.minAmount) || isNumber(c.maxAmount) ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

/** Remove campos vazios (para salvar e comparar). */
export function compactCriteria(c: FilterCriteria): FilterCriteria {
  const out: FilterCriteria = {};
  const description = c.description?.trim();
  if (description) out.description = description;
  const types = selectedTypes(c);
  if (types.length === 1) out.type = types[0];
  else if (types.length > 1) out.types = types;
  const categories = selectedCategories(c);
  if (categories.length === 1) out.category = categories[0];
  else if (categories.length > 1) out.categories = categories;
  const cards = selectedCardIds(c);
  if (cards.length === 1) out.creditCardId = String(cards[0]);
  else if (cards.length > 1) out.creditCardIds = cards;
  if (isNumber(c.minAmount)) out.minAmount = c.minAmount;
  if (isNumber(c.maxAmount)) out.maxAmount = c.maxAmount;
  return out;
}

// ─── Filtros salvos (linha da planilha FiltrosSalvos) ───────────────────────

export type SavedFilterRow = {
  id: number;
  name: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  description?: string | null;
  categories?: string | null;
  types?: string | null;
  creditCardIds?: string | null;
  minAmount?: string | number | null;
  maxAmount?: string | number | null;
  isDefault?: number | boolean | null;
};

export type SavedFilterInput = {
  name: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  categories?: string[];
  types?: TxType[];
  creditCardIds?: number[];
  minAmount?: number;
  maxAmount?: number;
  isDefault?: boolean;
};

function parseList<T>(raw: string | null | undefined, valid: (v: unknown) => v is T): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

/** Data salva → "YYYY-MM-DD" no fuso local (sem pular um dia por causa do UTC). */
export function toLocalDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toNumber = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Filtro salvo → datas + critérios para aplicar na tela de Lançamentos. */
export function savedFilterToState(row: SavedFilterRow) {
  return {
    startDate: toLocalDateInput(row.startDate),
    endDate: toLocalDateInput(row.endDate),
    criteria: compactCriteria({
      description: row.description ?? undefined,
      types: parseList(row.types, (v): v is TxType => TX_TYPES.includes(v as TxType)),
      categories: parseList(row.categories, (v): v is string => typeof v === "string" && v !== ""),
      creditCardIds: parseList(row.creditCardIds, (v): v is number => Number.isInteger(v)),
      minAmount: toNumber(row.minAmount),
      maxAmount: toNumber(row.maxAmount),
    }),
  };
}

/** Datas + critérios atuais → dados para gravar o filtro. */
export function stateToSavedFilter(
  name: string,
  dates: { startDate?: string; endDate?: string },
  criteria: FilterCriteria
): SavedFilterInput {
  const c = compactCriteria(criteria);
  const types = selectedTypes(c);
  const categories = selectedCategories(c);
  const cards = selectedCardIds(c);
  return {
    name: name.trim(),
    startDate: dates.startDate || undefined,
    endDate: dates.endDate || undefined,
    description: c.description,
    types: types.length ? types : undefined,
    categories: categories.length ? categories : undefined,
    creditCardIds: cards.length ? cards : undefined,
    minAmount: c.minAmount,
    maxAmount: c.maxAmount,
  };
}

const TYPE_NAMES: Record<TxType, string> = { income: "Receita", expense: "Despesa", credit_card: "Cartão" };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Resumo legível dos critérios ("Descrição contém "mercado" · Despesa"). */
export function describeCriteria(c: FilterCriteria, cardName?: (id: number) => string | undefined): string[] {
  const parts: string[] = [];
  if (normalizeText(c.description)) parts.push(`Descrição contém "${c.description!.trim()}"`);
  const types = selectedTypes(c);
  if (types.length) parts.push(types.map(t => TYPE_NAMES[t]).join(", "));
  const categories = selectedCategories(c);
  if (categories.length) parts.push(`Categoria: ${categories.join(", ")}`);
  const cards = selectedCardIds(c);
  if (cards.length) parts.push(`Cartão: ${cards.map(id => cardName?.(id) ?? `#${id}`).join(", ")}`);
  if (isNumber(c.minAmount) && isNumber(c.maxAmount)) parts.push(`De ${brl(c.minAmount)} a ${brl(c.maxAmount)}`);
  else if (isNumber(c.minAmount)) parts.push(`A partir de ${brl(c.minAmount)}`);
  else if (isNumber(c.maxAmount)) parts.push(`Até ${brl(c.maxAmount)}`);
  return parts;
}
