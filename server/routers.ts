import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getOrCreateCurrentCompetency,
  getOrCreateCompetencyByYearMonth,
  getUserCompetencies,
  getUserCreditCards,
  createCreditCard,
  getCompetencyTransactions,
  createTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getCompetencyInvoices,
  upsertInvoiceForCreditCard,
  syncInvoicesForCompetency,
  createTypology,
  getTypologiesByUser,
  getTypologiesByUserAndType,
  updateTypology,
  deleteTypology,
  updateUserGoogleSheets,
  getUserGoogleSheetsConfig,
  disconnectGoogleSheets,
  getSavedFilters,
  createSavedFilter,
  getSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
  deleteAllSavedFilters,
  getTransactionLinks,
  addTransactionLink,
  updateTransactionLink,
  deleteTransactionLink,
  setTransactionLinks,
  TransactionLink,
  createAccount,
  getUserAccounts,
  getAccountById,
  updateAccount,
  updateAccountBalance,
  deleteAccount,
} from "./db";
import { GoogleSheetsManager } from "./googleSheetsIntegration";

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
    getByYearMonth: protectedProcedure
      .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .query(({ ctx, input }) =>
        getOrCreateCompetencyByYearMonth(ctx.user.id, input.year, input.month)
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
    listWithFilters: protectedProcedure
      .input(
        z.object({
          competencyId: z.number(),
          category: z.string().optional(),
          type: z.enum(["income", "expense", "credit_card"]).optional(),
          creditCardId: z.number().optional(),
          description: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const transactions = await getCompetencyTransactions(input.competencyId);
        
        return transactions.filter((tx) => {
          if (input.category && tx.category !== input.category) return false;
          if (input.type && tx.type !== input.type) return false;
          if (input.creditCardId && tx.creditCardId !== input.creditCardId) return false;
          if (input.description && !tx.description?.toLowerCase().includes(input.description.toLowerCase())) return false;
          return true;
        });
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) =>
        getTransactionById(input.id)
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
      .mutation(async ({ ctx, input }) => {
        const tx = await createTransaction({ userId: ctx.user.id, ...input });
        if (input.type === "credit_card" && input.creditCardId) {
          await upsertInvoiceForCreditCard(ctx.user.id, input.creditCardId, input.competencyId);
        }
        return tx;
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          competencyId: z.number().optional(),
          creditCardId: z.number().optional(),
          type: z.enum(["income", "expense", "credit_card"]).optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          amount: z.string().optional(),
          transactionDate: z.date().optional(),
          dueDate: z.date().optional(),
          installments: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateTransaction(id, updates);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        deleteTransaction(input.id)
      ),
    markAsPaid: protectedProcedure
      .input(z.object({ id: z.number(), isPaid: z.boolean() }))
      .mutation(({ input }) => {
        const paidDate = input.isPaid ? new Date() : null;
        return updateTransaction(input.id, {
          isPaid: input.isPaid ? 1 : 0,
          paidDate,
        });
      }),
  }),

  invoice: router({
    list: protectedProcedure
      .input(z.object({ competencyId: z.number() }))
      .query(({ input }) =>
        getCompetencyInvoices(input.competencyId)
      ),
    sync: protectedProcedure
      .input(z.object({ competencyId: z.number() }))
      .mutation(({ ctx, input }) =>
        syncInvoicesForCompetency(ctx.user.id, input.competencyId)
      ),
  }),

  googleSheets: router({
    config: protectedProcedure.query(({ ctx }) =>
      getUserGoogleSheetsConfig(ctx.user.id)
    ),
    connect: protectedProcedure
      .input(
        z.object({
          googleSheetsId: z.string().min(1),
          accessToken: z.string().min(1),
          refreshToken: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        updateUserGoogleSheets(
          ctx.user.id,
          input.googleSheetsId,
          input.accessToken,
          input.refreshToken
        )
      ),
    disconnect: protectedProcedure.mutation(({ ctx }) =>
      disconnectGoogleSheets(ctx.user.id)
    ),
    syncTransactions: protectedProcedure
      .input(
        z.object({
          googleSheetsId: z.string().min(1),
          accessToken: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const competencies = await getUserCompetencies(ctx.user.id);
          const allTransactions: any[] = [];
          
          for (const competency of competencies) {
            const transactions = await getCompetencyTransactions(competency.id);
            allTransactions.push(...transactions);
          }

          const manager = new GoogleSheetsManager(input.accessToken);
          const headers = ['ID', 'Data', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Competencia'];
          const data = [
            headers,
            ...allTransactions.map(t => [
              t.id,
              new Date(t.transactionDate).toLocaleDateString('pt-BR'),
              t.description || '',
              t.category,
              t.type,
              t.amount,
              t.competencyId,
            ]),
          ];

          await manager.writeSheetData(input.googleSheetsId, 'Transacoes!A1', data);
          
          return { success: true, message: 'Transacoes sincronizadas com sucesso!' };
        } catch (error: any) {
          console.error('Erro ao sincronizar transacoes:', error);
          throw new Error(`Erro ao sincronizar: ${error.message}`);
        }
      }),
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
          parentId: z.number().optional(),
          links: z.string().optional(),
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
          parentId: input.parentId,
          links: input.links,
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
          parentId: z.number().optional(),
          links: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateTypology(input.id, {
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
          parentId: input.parentId,
          links: input.links,
        })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        deleteTypology(input.id)
      ),
  }),

  savedFilter: router({
    list: protectedProcedure.query(({ ctx }) =>
      getSavedFilters(ctx.user.id)
    ),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) =>
        getSavedFilter(input.id)
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          categories: z.array(z.string()).optional(),
          types: z.array(z.enum(["income", "expense", "credit_card"])).optional(),
          minAmount: z.number().optional(),
          maxAmount: z.number().optional(),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createSavedFilter(ctx.user.id, input)
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          categories: z.array(z.string()).optional(),
          types: z.array(z.enum(["income", "expense", "credit_card"])).optional(),
          minAmount: z.number().optional(),
          maxAmount: z.number().optional(),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateSavedFilter(id, updates);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        deleteSavedFilter(input.id)
      ),
    deleteAll: protectedProcedure
      .mutation(({ ctx }) =>
        deleteAllSavedFilters(ctx.user.id)
      ),
  }),

  transactionLinks: router({
    list: protectedProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(({ input }) =>
        getTransactionLinks(input.transactionId)
      ),
    add: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          link: z.object({
            url: z.string().url("URL inválida"),
            title: z.string().optional(),
            description: z.string().optional(),
          }),
        })
      )
      .mutation(({ input }) =>
        addTransactionLink(input.transactionId, input.link)
      ),
    update: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          linkIndex: z.number(),
          link: z.object({
            url: z.string().url("URL inválida"),
            title: z.string().optional(),
            description: z.string().optional(),
          }),
        })
      )
      .mutation(({ input }) =>
        updateTransactionLink(input.transactionId, input.linkIndex, input.link)
      ),
    delete: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          linkIndex: z.number(),
        })
      )
      .mutation(({ input }) =>
        deleteTransactionLink(input.transactionId, input.linkIndex)
      ),
    setAll: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          links: z.array(
            z.object({
              url: z.string().url("URL inválida"),
              title: z.string().optional(),
              description: z.string().optional(),
            })
          ),
        })
      )
      .mutation(({ input }) =>
        setTransactionLinks(input.transactionId, input.links)
      ),
  }),

  account: router({
    list: protectedProcedure.query(({ ctx }) =>
      getUserAccounts(ctx.user.id)
    ),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) =>
        getAccountById(input.id)
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          type: z.enum(["checking", "savings", "investment"]).optional(),
          balance: z.number().optional(),
          initialBalance: z.number().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createAccount({
          userId: ctx.user.id,
          name: input.name,
          type: input.type || "checking",
          balance: ((input.balance || 0).toString()) as any,
          initialBalance: ((input.initialBalance || 0).toString()) as any,
          color: input.color || "#3B82F6",
          isActive: 1,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          type: z.enum(["checking", "savings", "investment"]).optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateAccount(id, updates);
      }),
    updateBalance: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          balance: z.number(),
        })
      )
      .mutation(({ input }) =>
        updateAccountBalance(input.id, input.balance)
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        deleteAccount(input.id)
      ),
  }),
});

export type AppRouter = typeof appRouter;
