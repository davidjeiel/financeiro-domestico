/**
 * Avaliador de expressões da calculadora do campo de valor (sem `eval`).
 *
 * Aceita números com vírgula ou ponto decimal, + − × ÷ (ou + - * /),
 * parênteses, sinal negativo e porcentagem ("200 + 10%" = 220,
 * "200 × 10%" = 20, "50%" = 0,5).
 */

type Token = { kind: "num"; value: number } | { kind: "op"; value: string };

const OPS = new Set(["+", "-", "*", "/", "(", ")", "%"]);

function normalize(expr: string) {
  return expr
    .replace(/[×xX]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, "");
}

function tokenize(input: string): Token[] {
  const s = normalize(input);
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      // "1.234,56" → 1234.56 ; "1,5" → 1.5 ; "1.5" → 1.5
      const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
      const normalized =
        lastSep === -1
          ? raw
          : raw.slice(0, lastSep).replace(/[.,]/g, "") + "." + raw.slice(lastSep + 1);
      const value = Number(normalized);
      if (!Number.isFinite(value)) throw new Error("Número inválido");
      tokens.push({ kind: "num", value });
      i = j;
    } else if (OPS.has(c)) {
      tokens.push({ kind: "op", value: c });
      i++;
    } else {
      throw new Error(`Caractere inválido: ${c}`);
    }
  }
  return tokens;
}

/** Calcula a expressão. Lança erro se ela for inválida ou incompleta. */
export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error("Expressão vazia");
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.kind === "op" && peek()!.value === v;

  // expr := term (('+'|'-') term)*   — "a ± b%" vale a ± a·b/100
  function parseExpr(): number {
    let left = parseTerm();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { value: string }).value;
      const { value, percent } = parseTermWithPercent();
      const right = percent ? (left * value) / 100 : value;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTermWithPercent(): { value: number; percent: boolean } {
    const start = pos;
    const value = parseUnary();
    const next = tokens[pos + 1];
    const followedByMulDiv = next?.kind === "op" && (next.value === "*" || next.value === "/");
    if (isOp("%") && !followedByMulDiv) {
      pos++;
      return { value, percent: true };
    }
    pos = start;
    return { value: parseTerm(), percent: false };
  }

  // term := factor (('*'|'/') factor)*
  function parseTerm(): number {
    let left = parsePostfix();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = parsePostfix();
      if (op === "/" && right === 0) throw new Error("Divisão por zero");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  // postfix := unary '%'?
  function parsePostfix(): number {
    let value = parseUnary();
    while (isOp("%")) {
      pos++;
      value = value / 100;
    }
    return value;
  }

  // unary := ('-'|'+') unary | primary
  function parseUnary(): number {
    if (isOp("-")) {
      pos++;
      return -parseUnary();
    }
    if (isOp("+")) {
      pos++;
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = peek();
    if (!t) throw new Error("Expressão incompleta");
    if (t.kind === "num") {
      pos++;
      return t.value;
    }
    if (t.value === "(") {
      pos++;
      const value = parseExpr();
      if (!isOp(")")) throw new Error("Falta fechar parênteses");
      pos++;
      return value;
    }
    throw new Error("Expressão incompleta");
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Expressão inválida");
  if (!Number.isFinite(result)) throw new Error("Resultado inválido");
  return result;
}

/** Tenta calcular; devolve `null` se a expressão ainda não estiver completa. */
export function tryEvaluate(expr: string): number | null {
  try {
    return evaluateExpression(expr);
  } catch {
    return null;
  }
}

/** Arredonda para centavos (evita 0.1 + 0.2 = 0.30000000000000004). */
export const roundCents = (value: number) => Math.round(value * 100) / 100;
