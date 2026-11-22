/**
 * Sessão do usuário: liga o login Google à planilha da área de trabalho ativa.
 *
 * - Área pessoal: a planilha "Financeiro Doméstico" do próprio usuário.
 * - Área compartilhada: outra planilha, compartilhada pelo Drive entre várias
 *   pessoas. Todas veem os mesmos lançamentos; cada uma tem sua linha na aba
 *   `Usuarios`, que também serve para indicar o responsável de cada lançamento.
 */
import {
  GoogleApiError,
  GoogleAuthError,
  getProfile,
  hasSession,
  setSessionHint,
  signIn as googleSignIn,
  signOut as googleSignOut,
  type GoogleProfile,
} from "./google";
import { findOrCreateSpreadsheet, SheetStore } from "./sheetStore";
import type { User } from "./schema";
import { createDefaultTypologies } from "./db";
import {
  getActiveWorkspaceId,
  getWorkspaceFile,
  setActiveWorkspaceId,
  type WorkspaceRef,
} from "./workspaces";

type Loaded = {
  store: SheetStore;
  user: User;
  profile: GoogleProfile;
  personalId: string;
  workspace: WorkspaceRef;
};

/** Em áreas compartilhadas, relê a planilha se a cópia em memória for mais antiga que isso. */
const SHARED_REFRESH_MS = 20_000;

let loading: Promise<Loaded> | null = null;
let loaded: Loaded | null = null;
let lastRefresh = 0;
let refreshing: Promise<void> | null = null;

const sameEmail = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Dono dos dados da planilha: quem a criou (primeiro administrador). */
export function findOwner(store: SheetStore): User | null {
  const admins = store
    .select("users", u => u.role === "admin")
    .sort((a, b) => a.id - b.id);
  return admins[0] ?? null;
}

/** Encontra (ou cria) a linha do usuário logado na aba `Usuarios`. */
export function bindUser(store: SheetStore, profile: GoogleProfile): User {
  const byOpenId = store.find("users", u => u.openId === profile.sub);
  if (byOpenId) {
    store.update("users", u => u.id === byOpenId.id, {
      name: byOpenId.name || profile.name || null,
      email: profile.email,
      status: "active",
      lastSignedIn: new Date(),
    });
    return store.find("users", u => u.id === byOpenId.id)!;
  }

  // Convidado entrando pela primeira vez: assume a linha criada no convite.
  const invited = store.find(
    "users",
    u => !u.openId && u.status !== "removed" && sameEmail(u.email, profile.email)
  );
  if (invited) {
    store.update("users", u => u.id === invited.id, {
      openId: profile.sub,
      name: invited.name || profile.name || null,
      email: profile.email,
      loginMethod: "google",
      status: "active",
      lastSignedIn: new Date(),
    });
    return store.find("users", u => u.id === invited.id)!;
  }

  // Quem cria a planilha é o dono dela.
  const isFirstUser = store.select("users", u => !!u.openId).length === 0;
  return store.insert("users", {
    openId: profile.sub,
    name: profile.name ?? null,
    email: profile.email,
    loginMethod: "google",
    role: isFirstUser ? "admin" : "user",
    status: "active",
  });
}

async function openStore(id: string) {
  const store = new SheetStore(id);
  await store.load();
  return store;
}

async function load(): Promise<Loaded> {
  const profile = await getProfile();
  setSessionHint(profile.email);

  const personalId = await findOrCreateSpreadsheet(profile.sub);
  const activeId = getActiveWorkspaceId(profile.sub);

  let store: SheetStore | null = null;
  let workspace: WorkspaceRef | null = null;

  if (activeId && activeId !== personalId) {
    try {
      workspace = await getWorkspaceFile(activeId);
      store = await openStore(activeId);
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      // Sem acesso (removido da área, planilha excluída…): volta para a pessoal.
      console.warn("Área de trabalho indisponível, voltando para a pessoal", error);
      setActiveWorkspaceId(profile.sub, null);
      store = null;
      workspace = null;
    }
  }

  if (!store || !workspace) {
    store = await openStore(personalId);
    workspace = {
      id: personalId,
      name: "Pessoal",
      kind: "personal",
      ownedByMe: true,
      ownerName: profile.name ?? null,
      ownerEmail: profile.email,
      url: store.url,
    };
  }

  const user = bindUser(store, profile);
  const owner = findOwner(store) ?? user;
  if (store.select("typologies", t => t.userId === owner.id).length === 0) {
    createDefaultTypologies(store, owner.id);
  }
  await store.commit();
  lastRefresh = Date.now();

  return { store, user, profile, personalId, workspace };
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
    const { store, user } = await ensureLoaded();
    // Lê da memória para refletir alterações feitas depois do login (ex: timezone).
    return store.find("users", u => u.id === user.id) ?? user;
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

/**
 * Id (na aba `Usuarios`) a que os dados da área pertencem. Na área
 * compartilhada é o dono da planilha, para que todos vejam os mesmos dados.
 */
export function getDataUserId(): number {
  if (!loaded) throw new GoogleAuthError();
  return findOwner(loaded.store)?.id ?? loaded.user.id;
}

export function getActiveWorkspace(): WorkspaceRef | null {
  return loaded?.workspace ?? null;
}

export function getPersonalWorkspaceId(): string | null {
  return loaded?.personalId ?? null;
}

export function getSpreadsheetUrl(): string | null {
  return loaded?.store.url ?? null;
}

/**
 * Em áreas compartilhadas outra pessoa pode ter gravado na planilha: relê os
 * dados antes de gravar e, nas consultas, quando a cópia estiver velha.
 */
export async function syncSharedStore(force: boolean) {
  if (!loaded || loaded.workspace.kind !== "shared") return;
  if (!force && Date.now() - lastRefresh < SHARED_REFRESH_MS) return;
  if (!refreshing) {
    const store = loaded.store;
    refreshing = store
      .refresh()
      .then(() => {
        lastRefresh = Date.now();
      })
      .finally(() => {
        refreshing = null;
      });
  }
  await refreshing;
}

/** Troca a área de trabalho ativa e carrega a planilha dela. */
export async function switchWorkspace(id: string | null) {
  const current = await ensureLoaded();
  const target = !id || id === current.personalId ? null : id;
  if (target) await getWorkspaceFile(target); // falha cedo se não houver acesso
  setActiveWorkspaceId(current.profile.sub, target);
  loaded = null;
  return (await ensureLoaded()).workspace;
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

export { GoogleApiError };
