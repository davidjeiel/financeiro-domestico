import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { User } from "./schema";
import { ensureRecurrences, getCurrentUser, syncSharedStore } from "./session";

export type TrpcContext = {
  user: User | null;
};

export async function createContext(): Promise<TrpcContext> {
  return { user: await getCurrentUser() };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Os procedimentos rodam no navegador.
  isServer: false,
  allowOutsideOfServer: true,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next, type } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Área compartilhada: pega o que outras pessoas gravaram antes de gravar
  // (e, nas consultas, se a cópia em memória estiver velha).
  await syncSharedStore(type === "mutation");
  await ensureRecurrences();

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
