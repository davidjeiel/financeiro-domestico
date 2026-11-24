import { describe, expect, it } from "vitest";
import { evaluateExpression, roundCents, tryEvaluate } from "./calculator";

describe("calculadora", () => {
  it("respeita precedência, parênteses e sinal", () => {
    expect(evaluateExpression("2 + 3 × 4")).toBe(14);
    expect(evaluateExpression("(2 + 3) * 4")).toBe(20);
    expect(evaluateExpression("-5 + 10")).toBe(5);
    expect(evaluateExpression("100 ÷ 4 − 5")).toBe(20);
  });

  it("aceita vírgula decimal e separador de milhar", () => {
    expect(evaluateExpression("10,50 + 1,25")).toBe(11.75);
    expect(evaluateExpression("1.234,56 + 0,44")).toBe(1235);
    expect(roundCents(evaluateExpression("0.1 + 0.2"))).toBe(0.3);
  });

  it("porcentagem como na calculadora do celular", () => {
    expect(evaluateExpression("200 + 10%")).toBe(220);
    expect(evaluateExpression("200 - 10%")).toBe(180);
    expect(evaluateExpression("200 × 10%")).toBe(20);
    expect(evaluateExpression("50%")).toBe(0.5);
  });

  it("recusa expressões inválidas", () => {
    expect(() => evaluateExpression("10 /")).toThrow();
    expect(() => evaluateExpression("10 / 0")).toThrow(/zero/);
    expect(() => evaluateExpression("(1 + 2")).toThrow(/parênteses/);
    expect(() => evaluateExpression("abc")).toThrow();
    expect(tryEvaluate("3 +")).toBeNull();
    expect(tryEvaluate("")).toBeNull();
  });
});
