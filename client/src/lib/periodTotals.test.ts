import { describe, expect, it } from "vitest";
import { dailyTotals, dateKey, formatCompact, periodRanges, sumRange, yearsFor } from "./periodTotals";

const tx = (type: string, amount: string, date: Date) => ({ type, amount, transactionDate: date });

describe("dailyTotals", () => {
  it("separa entradas (receitas) de saídas (despesas e cartão) por dia", () => {
    const byDay = dailyTotals([
      tx("income", "5000", new Date(2026, 10, 25, 10)),
      tx("expense", "100.50", new Date(2026, 10, 25, 18)),
      tx("credit_card", "20", new Date(2026, 10, 25)),
      tx("expense", "7", new Date(2026, 10, 26)),
    ]);
    expect(byDay.get("2026-11-25")).toEqual({ income: 5000, expense: 120.5, count: 3 });
    expect(byDay.get("2026-11-26")).toEqual({ income: 0, expense: 7, count: 1 });
  });

  it("ignora datas inválidas", () => {
    expect(dailyTotals([tx("income", "1", new Date("x"))]).size).toBe(0);
  });
});

describe("periodRanges", () => {
  it("usa semana de domingo a sábado e mês/ano completos", () => {
    const [today, week, month, year] = periodRanges(new Date(2026, 10, 25, 19, 15));
    expect(dateKey(today.start)).toBe("2026-11-25");
    expect(dateKey(week.start)).toBe("2026-11-22");
    expect(dateKey(week.end)).toBe("2026-11-28");
    expect(dateKey(month.start)).toBe("2026-11-01");
    expect(dateKey(month.end)).toBe("2026-11-30");
    expect(dateKey(year.start)).toBe("2026-01-01");
    expect(dateKey(year.end)).toBe("2026-12-31");
  });

  it("aponta os dois anos quando a semana vira o ano", () => {
    expect(yearsFor(periodRanges(new Date(2026, 11, 31)))).toEqual([2026, 2027]);
    expect(yearsFor(periodRanges(new Date(2026, 5, 10)))).toEqual([2026]);
  });
});

describe("sumRange", () => {
  it("soma os dias do intervalo, inclusive as pontas", () => {
    const byDay = dailyTotals([
      tx("income", "10", new Date(2026, 10, 21)),
      tx("income", "1", new Date(2026, 10, 22)),
      tx("expense", "2", new Date(2026, 10, 28)),
      tx("expense", "50", new Date(2026, 10, 29)),
    ]);
    expect(sumRange(byDay, new Date(2026, 10, 22), new Date(2026, 10, 28))).toEqual({
      income: 1,
      expense: 2,
      count: 2,
    });
  });
});

describe("formatCompact", () => {
  it("abrevia milhares em pt-BR", () => {
    expect(formatCompact(81352.7).replace(/\s/g, " ")).toBe("81,4 mil");
    expect(formatCompact(81352.7, 0).replace(/\s/g, " ")).toBe("81 mil");
    expect(formatCompact(95.99)).toBe("96");
  });
});
