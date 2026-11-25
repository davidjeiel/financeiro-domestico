/**
 * Filtros da tela de lançamentos passados pela URL (ex.: a partir dos cards
 * do dashboard): /lancamentos?tipo=expense&situacao=aberto
 */
import type { ViewMode } from "./transactionView";

export type TxType = "income" | "expense" | "credit_card";
export type PaymentStatus = "pago" | "aberto";

export type LinkFilters = {
  tipo?: TxType;
  situacao?: PaymentStatus;
  cartao?: number;
  categoria?: string;
  visao?: ViewMode;
  /** Despesas fixas (recorrentes) ou variáveis. */
  natureza?: "fixa" | "variavel";
};

const TYPES: TxType[] = ["income", "expense", "credit_card"];

export function buildTransactionsUrl(filters: LinkFilters) {
  const params = new URLSearchParams();
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.situacao) params.set("situacao", filters.situacao);
  if (filters.cartao != null) params.set("cartao", String(filters.cartao));
  if (filters.categoria) params.set("categoria", filters.categoria);
  if (filters.visao) params.set("visao", filters.visao);
  if (filters.natureza) params.set("natureza", filters.natureza);
  const query = params.toString();
  return `/lancamentos${query ? `?${query}` : ""}`;
}

export function parseTransactionsSearch(search: string): LinkFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tipo = params.get("tipo") as TxType | null;
  const situacao = params.get("situacao");
  const cartao = Number(params.get("cartao"));
  const visao = params.get("visao");
  const natureza = params.get("natureza");
  return {
    tipo: tipo && TYPES.includes(tipo) ? tipo : undefined,
    situacao: situacao === "pago" || situacao === "aberto" ? situacao : undefined,
    cartao: Number.isInteger(cartao) && cartao > 0 ? cartao : undefined,
    categoria: params.get("categoria") || undefined,
    visao: visao === "monthly" || visao === "competency" ? visao : undefined,
    natureza: natureza === "fixa" || natureza === "variavel" ? natureza : undefined,
  };
}

/**
 * Converte para os filtros de coluna da tela de lançamentos. Para receitas e
 * despesas a situação é o "pago" do lançamento; para o cartão, a situação da
 * fatura (o pagamento é feito na fatura).
 */
export function toColumnFilters(filters: LinkFilters): Record<string, string> {
  const columns: Record<string, string> = {};
  if (filters.tipo) columns.type = filters.tipo;
  if (filters.categoria) columns.category = filters.categoria;
  if (filters.natureza) columns.recurrence = filters.natureza;
  if (filters.cartao != null) {
    columns.creditCardId = String(filters.cartao);
    columns.type = "credit_card";
  }
  if (filters.situacao) {
    if (columns.type === "credit_card") columns.invoiceStatus = filters.situacao;
    else columns.isPaid = filters.situacao === "pago" ? "1" : "0";
  }
  return columns;
}
