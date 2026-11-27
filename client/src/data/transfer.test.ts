import { beforeEach, describe, expect, it, vi } from "vitest";

type Cell = string | number | null;
// Várias planilhas falsas, separadas pelo id da planilha na URL.
const fake = vi.hoisted(() => ({ files: new Map<string, Map<string, Cell[][]>>() }));
const unquote = (range: string) => range.split("!")[0].replace(/^'|'$/g, "").replace(/''/g, "'");

vi.mock("./google", async importOriginal => ({
  ...(await importOriginal<typeof import("./google")>()),
  googleFetch: async (url: string, init: RequestInit = {}) => {
    const id = url.match(/spreadsheets\/([^/?:]+)/)?.[1] ?? "";
    if (!fake.files.has(id)) fake.files.set(id, new Map());
    const sheets = fake.files.get(id)!;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.includes("?fields=sheets.properties")) {
      return { sheets: Array.from(sheets.keys()).map((title, sheetId) => ({ properties: { sheetId, title } })) };
    }
    if (url.endsWith(":batchUpdate") && !url.includes("/values:")) {
      for (const req of body.requests) if (req.addSheet) sheets.set(req.addSheet.properties.title, []);
      return {};
    }
    if (url.includes("/values:batchGet")) {
      const ranges = new URL(url).searchParams.getAll("ranges");
      return { valueRanges: ranges.map(range => ({ values: sheets.get(unquote(range)) ?? [] })) };
    }
    if (url.includes("/values:batchUpdate")) {
      for (const { range, values } of body.data) {
        const grid = sheets.get(unquote(range))!;
        values.forEach((row: Cell[], r: number) => (grid[r] = [...row]));
      }
      return {};
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  },
}));

import { SheetStore } from "./sheetStore";
import { previewTransfer, transferTransactions } from "./transfer";
import { createRule, materializeRecurrences } from "./recurrences";
import { setAllocations } from "./allocations";

async function setup() {
  const source = new SheetStore("pessoal");
  await source.load();
  const target = new SheetStore("casa");
  await target.load();

  // Origem (área pessoal de Ana)
  const ana = source.insert("users", { openId: "sub-ana", name: "Ana", email: "ana@gmail.com", role: "admin" });
  const diarista = source.insert("users", { openId: "", name: "Diarista", status: "guest" });
  const comp = source.insert("competencies", { userId: ana.id, year: 2026, month: 3, name: "Março de 2026" });
  const nubank = source.insert("creditCards", { userId: ana.id, name: "Nubank", cutoffDay: 20, dueDay: 27, isActive: 1 });
  const inter = source.insert("creditCards", { userId: ana.id, name: "Inter", cutoffDay: 5, dueDay: 12, isActive: 1 });
  source.insert("typologies", { userId: ana.id, name: "Pet", type: "expense", color: "#ff0000", icon: "🐶" });
  const tx = (data: Parameters<typeof source.insert<"transactions">>[1]) =>
    source.insert("transactions", { userId: ana.id, competencyId: comp.id, transactionDate: new Date(2026, 2, 10), ...data });
  const salario = tx({ type: "income", category: "Salário", amount: "5000.00" });
  const racao = tx({ type: "expense", category: "Pet", amount: "200.00", responsibleUserId: diarista.id });
  const mercado = tx({ type: "credit_card", category: "Compras", amount: "300.00", creditCardId: nubank.id, responsibleUserId: ana.id });
  const livro = tx({ type: "credit_card", category: "Compras", amount: "80.00", creditCardId: inter.id });
  setAllocations(source, racao.id, [{ incomeId: salario.id, amount: "200" }], ana.id);

  // Destino (área compartilhada "Casa", dona Bia, Ana participante)
  const bia = target.insert("users", { openId: "sub-bia", name: "Bia", email: "bia@gmail.com", role: "admin" });
  const anaNoDestino = target.insert("users", { openId: "sub-ana", name: "Ana", email: "ANA@gmail.com" });
  const nubankCasa = target.insert("creditCards", { userId: bia.id, name: "nubank ", cutoffDay: 20, dueDay: 27, isActive: 1 });

  return { source, target, ana, bia, anaNoDestino, nubankCasa, nubank, inter, racao, mercado, livro };
}

