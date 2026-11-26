import { beforeEach, describe, expect, it, vi } from "vitest";

type Cell = string | number | null;
const fake = vi.hoisted(() => ({ sheets: new Map<string, Cell[][]>() }));
const unquote = (range: string) => range.split("!")[0].replace(/^'|'$/g, "").replace(/''/g, "'");

// Mesma planilha falsa do sheetStore.test.ts (só as rotas usadas pelo store).
vi.mock("./google", async importOriginal => ({
  ...(await importOriginal<typeof import("./google")>()),
  googleFetch: async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.includes("?fields=sheets.properties")) {
      return {
        sheets: Array.from(fake.sheets.keys()).map((title, sheetId) => ({ properties: { sheetId, title } })),
      };
    }
    if (url.endsWith(":batchUpdate") && !url.includes("/values:")) {
      for (const req of body.requests) if (req.addSheet) fake.sheets.set(req.addSheet.properties.title, []);
      return {};
    }
    if (url.includes("/values:batchGet")) {
      const ranges = new URL(url).searchParams.getAll("ranges");
      return { valueRanges: ranges.map(range => ({ values: fake.sheets.get(unquote(range)) ?? [] })) };
    }
    if (url.includes("/values:batchUpdate")) {
      for (const { range, values } of body.data) {
        const grid = fake.sheets.get(unquote(range))!;
        values.forEach((row: Cell[], r: number) => (grid[r] = [...row]));
      }
      return {};
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  },
}));

const current = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("./session", () => ({ getStore: () => current.store }));

import { SheetStore } from "./sheetStore";
import {
  getCompetencyTransactions,
  getOrCreateCompetencyByYearMonth,
  getOrCreateCurrentCompetency,
  previewCompetencyStartDay,
  resolveCompetencyForCreate,
  setCompetencyStartDay,
  updateTransaction,
} from "./db";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

async function setup() {
  fake.sheets.clear();
  const s = new SheetStore("abc");
  await s.load();
  current.store = s;
  const owner = s.insert("users", { openId: "1", email: "a@x.com", role: "admin" });
  return { s, ownerId: owner.id };
}

/** Lançamento como o app gravava antes: na competência do mês do calendário. */
function addExpense(s: SheetStore, userId: number, date: Date, description: string) {
  const c = s.find("competencies", x => x.userId === userId && x.year === date.getFullYear() && x.month === date.getMonth() + 1)
    ?? s.insert("competencies", { userId, year: date.getFullYear(), month: date.getMonth() + 1, name: "x" });
  return s.insert("transactions", {
    userId, competencyId: c.id, type: "expense", category: "Casa", description, amount: "10.00", transactionDate: date,
  });
}

const descriptionsIn = async (userId: number, year: number, month: number) => {
  const c = await getOrCreateCompetencyByYearMonth(userId, year, month);
  return (await getCompetencyTransactions(c.id)).map(t => t.description).sort();
};

describe("competência com dia inicial 30", () => {
  beforeEach(() => vi.useRealTimers());

  it("reorganiza os lançamentos: Novembro mostra de 30/11 a 29/12", async () => {
    const { s, ownerId } = await setup();
    addExpense(s, ownerId, day(2026, 11, 10), "10/11");
    addExpense(s, ownerId, day(2026, 11, 30), "30/11");
    addExpense(s, ownerId, day(2026, 12, 15), "15/12");
    addExpense(s, ownerId, day(2026, 12, 29), "29/12");
    addExpense(s, ownerId, day(2026, 12, 30), "30/12");

    expect(await descriptionsIn(ownerId, 2026, 11)).toEqual(["10/11", "30/11"]);
    expect(previewCompetencyStartDay(ownerId, 30).affected).toBe(3);

    const result = await setCompetencyStartDay(ownerId, 30);
    expect(result).toMatchObject({ startDay: 30, endDay: 29, moved: 3 });

    expect(await descriptionsIn(ownerId, 2026, 10)).toEqual(["10/11"]);
    expect(await descriptionsIn(ownerId, 2026, 11)).toEqual(["15/12", "29/12", "30/11"]);
    expect(await descriptionsIn(ownerId, 2026, 12)).toEqual(["30/12"]);

    const nov = await getOrCreateCompetencyByYearMonth(ownerId, 2026, 11);
    expect(nov.periodStart).toEqual(day(2026, 11, 30));
    expect(nov.periodEnd).toEqual(day(2026, 12, 29));
    expect(previewCompetencyStartDay(ownerId, 30).affected).toBe(0);
  });

  it("lançamento novo e data editada seguem o período", async () => {
    const { s, ownerId } = await setup();
    await setCompetencyStartDay(ownerId, 30);
    const nov = await getOrCreateCompetencyByYearMonth(ownerId, 2026, 11);
    const dec = await getOrCreateCompetencyByYearMonth(ownerId, 2026, 12);

    // Tela aberta em Dezembro, mas a data (15/12) é da competência de Novembro.
    expect(resolveCompetencyForCreate(ownerId, "expense", undefined, day(2026, 12, 15), dec.id)).toBe(nov.id);

    const t = addExpense(s, ownerId, day(2026, 12, 15), "x");
    s.update("transactions", x => x.id === t.id, { competencyId: nov.id });
    await updateTransaction(t.id, { transactionDate: day(2026, 12, 30) });
    expect(s.find("transactions", x => x.id === t.id)!.competencyId).toBe(dec.id);
  });

  it("a competência atual considera o dia inicial", async () => {
    const { ownerId } = await setup();
    await setCompetencyStartDay(ownerId, 30);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day(2026, 11, 26));
    expect(await getOrCreateCurrentCompetency(ownerId)).toMatchObject({ year: 2026, month: 10 });
    vi.setSystemTime(day(2026, 11, 30));
    expect(await getOrCreateCurrentCompetency(ownerId)).toMatchObject({ year: 2026, month: 11 });
    vi.useRealTimers();
  });

  it("com dia 1 nada muda", async () => {
    const { s, ownerId } = await setup();
    addExpense(s, ownerId, day(2026, 11, 10), "a");
    addExpense(s, ownerId, day(2026, 12, 1), "b");
    expect(previewCompetencyStartDay(ownerId, 1).affected).toBe(0);
    expect((await setCompetencyStartDay(ownerId, 1)).moved).toBe(0);
  });
});
