/**
 * Áreas de trabalho.
 *
 * - A área **pessoal** é a planilha "Financeiro Doméstico" do próprio usuário.
 * - Cada área **compartilhada** é uma planilha separada, criada pelo app e
 *   marcada com `appProperties.kind = "shared"`. Ela é compartilhada pelo
 *   Google Drive (permissão de edição) com as pessoas convidadas, então todos
 *   leem e gravam a mesma planilha.
 *
 * A área ativa fica guardada no navegador (por usuário Google).
 */
import { GoogleApiError, googleFetch } from "./google";
import {
  APP_PROPERTY_KEY,
  APP_PROPERTY_VALUE,
  DRIVE_API,
  SHARED_KIND,
  SPREADSHEET_TITLE,
} from "./sheetStore";

export type WorkspaceKind = "personal" | "shared";

export type WorkspaceRef = {
  /** Id da planilha no Google Drive. */
  id: string;
  name: string;
  kind: WorkspaceKind;
  ownedByMe: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  url: string;
};

type DriveFile = {
  id: string;
  name: string;
  ownedByMe?: boolean;
  owners?: { displayName?: string; emailAddress?: string }[];
  appProperties?: Record<string, string>;
};

const FILE_FIELDS = "id,name,ownedByMe,owners(displayName,emailAddress),appProperties";
const ACTIVE_KEY = "fd.activeWorkspace";

export const PERSONAL_WORKSPACE_NAME = "Pessoal";

const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

export function toWorkspaceRef(file: DriveFile): WorkspaceRef {
  const shared = file.appProperties?.kind === SHARED_KIND;
  return {
    id: file.id,
    name: shared
      ? file.appProperties?.workspaceName || file.name
      : PERSONAL_WORKSPACE_NAME,
    kind: shared ? "shared" : "personal",
    ownedByMe: file.ownedByMe !== false,
    ownerName: file.owners?.[0]?.displayName ?? null,
    ownerEmail: file.owners?.[0]?.emailAddress ?? null,
    url: sheetUrl(file.id),
  };
}

// ─── Área ativa (guardada no navegador) ──────────────────────────────────────

export function getActiveWorkspaceId(sub: string): string | null {
  try {
    return localStorage.getItem(`${ACTIVE_KEY}.${sub}`);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(sub: string, id: string | null) {
  try {
    if (id) localStorage.setItem(`${ACTIVE_KEY}.${sub}`, id);
    else localStorage.removeItem(`${ACTIVE_KEY}.${sub}`);
  } catch {
    // sem armazenamento: a escolha vale só até recarregar a página
  }
}

// ─── Drive ───────────────────────────────────────────────────────────────────

/** Metadados da planilha. Lança `GoogleApiError` 404 se o app não tiver acesso. */
export async function getWorkspaceFile(id: string): Promise<WorkspaceRef> {
  const file = await googleFetch<DriveFile & { trashed?: boolean }>(
    `${DRIVE_API}/${encodeURIComponent(id)}?fields=${FILE_FIELDS},trashed`
  );
  if (file.trashed) throw new GoogleApiError("A área de trabalho foi excluída.", 404);
  if (file.appProperties?.[APP_PROPERTY_KEY] !== APP_PROPERTY_VALUE) {
    throw new GoogleApiError("Esta planilha não é uma área do Financeiro Doméstico.", 400);
  }
  return toWorkspaceRef(file);
}

/** Áreas compartilhadas que o app consegue abrir (criadas aqui ou liberadas no Picker). */
export async function listSharedWorkspaces(): Promise<WorkspaceRef[]> {
  const q =
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }` +
    ` and appProperties has { key='kind' and value='${SHARED_KIND}' }` +
    ` and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const list = await googleFetch<{ files: DriveFile[] }>(
    `${DRIVE_API}?${new URLSearchParams({
      q,
      spaces: "drive",
      orderBy: "name",
      fields: `files(${FILE_FIELDS})`,
      pageSize: "100",
    })}`
  );
  return list.files.map(toWorkspaceRef);
}

export async function createSharedWorkspaceFile(name: string): Promise<WorkspaceRef> {
  const file = await googleFetch<DriveFile>(`${DRIVE_API}?fields=${FILE_FIELDS}`, {
    method: "POST",
    body: JSON.stringify({
      name: `${SPREADSHEET_TITLE} — ${name}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      appProperties: {
        [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE,
        kind: SHARED_KIND,
        workspaceName: name,
      },
    }),
  });
  return toWorkspaceRef(file);
}

export async function renameWorkspaceFile(id: string, name: string): Promise<WorkspaceRef> {
  const file = await googleFetch<DriveFile>(
    `${DRIVE_API}/${encodeURIComponent(id)}?fields=${FILE_FIELDS}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: `${SPREADSHEET_TITLE} — ${name}`,
        appProperties: { workspaceName: name },
      }),
    }
  );
  return toWorkspaceRef(file);
}

/** Dá permissão de edição na planilha e o Google envia um e-mail com a mensagem. */
export async function shareWorkspaceFile(id: string, email: string, message: string) {
  await googleFetch(
    `${DRIVE_API}/${encodeURIComponent(id)}/permissions?${new URLSearchParams({
      sendNotificationEmail: "true",
      emailMessage: message,
    })}`,
    {
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
    }
  );
}

/** Remove a permissão de uma pessoa na planilha (se existir). */
export async function unshareWorkspaceFile(id: string, email: string) {
  const res = await googleFetch<{ permissions: { id: string; emailAddress?: string; role: string }[] }>(
    `${DRIVE_API}/${encodeURIComponent(id)}/permissions?fields=permissions(id,emailAddress,role)`
  );
  const target = res.permissions.find(
    p => p.emailAddress?.toLowerCase() === email.toLowerCase() && p.role !== "owner"
  );
  if (!target) return;
  await googleFetch(
    `${DRIVE_API}/${encodeURIComponent(id)}/permissions/${target.id}`,
    { method: "DELETE" }
  );
}

// ─── Excluir / sair de áreas ─────────────────────────────────────────────────

const HIDDEN_KEY = "fd.hiddenWorkspaces";

/**
 * Áreas compartilhadas que o usuário tirou da lista (saiu de uma área de outra
 * pessoa, ou excluiu e o Drive ainda a devolve na busca). Por usuário Google.
 */
export function getHiddenWorkspaceIds(sub: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${HIDDEN_KEY}.${sub}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function setWorkspaceHidden(sub: string, id: string, hidden: boolean) {
  const ids = getHiddenWorkspaceIds(sub);
  if (hidden) ids.add(id);
  else ids.delete(id);
  try {
    localStorage.setItem(`${HIDDEN_KEY}.${sub}`, JSON.stringify(Array.from(ids)));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

/** Manda a planilha da área para a lixeira do Drive (recuperável por 30 dias). */
export async function trashWorkspaceFile(id: string) {
  await googleFetch(`${DRIVE_API}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
}

/** Link que a pessoa convidada abre para entrar na área. */
export function joinLink(id: string) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/join/${id}`;
}
