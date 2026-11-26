import { describe, expect, it } from "vitest";
import {
  competencyEndDayFor,
  competencyOfDate,
  competencyPeriod,
  normalizeStartDay,
} from "./competencyLogic";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const period = (y: number, m: number, startDay: number) => {
  const p = competencyPeriod(y, m, startDay);
  return [ymd(p.start), ymd(p.end)];
};

describe("período da competência", () => {
  it("dia 1 é o mês do calendário", () => {
    expect(period(2026, 11, 1)).toEqual(["2026-11-01", "2026-11-30"]);
    expect(period(2026, 2, 1)).toEqual(["2026-02-01", "2026-02-28"]);
    expect(competencyOfDate(new Date(2026, 10, 30), 1)).toEqual({ year: 2026, month: 11 });
  });

  it("início no dia 30: Novembro vai de 30/11 a 29/12", () => {
    expect(period(2026, 11, 30)).toEqual(["2026-11-30", "2026-12-29"]);
    expect(period(2026, 12, 30)).toEqual(["2026-12-30", "2027-01-29"]);
  });

  it("em fevereiro o início cai no último dia, sem buracos", () => {
    expect(period(2027, 1, 30)).toEqual(["2027-01-30", "2027-02-27"]);
    expect(period(2027, 2, 30)).toEqual(["2027-02-28", "2027-03-29"]);
    expect(period(2028, 2, 30)).toEqual(["2028-02-29", "2028-03-29"]); // bissexto
  });

  it("classifica datas pela competência que começa no mês ou na anterior", () => {
    expect(competencyOfDate(new Date(2026, 10, 30), 30)).toEqual({ year: 2026, month: 11 });
    expect(competencyOfDate(new Date(2026, 11, 15), 30)).toEqual({ year: 2026, month: 11 });
    expect(competencyOfDate(new Date(2026, 11, 29), 30)).toEqual({ year: 2026, month: 11 });
    expect(competencyOfDate(new Date(2026, 11, 30), 30)).toEqual({ year: 2026, month: 12 });
    expect(competencyOfDate(new Date(2026, 10, 26), 30)).toEqual({ year: 2026, month: 10 });
    expect(competencyOfDate(new Date(2027, 0, 5), 30)).toEqual({ year: 2026, month: 12 });
    expect(competencyOfDate(new Date(2027, 1, 28), 30)).toEqual({ year: 2027, month: 2 });
    expect(competencyOfDate(new Date(2027, 1, 27), 30)).toEqual({ year: 2027, month: 1 });
  });

  it("toda data de um ano cai em exatamente uma competência", () => {
    for (const startDay of [1, 5, 21, 29, 30, 31]) {
      for (let m = 1; m <= 12; m++) {
        const { start, end } = competencyPeriod(2027, m, startDay);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          expect(competencyOfDate(new Date(d), startDay)).toEqual({ year: 2027, month: m });
        }
      }
    }
  });

  it("normaliza o dia e calcula o último dia exibido", () => {
    expect(normalizeStartDay(0)).toBe(1);
    expect(normalizeStartDay("30")).toBe(30);
    expect(normalizeStartDay(32)).toBe(1);
    expect(competencyEndDayFor(1)).toBe(0);
    expect(competencyEndDayFor(30)).toBe(29);
  });
});
