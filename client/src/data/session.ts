/**
 * Sessão do usuário: liga o login Google à planilha de dados.
 */
import {
  GoogleAuthError,
  getProfile,
  hasSession,
  setSessionHint,
  signIn as googleSignIn,
  signOut as googleSignOut,
} from "./google";
import { findOrCreateSpreadsheet, SheetStore } from "./sheetStore";
import type { User } from "./schema";
import { createDefaultTypologies } from "./db";

type Loaded = { store: SheetStore; user: User };

let loading: Promise<Loaded> | null = null;
let loaded: Loaded | null = null;

async function load(): Promise<Loaded> {
  const profile = await getProfile();
  setSessionHint(profile.email);

  const store = new SheetStore(await findOrCreateSpreadsheet(profile.sub));
  await store.load();

  let user = store.find("users", u => u.openId === profile.sub);
  if (user) {
    store.update("users", u => u.id === user!.id, {
      name: profile.name ?? user.name,
      email: profile.email,
      lastSignedIn: new Date(),
    });
    user = store.find("users", u => u.id === user!.id)!;
  } else {
    // Quem cria a planilha é o dono dela.
    const isFirstUser = store.select("users").length === 0;
    user = store.insert("users", {
      openId: profile.sub,
      name: profile.name ?? null,
      email: profile.email,
      loginMethod: "google",
      role: isFirstUser ? "admin" : "user",
    });
    if (store.select("typologies", t => t.userId === user!.id).length === 0) {
      createDefaultTypologies(store, user.id);
    }
  }
  await store.commit();

  return { store, user };
}

function ensureLoaded(): Promise<Loaded> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = load()
      .then(result => (loaded = result))
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** Usuário atual, ou `null` se não houver login. */
export async function getCurrentUser(): Promise<User | null> {
  if (!hasSession()) {
    loaded = null;
    return null;
  }
  try {
    return (await ensureLoaded()).user;
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      loaded = null;
      return null;
    }
    throw error;
  }
}

export function getStore(): SheetStore {
  if (!loaded) throw new GoogleAuthError();
  return loaded.store;
}

export function getSpreadsheetUrl(): string | null {
  return loaded?.store.url ?? null;
}

export async function signIn() {
  await googleSignIn();
  loaded = null;
}

export function signOut() {
  googleSignOut();
  loaded = null;
}

/** Descarta a cópia em memória e lê a planilha de novo. */
export async function reload() {
  loaded = null;
  await ensureLoaded();
}
