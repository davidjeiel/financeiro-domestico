import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getOrCreateCurrentCompetency,
  getUserCompetencies,
  getUserCreditCards,
  createCreditCard,
  getCompetencyTransactions,
  createTransaction,
  getCompetencyInvoices,
  createTypology,
  getTypologiesByUser,
  getTypologiesByUserAndType,
  updateTypology,
  deleteTypology,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  competency: router({
    current: protectedProcedure.query(({ ctx }) =>
      getOrCreateCurrentCompetency(ctx.user.id)
    ),
    list: protectedProcedure.query(({ ctx }) =>
      getUserCompetencies(ctx.user.id)
    ),
  }),

  creditCard: router({
    list: protectedProcedure.query(({ ctx }) =>
      getUserCreditCards(ctx.user.id)
    ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          lastDigits: z.string().optional(),
          cutoffDay: z.number().min(1).max(31),
          dueDay: z.number().min(1).max(31),
          limit: z.string().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createCreditCard({
          userId: ctx.user.id,
          ...input,
        })
      ),
  }),

  transaction: router({
    list: protectedProcedure
      .input(z.object({ competencyId: z.number() }))
      .query(({ input }) =>
        getCompetencyTransactions(input.competencyId)
      ),
    create: protectedProcedure
      .input(
        z.object({
          competencyId: z.number(),
          creditCardId: z.number().optional(),
          type: z.enum(["income", "expense", "credit_card"]),
          category: z.string().min(1),
          description: z.string().optional(),
          amount: z.string(),
          transactionDate: z.date(),
          dueDate: z.date().optional(),
          installments: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createTransaction({
          userId: ctx.user.id,
          ...input,
        })
      ),
  }),

  invoice: router({
    list: protectedProcedure
      .input(z.object({ competencyId: z.number() }))
      .query(({ input }) =>
        getCompetencyInvoices(input.competencyId)
      ),
  }),

  typology: router({
    list: protectedProcedure.query(({ ctx }) =>
      getTypologiesByUser(ctx.user.id)
    ),
    listByType: protectedProcedure
      .input(z.object({ type: z.enum(["income", "expense", "credit_card"]) }))
      .query(({ ctx, input }) =>
        getTypologiesByUserAndType(ctx.user.id, input.type)
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          type: z.enum(["income", "expense", "credit_card"]),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createTypology({
          userId: ctx.user.id,
          name: input.name,
          type: input.type,
          description: input.description,
          icon: input.icon,
          color: input.color,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateTypology(input.id, {
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
        })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        deleteTypology(input.id)
      ),
  }),
});

export type AppRouter = typeof appRouter;
