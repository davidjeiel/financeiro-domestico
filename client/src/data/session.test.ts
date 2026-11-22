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

import { SheetStore } from "./sheetStore";
import { bindUser, findOwner } from "./session";

const alice = { sub: "sub-alice", email: "alice@gmail.com", name: "Alice" };
const bob = { sub: "sub-bob", email: "Bob@Gmail.com", name: "Bob" };

describe("área compartilhada", () => {
  beforeEach(() => fake.sheets.clear());

  it("quem cria é o dono; o convidado assume a linha do convite", async () => {
    const aliceStore = new SheetStore("shared");
    await aliceStore.load();
    const aliceUser = bindUser(aliceStore, alice);
    // Convite criado por Alice (como faz upsertInvitedPerson).
    aliceStore.insert("users", { openId: "", name: "Bobão", email: "bob@gmail.com", status: "invited" });
    aliceStore.insert("users", { openId: "", name: "Diarista", status: "guest" });
    await aliceStore.commit();

    const bobStore = new SheetStore("shared");
    await bobStore.load();
    const bobUser = bindUser(bobStore, bob);
    await bobStore.commit();

    expect(aliceUser.role).toBe("admin");
    expect(bobUser).toMatchObject({ id: 2, role: "user", status: "active", name: "Bobão", openId: "sub-bob" });
    // Os dados da área pertencem ao dono, para os dois verem os mesmos lançamentos.
    expect(findOwner(bobStore)?.id).toBe(aliceUser.id);
    expect(bobStore.select("users")).toHaveLength(3);

    // Entrar de novo não duplica a pessoa.
    const again = new SheetStore("shared");
    await again.load();
    expect(bindUser(again, bob).id).toBe(2);
    expect(again.select("users")).toHaveLength(3);
  });

  it("pessoa removida não é reaproveitada por e-mail", async () => {
    const store = new SheetStore("shared");
    await store.load();
    bindUser(store, alice);
    store.insert("users", { openId: "", email: "bob@gmail.com", status: "removed" });

    const bobUser = bindUser(store, bob);
    expect(bobUser.id).toBe(3);
  });
});
