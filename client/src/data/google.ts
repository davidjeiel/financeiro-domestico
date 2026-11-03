/**
 * Autenticação Google direto no navegador (Google Identity Services) e um
 * `fetch` autenticado para as APIs do Google.
 *
 * O token de acesso é obtido pelo fluxo de token do GIS (sem backend) e fica
 * guardado no localStorage até expirar (~1h). Quando expira, um novo token é
 * pedido silenciosamente; se não for possível, o usuário volta à tela de login.
 */
import { UNAUTHED_ERR_MSG } from "@shared/const";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SCOPES = ["openid", "email", "profile", DRIVE_FILE_SCOPE].join(" ");
const SESSION_KEY = "fd.google.session";

type TokenResponse = {
  access_token: string;
  expires_in: number | string;
  scope: string;
  error?: string;
  error_description?: string;
};

type TokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    login_hint?: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes: (resp: TokenResponse, ...scopes: string[]) => boolean;
  revoke: (token: string, done?: () => void) => void;
};

// `window.google` também é declarado por @types/google.maps; aqui só usamos o GIS.
const gis = () =>
  (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }).google
    ?.accounts?.oauth2;

type Session = {
  accessToken: string;
  expiresAt: number;
  /** E-mail usado como dica para renovar o token silenciosamente. */
  hint?: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export class GoogleAuthError extends Error {
  constructor(message = UNAUTHED_ERR_MSG) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function isGoogleConfigured() {
  return Boolean(clientId);
}

// ─── Sessão persistida ───────────────────────────────────────────────────────

let session: Session | null = readSession();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Armazenamento indisponível (aba anônima etc.): a sessão vale só nesta aba.
  }
}

export function hasSession() {
  return session !== null;
}

export function setSessionHint(email: string) {
  if (session) writeSession({ ...session, hint: email });
}

// ─── Google Identity Services ────────────────────────────────────────────────

let gisPromise: Promise<void> | null = null;

/** Carrega o script do GIS. Chamado cedo para o popup abrir no clique. */
export function loadGoogleIdentity(): Promise<void> {
  if (gis()) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error("Não foi possível carregar o login do Google"));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

async function requestToken(prompt: "" | "consent" | "select_account", hint?: string) {
  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID não configurado. Veja o README.");
  }
  await loadGoogleIdentity();
  const oauth2 = gis()!;

  const resp = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt,
      login_hint: hint,
      callback: r =>
        r.error ? reject(new Error(r.error_description || r.error)) : resolve(r),
      error_callback: err =>
        reject(
          new Error(
            err.type === "popup_closed"
              ? "Login cancelado"
              : err.message || "Falha no login com Google"
          )
        ),
    });
    client.requestAccessToken();
  });

  if (!oauth2.hasGrantedAllScopes(resp, DRIVE_FILE_SCOPE)) {
    throw new Error(
      "É necessário permitir o acesso ao Google Drive para salvar seus dados na planilha."
    );
  }

  writeSession({
    accessToken: resp.access_token,
    expiresAt: Date.now() + Number(resp.expires_in) * 1000,
    hint: hint ?? session?.hint,
  });
  return resp.access_token;
}

/** Abre o popup de login do Google. Deve ser chamado a partir de um clique. */
export async function signIn() {
  await requestToken("select_account");
}

export function signOut() {
  const token = session?.accessToken;
  writeSession(null);
  if (token) gis()?.revoke(token);
}

let refreshing: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (!session) throw new GoogleAuthError();
  if (session.expiresAt - 60_000 > Date.now()) return session.accessToken;

  if (!refreshing) {
    refreshing = requestToken("", session.hint)
      .catch(() => {
        writeSession(null);
        throw new GoogleAuthError();
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// ─── Chamadas às APIs ────────────────────────────────────────────────────────

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/** `fetch` com o token do usuário. Retorna o JSON da resposta. */
export async function googleFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 && retry && session) {
    // Token revogado ou expirado antes do previsto: força renovação.
    writeSession({ ...session, expiresAt: 0 });
    return googleFetch<T>(url, init, false);
  }
  if (res.status === 401) {
    writeSession(null);
    throw new GoogleAuthError();
  }
  if (!res.ok) {
    let message = `Erro ${res.status} na API do Google`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      // corpo não é JSON
    }
    throw new GoogleApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getProfile() {
  return googleFetch<GoogleProfile>("https://www.googleapis.com/oauth2/v3/userinfo");
}
