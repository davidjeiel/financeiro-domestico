import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export function registerLocalLoginRoute(app: Express) {
  if (!ENV.localLoginEnabled) return;

  console.log("[LocalLogin] Enabled — POST /api/local-login");

  app.post("/api/local-login", async (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;

    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Usuário é obrigatório" });
      return;
    }

    if (password !== ENV.localLoginPassword) {
      res.status(401).json({ error: "Senha inválida" });
      return;
    }

    const name = username.trim();
    const openId = `local:${name}`;

    try {
      await db.upsertUser({ openId, name, loginMethod: "local", lastSignedIn: new Date() });

      const sessionToken = await sdk.signSession(
        { openId, appId: ENV.appId, name },
        { expiresInMs: ONE_YEAR_MS }
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) {
      console.error("[LocalLogin] Failed", error);
      res.status(500).json({ error: "Erro interno ao fazer login" });
    }
  });
}
