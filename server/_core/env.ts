const isProd = process.env.NODE_ENV === "production";

/** Variável obrigatória — avisa em produção se ausente */
function required(key: string, fallback = ""): string {
  const value = process.env[key] ?? fallback;
  if (isProd && !value) {
    console.warn(`[ENV] WARNING: ${key} is not set in production`);
  }
  return value;
}

/** Variável opcional — sem aviso mesmo em produção */
function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const ENV = {
  appId: optional("VITE_APP_ID", "financeiro-local"),
  cookieSecret: required("JWT_SECRET", "dev-secret-change-in-production"),
  databaseUrl: required("DATABASE_URL"),
  oAuthServerUrl: optional("OAUTH_SERVER_URL"),
  ownerOpenId: optional("OWNER_OPEN_ID"),
  isProduction: isProd,
  forgeApiUrl: optional("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optional("BUILT_IN_FORGE_API_KEY"),

  get localLoginEnabled(): boolean {
    const explicit = process.env.LOCAL_LOGIN_ENABLED;
    if (explicit === "false") return false;
    if (explicit === "true") return true;
    // Habilitado automaticamente em desenvolvimento
    return !isProd;
  },

  get localLoginPassword(): string {
    return process.env.LOCAL_LOGIN_PASSWORD ?? "admin123";
  },
};