describe("transferência entre áreas", () => {
  beforeEach(() => fake.files.clear());

  it("prévia sugere o cartão de mesmo nome e avisa o que se perde", async () => {
    const { source, target, ana, bia, nubank, inter, nubankCasa, racao, mercado, livro } = await setup();
    const preview = previewTransfer(source, target, {
      ids: [racao.id, mercado.id, livro.id],
      sourceOwnerId: ana.id,
      targetOwnerId: bia.id,
    });
    expect(preview).toMatchObject({
      count: 3,
      allocationsRemoved: 1,
      responsiblesUnmatched: 1, // a diarista não existe na Casa
      targetCards: [{ id: nubankCasa.id, name: "nubank " }],
    });
    expect(preview.cards).toEqual([
      { sourceCardId: nubank.id, name: "Nubank", suggested: nubankCasa.id },
      { sourceCardId: inter.id, name: "Inter", suggested: "new" },
    ]);
  });

  it("recria no destino com as referências traduzidas e remove da origem", async () => {
    const { source, target, ana, bia, anaNoDestino, nubankCasa, inter, racao, mercado, livro } = await setup();
    const { created, allocationsRemoved } = transferTransactions(source, target, {
      ids: [racao.id, mercado.id, livro.id],
      sourceOwnerId: ana.id,
      targetOwnerId: bia.id,
      actorTargetUserId: anaNoDestino.id,
      cardMap: { [inter.id]: "new" },
    });
    await target.commit();
    await source.commit();

    expect(allocationsRemoved).toBe(1);
    expect(created).toHaveLength(3);
    // Tudo pertence à dona do destino, na mesma competência (criada lá).
    const comp = target.find("competencies", c => c.year === 2026 && c.month === 3)!;
    expect(created.every(t => t.userId === bia.id && t.competencyId === comp.id && t.createdBy === anaNoDestino.id)).toBe(true);

    const byCategory = (c: string, amount: string) => created.find(t => t.category === c && t.amount === amount)!;
    expect(byCategory("Compras", "300.00")).toMatchObject({ creditCardId: nubankCasa.id, responsibleUserId: anaNoDestino.id });
    const interCopy = target.find("creditCards", c => c.name === "Inter" && c.userId === bia.id)!;
    expect(byCategory("Compras", "80.00").creditCardId).toBe(interCopy.id);
    expect(byCategory("Pet", "200.00").responsibleUserId).toBeNull();
    // Categoria criada no destino com a cor/ícone da origem.
    expect(target.find("typologies", t => t.name === "Pet")).toMatchObject({ userId: bia.id, icon: "🐶" });
    // Faturas recalculadas no destino.
    expect(target.select("invoices").map(i => [i.creditCardId, i.totalAmount]).sort()).toEqual(
      [[nubankCasa.id, "300.00"], [interCopy.id, "80.00"]].sort()
    );

    // Origem: só sobrou a receita, sem vínculos.
    expect(source.select("transactions").map(t => t.category)).toEqual(["Salário"]);
    expect(source.select("incomeAllocations")).toHaveLength(0);

    // Persistido nas duas planilhas.
    const reloaded = new SheetStore("casa");
    await reloaded.load();
    expect(reloaded.select("transactions")).toHaveLength(3);
  });

  it("recusa lançamento que não é da área de origem e cartão de outro dono", async () => {
    const { source, target, ana, bia, anaNoDestino, mercado, nubank } = await setup();
    expect(() =>
      transferTransactions(source, target, {
        ids: [mercado.id, 999],
        sourceOwnerId: ana.id,
        targetOwnerId: bia.id,
        actorTargetUserId: anaNoDestino.id,
      })
    ).toThrow(/não foram encontrados/);
    expect(() =>
      transferTransactions(source, target, {
        ids: [mercado.id],
        sourceOwnerId: ana.id,
        targetOwnerId: bia.id,
        actorTargetUserId: anaNoDestino.id,
        cardMap: { [nubank.id]: 12345 },
      })
    ).toThrow(/Escolha um cartão/);
  });
  it("copiar cria no destino e deixa a origem intacta (com vínculos)", async () => {
    const { source, target, ana, bia, anaNoDestino, nubankCasa, racao, mercado } = await setup();
    const before = source.select("transactions").map(t => t.id).sort();
    const sourceInvoices = source.select("invoices").length;
    const result = transferTransactions(source, target, {
      ids: [racao.id, mercado.id],
      sourceOwnerId: ana.id,
      targetOwnerId: bia.id,
      actorTargetUserId: anaNoDestino.id,
      mode: "copy",
    });
    await target.commit();

    expect(result).toMatchObject({ mode: "copy", allocationsRemoved: 0 });
    expect(result.created).toHaveLength(2);
    expect(target.select("transactions").map(t => t.category).sort()).toEqual(["Compras", "Pet"]);
    expect(target.find("transactions", t => t.category === "Compras")!.creditCardId).toBe(nubankCasa.id);
    // Origem: mesmos lançamentos, vínculo mantido, faturas intocadas.
    expect(source.select("transactions").map(t => t.id).sort()).toEqual(before);
    expect(source.select("incomeAllocations")).toHaveLength(1);
    expect(source.select("invoices")).toHaveLength(sourceInvoices);
    // Nenhum vínculo vai para o destino.
    expect(target.select("incomeAllocations")).toHaveLength(0);
  });

  it("no destino, a competência segue a data pelo dia de início de lá", async () => {
    const { source, target, ana, bia, anaNoDestino, racao, mercado } = await setup();
    target.update("users", u => u.id === bia.id, { competencyStartDay: 15 });
    const { created } = transferTransactions(source, target, {
      ids: [racao.id, mercado.id],
      sourceOwnerId: ana.id,
      targetOwnerId: bia.id,
      actorTargetUserId: anaNoDestino.id,
      mode: "copy",
    });
    const compOf = (id: number) => target.find("competencies", c => c.id === id)!;
    // 10/03 com início no dia 15 é da competência de fevereiro (15/02 a 14/03).
    expect(compOf(created.find(t => t.category === "Pet")!.competencyId)).toMatchObject({ year: 2026, month: 2 });
    // Compra no cartão continua na competência da fatura (março).
    expect(compOf(created.find(t => t.category === "Compras")!.competencyId)).toMatchObject({ year: 2026, month: 3 });
  });
});

