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
