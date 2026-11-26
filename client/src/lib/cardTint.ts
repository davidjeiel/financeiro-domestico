/**
 * Cor do cartão esmaecida para o fundo das linhas de cartão em Lançamentos.
 */

const FALLBACK = "#3B82F6";

/** "#abc" | "#aabbcc" → [r, g, b]; cor inválida usa o azul padrão dos cartões. */
export function parseHexColor(color: string | null | undefined): [number, number, number] {
  const raw = (color ?? "").trim().replace(/^#/, "");
  const hex = /^[0-9a-f]{3}$/i.test(raw)
    ? raw.split("").map(c => c + c).join("")
    : /^[0-9a-f]{6}$/i.test(raw)
      ? raw
      : FALLBACK.slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function withAlpha(color: string | null | undefined, alpha: number) {
  const [r, g, b] = parseHexColor(color);
  const a = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Variáveis CSS da linha: fundo, fundo no hover e a faixa lateral.
 * A linha da fatura fica um pouco mais forte que as compras dentro dela.
 */
export function cardRowStyle(color: string | null | undefined, level: "invoice" | "purchase") {
  const base = level === "invoice" ? 0.16 : 0.08;
  return {
    "--row-tint": withAlpha(color, base),
    "--row-tint-hover": withAlpha(color, base + 0.08),
    "--row-accent": withAlpha(color, 0.9),
  } as React.CSSProperties;
}

/** Classes que usam as variáveis de cardRowStyle. */
export const CARD_ROW_CLASS =
  "bg-[var(--row-tint)] hover:bg-[var(--row-tint-hover)] [&>td:first-child]:shadow-[inset_3px_0_0_var(--row-accent)]";
