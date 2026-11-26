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
import { createRecurringTransactions, deleteTransaction, setRecurrence } from "./db";
import {
  applyFromOccurrence,
  continueSeries,
  endRecurrence,
  horizonEnd,
  listRecurrences,
  materializeRecurrences,
} from "./recurrences";

async function setup() {
  const s = new SheetStore("abc");
  await s.load();
  current.store = s;
  return s;
}
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const dates = (s: SheetStore, group?: string | null) =>
  s
    .select("transactions", t => !group || t.recurrenceGroup === group)
    .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime())
    .map(t => t.recurrenceDate);

describe("recorrência sem data final", () => {
  beforeEach(() => fake.sheets.clear());

  it("horizonte = fim do mês seguinte", () => {
    expect(horizonEnd(day(2026, 11, 25))).toEqual(day(2026, 12, 31));
    expect(horizonEnd(day(2026, 12, 1))).toEqual(day(2027, 1, 31));
  });

  it("gera só até o mês seguinte e continua conforme o tempo passa, sem duplicar", async () => {
    const s = await setup();
    const today = day(2026, 11, 25);
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Moradia", description: "Aluguel", amount: "2000", frequency: "monthly", startDate: day(2026, 10, 10) },
      today
    );
    expect(created.map(t => t.recurrenceDate)).toEqual(["2026-10-10", "2026-11-10", "2026-12-10"]);
    expect(created.every(t => t.isEstimated === 1 && t.recurrence === "monthly")).toBe(true);
    expect(s.select("recurrenceRules")).toHaveLength(1);
    expect(s.select("recurrenceRules")[0].endDate).toBeNull();

    // Rodar de novo no mesmo dia não cria nada.
    expect(materializeRecurrences(s, 1, today).created).toHaveLength(0);
    // Virou o mês: aparece janeiro.
    const next = materializeRecurrences(s, 1, day(2026, 12, 2));
    expect(next.created.map(t => t.recurrenceDate)).toEqual(["2027-01-10"]);
  });

  it("com data final, para nela; valor fixo não fica estimado", async () => {
    const s = await setup();
    await createRecurringTransactions(
      1,
      { type: "expense", category: "Educação", description: "Curso", amount: "300", frequency: "monthly", startDate: day(2026, 11, 5), endDate: day(2027, 3, 5), variableAmount: false },
      day(2026, 11, 25)
    );
    expect(dates(s)).toEqual(["2026-11-05", "2026-12-05"]);
    materializeRecurrences(s, 1, day(2027, 6, 1));
    expect(dates(s)).toEqual(["2026-11-05", "2026-12-05", "2027-01-05", "2027-02-05", "2027-03-05"]);
    expect(s.select("transactions").every(t => t.isEstimated === 0)).toBe(true);
  });

  it("excluir uma ocorrência pula aquele mês (não volta)", async () => {
    const s = await setup();
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Lazer", description: "Academia", amount: "120", frequency: "monthly", startDate: day(2026, 11, 1) },
      day(2026, 11, 25)
    );
    await deleteTransaction(created[1].id); // dezembro
    materializeRecurrences(s, 1, day(2026, 12, 15));
    expect(dates(s)).toEqual(["2026-11-01", "2027-01-01"]);
  });

  it("alterar a partir deste mês muda as próximas não pagas e a regra", async () => {
    const s = await setup();
    const today = day(2026, 11, 25);
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Moradia", description: "Aluguel", amount: "2000", frequency: "monthly", startDate: day(2026, 10, 10) },
      today
    );
    s.update("transactions", t => t.id === created[0].id, { isPaid: 1 });
    applyFromOccurrence(s, created[1].id, { amount: "2100" });
    const amounts = () => s.select("transactions").sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()).map(t => t.amount);
    // A própria (nov) é atualizada pela edição normal; a paga (out) não muda; dez segue a regra.
    expect(amounts()).toEqual(["2000.00", "2000.00", "2100.00"]);
    materializeRecurrences(s, 1, day(2026, 12, 2));
    expect(amounts()[3]).toBe("2100.00");
  });

  it("encerrar remove as futuras não pagas e para de gerar", async () => {
    const s = await setup();
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Streaming", description: "Filmes", amount: "40", frequency: "monthly", startDate: day(2026, 10, 3) },
      day(2026, 11, 25)
    );
    const { removed } = endRecurrence(s, created[0].recurrenceGroup!, 1, day(2026, 11, 3));
    expect(removed).toBe(1);
    materializeRecurrences(s, 1, day(2027, 3, 1));
    expect(dates(s)).toEqual(["2026-10-03", "2026-11-03"]);
    expect(listRecurrences(s, 1, day(2026, 11, 1))[0]).toMatchObject({ kind: "rule", ended: false, count: 2 });
    expect(listRecurrences(s, 1, day(2026, 12, 25))[0]).toMatchObject({ ended: true });
  });

  it("compra recorrente no cartão vai para a fatura certa", async () => {
    const s = await setup();
    const card = s.insert("creditCards", { userId: 1, name: "Nubank", cutoffDay: 20, dueDay: 27, isActive: 1 });
    await createRecurringTransactions(
      1,
      { type: "credit_card", category: "Assinaturas", description: "Música", amount: "21.90", frequency: "monthly", startDate: day(2026, 11, 22), creditCardId: card.id },
      day(2026, 11, 25)
    );
    // 22/11 é depois do fechamento (20): fatura de dezembro; 22/12 → janeiro.
    const comps = s.select("transactions").map(t => {
      const c = s.find("competencies", x => x.id === t.competencyId)!;
      return `${c.year}-${c.month}`;
    });
    expect(comps).toEqual(["2026-12", "2027-1"]);
    expect(s.select("invoices").map(i => i.totalAmount)).toEqual(["21.90", "21.90"]);
  });

  it("série antiga (com data final) pode continuar sem fim, sem duplicar as existentes", async () => {
    const s = await setup();
    const comp = s.insert("competencies", { userId: 1, year: 2026, month: 9, name: "x" });
    for (const m of [9, 10, 11]) {
      s.insert("transactions", { userId: 1, competencyId: comp.id, type: "expense", category: "Educação", description: "Escola", amount: "900", transactionDate: day(2026, m, 5), recurrence: "monthly", recurrenceGroup: "rold" });
    }
    expect(listRecurrences(s, 1, day(2026, 11, 25))[0]).toMatchObject({ kind: "legacy", count: 3 });
    continueSeries(s, 1, "rold", 1);
    materializeRecurrences(s, 1, day(2026, 11, 25));
    expect(dates(s, "rold")).toEqual(["2026-09-05", "2026-10-05", "2026-11-05", "2026-12-05"]);
    expect(listRecurrences(s, 1, day(2026, 11, 25))[0]).toMatchObject({ kind: "rule", count: 4 });
  });

  it("remove ocorrência duplicada (duas pessoas gerando ao mesmo tempo), mantendo a paga", async () => {
    const s = await setup();
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Moradia", description: "Condomínio", amount: "700", frequency: "monthly", startDate: day(2026, 11, 8) },
      day(2026, 11, 25)
    );
    const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = created[0];
    const dup = s.insert("transactions", { ...copy, isPaid: 1 });
    const { duplicatesRemoved } = materializeRecurrences(s, 1, day(2026, 11, 25));
    expect(duplicatesRemoved).toBe(1);
    expect(dates(s)).toEqual(["2026-11-08", "2026-12-08"]);
    expect(s.find("transactions", t => t.id === dup.id)).not.toBeNull();
  });

  it("tirar uma ocorrência da série (variável) não faz a regra recriá-la", async () => {
    const s = await setup();
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Moradia", description: "Aluguel", amount: "2000", frequency: "monthly", startDate: day(2026, 11, 10) },
      day(2026, 11, 25)
    );
    await setRecurrence([created[0].id], null);
    materializeRecurrences(s, 1, day(2026, 11, 26));
    expect(s.select("transactions")).toHaveLength(2);
    expect(dates(s, created[1].recurrenceGroup)).toEqual(["2026-12-10"]);
  });

  it("ocorrência transferida para outra área não é recriada na origem", async () => {
    const s = await setup();
    const { transferTransactions } = await import("./transfer");
    s.insert("users", { openId: "sub-1", name: "Ana", role: "admin" });
    const created = await createRecurringTransactions(
      1,
      { type: "expense", category: "Moradia", description: "Aluguel", amount: "2000", frequency: "monthly", startDate: day(2026, 11, 10) },
      day(2026, 11, 25)
    );
    const target = new SheetStore("outra");
    await target.load();
    const bia = target.insert("users", { openId: "sub-2", name: "Bia", role: "admin" });
    transferTransactions(s, target, { ids: [created[0].id], sourceOwnerId: 1, targetOwnerId: bia.id, actorTargetUserId: bia.id });
    materializeRecurrences(s, 1, day(2026, 11, 26));
    expect(dates(s, created[1].recurrenceGroup)).toEqual(["2026-12-10"]);
  });
});
