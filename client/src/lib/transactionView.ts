/**
 * Visão da tela de lançamentos: pela competência (como o app sempre fez — o
 * cartão entra no mês da fatura) ou mensal, pelo mês da data de cada lançamento.
 * A última escolha fica salva no navegador.
 */
export type ViewMode = "competency" | "monthly";

const VIEW_MODE_KEY = "transactionsViewMode";
/** Os relatórios guardam a própria escolha, separada da de Lançamentos. */
export const REPORTS_VIEW_MODE_KEY = "reportsViewMode";

export function readViewMode(key = VIEW_MODE_KEY): ViewMode {
  try {
    return localStorage.getItem(key) === "monthly" ? "monthly" : "competency";
  } catch {
    return "competency";
  }
}

export function saveViewMode(mode: ViewMode, key = VIEW_MODE_KEY) {
  try {
    localStorage.setItem(key, mode);
  } catch {
    // sem armazenamento: a escolha vale só nesta visita
  }
}

/** "30/11 a 29/12" — período da competência, quando não é o mês do calendário. */
export function competencyRangeLabel(
  competency: { periodStart?: Date | string | null; periodEnd?: Date | string | null } | null | undefined
): string | null {
  if (!competency?.periodStart || !competency.periodEnd) return null;
  const start = new Date(competency.periodStart);
  const end = new Date(competency.periodEnd);
  const isCalendarMonth =
    start.getDate() === 1 &&
    end.getMonth() === start.getMonth() &&
    new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getDate() === 1;
  if (isCalendarMonth) return null;
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} a ${fmt(end)}`;
}

/** Mês anterior/seguinte. */
export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Primeiro e último dia do mês (1–12), no formato YYYY-MM-DD. */
export function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}