describe("transferir lançamento recorrente", () => {
  beforeEach(() => fake.files.clear());

  // Aluguel mensal de Ana desde set/2026, visto em 25/11/2026 (gerado até nov/2027).
  async function series() {
    const base = await setup();
    const { source, ana } = base;
    const today = new Date(2026, 10, 25);
    const rule = createRule(
      source,
      ana.id,
      { type: "expense", category: "Moradia", description: "Aluguel", amount: "2000", frequency: "monthly", startDate: new Date(2026, 8, 10), responsibleUserId: ana.id },
      ana.id
    );
    materializeRecurrences(source, ana.id, today);
    const occ = source
      .select("transactions", t => t.recurrenceGroup === rule.groupKey)
      .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    source.update("transactions", t => t.id === occ[0].id, { isPaid: 1 }); // setembro pago
    const nov = occ.find(t => t.recurrenceDate === "2026-11-10")!;
    const keys = (st: SheetStore) =>
      st.select("transactions", t => t.recurrenceGroup === rule.groupKey).map(t => t.recurrenceDate).sort();
    return { ...base, today, rule, occ, nov, keys };
  }

  it("prévia mostra quantos vão em cada opção", async () => {
    const { source, target, ana, bia, nov, occ } = await series();
    const preview = previewTransfer(source, target, { ids: [nov.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, seriesScope: "following" });
    expect(preview.series).toEqual({ recurringSelected: 1, selected: 1, following: 13, all: occ.length });
    expect(preview.count).toBe(13);
  });

  it("só a selecionada: a série continua na origem", async () => {
    const { source, target, ana, bia, anaNoDestino, nov, keys, today } = await series();
    transferTransactions(source, target, { ids: [nov.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, actorTargetUserId: anaNoDestino.id });
    expect(keys(target)).toEqual(["2026-11-10"]);
    expect(target.select("recurrenceRules")).toHaveLength(0);
    materializeRecurrences(source, ana.id, today);
    expect(keys(source)).not.toContain("2026-11-10");
    expect(keys(source)).toHaveLength(14);
  });

  it("mover desta em diante: a regra passa a gerar no destino e termina na origem", async () => {
    const { source, target, ana, bia, anaNoDestino, nov, rule, keys } = await series();
    const result = transferTransactions(source, target, {
      ids: [nov.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, actorTargetUserId: anaNoDestino.id, seriesScope: "following",
    });
    expect(result.created).toHaveLength(13);
    expect(result.rulesTransferred).toBe(1);
    expect(keys(source)).toEqual(["2026-09-10", "2026-10-10"]);
    expect(source.find("recurrenceRules", r => r.id === rule.id)!.endDate).toEqual(new Date(2026, 10, 9));

    const targetRule = target.find("recurrenceRules", r => r.groupKey === rule.groupKey)!;
    expect(targetRule).toMatchObject({ userId: bia.id, startDate: new Date(2026, 10, 10), responsibleUserId: anaNoDestino.id });
    // Um mês depois: o destino ganha dez/2027, a origem não gera nada.
    materializeRecurrences(target, bia.id, new Date(2026, 11, 2));
    materializeRecurrences(source, ana.id, new Date(2026, 11, 2));
    expect(keys(target)).toHaveLength(14);
    expect(keys(target).at(-1)).toBe("2027-12-10");
    expect(keys(source)).toEqual(["2026-09-10", "2026-10-10"]);
  });

  it("mover a série toda leva o histórico (pago incluído) e a regra sai da origem", async () => {
    const { source, target, ana, bia, anaNoDestino, nov, rule, keys, occ } = await series();
    transferTransactions(source, target, {
      ids: [nov.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, actorTargetUserId: anaNoDestino.id, seriesScope: "all",
    });
    expect(keys(source)).toEqual([]);
    expect(source.find("recurrenceRules", r => r.id === rule.id)).toBeNull();
    expect(keys(target)).toHaveLength(occ.length);
    expect(target.find("transactions", t => t.recurrenceDate === "2026-09-10")!.isPaid).toBe(1);
    expect(target.find("recurrenceRules", r => r.groupKey === rule.groupKey)!.startDate).toEqual(new Date(2026, 8, 10));
  });

  it("copiar a série toda: as duas áreas continuam gerando", async () => {
    const { source, target, ana, bia, anaNoDestino, nov, rule, keys, occ } = await series();
    transferTransactions(source, target, {
      ids: [nov.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, actorTargetUserId: anaNoDestino.id, mode: "copy", seriesScope: "all",
    });
    expect(keys(source)).toHaveLength(occ.length);
    expect(keys(target)).toHaveLength(occ.length);
    expect(source.find("recurrenceRules", r => r.id === rule.id)!.endDate).toBeNull();
    materializeRecurrences(target, bia.id, new Date(2026, 11, 2));
    expect(keys(target).at(-1)).toBe("2027-12-10");
  });

  it("compra recorrente no cartão leva a regra com o cartão do destino", async () => {
    const { source, target, ana, bia, anaNoDestino, nubank, nubankCasa } = await series();
    const rule = createRule(
      source, ana.id,
      { type: "credit_card", category: "Assinaturas", description: "Música", amount: "21.90", frequency: "monthly", startDate: new Date(2026, 10, 2), creditCardId: nubank.id },
      ana.id
    );
    materializeRecurrences(source, ana.id, new Date(2026, 10, 25));
    const first = source.find("transactions", t => t.recurrenceGroup === rule.groupKey)!;
    transferTransactions(source, target, {
      ids: [first.id], sourceOwnerId: ana.id, targetOwnerId: bia.id, actorTargetUserId: anaNoDestino.id, seriesScope: "all",
    });
    expect(target.find("recurrenceRules", r => r.groupKey === rule.groupKey)!.creditCardId).toBe(nubankCasa.id);
    expect(target.select("transactions", t => t.recurrenceGroup === rule.groupKey).every(t => t.creditCardId === nubankCasa.id)).toBe(true);
  });
});
