/**
 * Visão da tela de lançamentos: pela competência (como o app sempre fez — o
 * cartão entra no mês da fatura) ou mensal, pelo mês da data de cada lançamento.
 * A última escolha fica salva no navegador.
 */
export type ViewMode = "competency" | "monthly";

const VIEW_MODE_KEY = "transactionsViewMode";

export function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === "monthly" ? "monthly" : "competency";
  } catch {
    return "competency";
  }
}

export function saveViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // sem armazenamento: a escolha vale só nesta visita
  }
}

/** Primeiro e último dia do mês (1–12), no formato YYYY-MM-DD. */
export function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}
