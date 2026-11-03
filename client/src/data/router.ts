/**
 * Router tRPC executado no próprio navegador (via `unstable_localLink`).
 * Os dados ficam na planilha Google do usuário (ver ./db.ts).
 */
import { publicProcedure, protectedProcedure, router } from "./trpc";
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
  updateInvoicePayment,
  createTypology,
  getTypologiesByUser,
  getTypologiesByUserAndType,
  updateTypology,
  deleteTypology,
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
  createAccount,
  getUserAccounts,
  getAccountById,
  updateAccount,
  updateAccountBalance,
  deleteAccount,
  createWorkspace,
  getWorkspacesByUser,
  getWorkspaceById,
  updateWorkspace,
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  createWorkspaceInvite,
  getWorkspaceInviteByToken,
  getPendingInvitesByEmail,
  acceptWorkspaceInvite,
  createSharedAccount,
  getSharedAccountsByWorkspace,
  addTransactionResponsibility,
  getTransactionResponsibilities,
  removeTransactionResponsibility,
  logAuditAction,
  getAuditLogByWorkspace,
} from "./db";
import { getSpreadsheetUrl, reload, signOut } from "./session";

function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      signOut();
      return {
        success: true,
      } as const;
    }),
  }),

  spreadsheet: router({
    info: protectedProcedure.query(() => ({ url: getSpreadsheetUrl() })),
    reload: protectedProcedure.mutation(async () => {
      await reload();
      return { success: true } as const;
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
    pay: protectedProcedure
      .input(z.object({ invoiceId: z.number(), paidAmount: z.number().min(0) }))
      .mutation(({ input }) =>
        updateInvoicePayment(input.invoiceId, input.paidAmount)
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
          balance: (input.balance || 0).toFixed(2),
          initialBalance: (input.initialBalance || 0).toFixed(2),
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
  workspace: router({
    list: protectedProcedure.query(({ ctx }) => getWorkspacesByUser(ctx.user.id)),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getWorkspaceById(input.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(["personal", "family", "business"]),
        })
      )
      .mutation(({ input, ctx }) =>
        createWorkspace({
          ownerId: ctx.user.id,
          name: input.name,
          description: input.description,
          type: input.type as any,
          isActive: 1,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          type: z.enum(["personal", "family", "business"]).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateWorkspace(id, updates as any);
      }),
    members: router({
      list: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .query(({ input }) => getWorkspaceMembers(input.workspaceId)),
      add: protectedProcedure
        .input(
          z.object({
            workspaceId: z.number(),
            email: z.string().email(),
            role: z.enum(["owner", "editor", "viewer"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const token = randomToken();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
          
          await logAuditAction({
            workspaceId: input.workspaceId,
            userId: ctx.user.id,
            action: "invite_member",
            entityType: "workspace",
            entityId: input.workspaceId,
            changes: JSON.stringify({ email: input.email, role: input.role }),
          });
          
          return createWorkspaceInvite({
            workspaceId: input.workspaceId,
            email: input.email,
            token,
            role: input.role as any,
            invitedBy: ctx.user.id,
            expiresAt,
            status: "pending" as any,
          });
        }),
      updateRole: protectedProcedure
        .input(
          z.object({
            memberId: z.number(),
            role: z.enum(["owner", "editor", "viewer"]),
          })
        )
        .mutation(({ input, ctx }) => {
          logAuditAction({
            workspaceId: 0, // TODO: get from member
            userId: ctx.user.id,
            action: "update_member_role",
            entityType: "member",
            entityId: input.memberId,
            changes: JSON.stringify({ role: input.role }),
          });
          return updateWorkspaceMemberRole(input.memberId, input.role);
        }),
      remove: protectedProcedure
        .input(z.object({ memberId: z.number() }))
        .mutation(({ input, ctx }) => {
          logAuditAction({
            workspaceId: 0, // TODO: get from member
            userId: ctx.user.id,
            action: "remove_member",
            entityType: "member",
            entityId: input.memberId,
            changes: JSON.stringify({}),
          });
          return removeWorkspaceMember(input.memberId);
        }),
    }),
    invites: router({
      getPending: protectedProcedure
        .input(z.object({ email: z.string().email() }))
        .query(({ input }) => getPendingInvitesByEmail(input.email)),
      accept: protectedProcedure
        .input(z.object({ token: z.string() }))
        .mutation(async ({ input, ctx }) => {
          const invite = await getWorkspaceInviteByToken(input.token);
          if (!invite) throw new Error("Invite not found or expired");
          if (invite.email !== ctx.user.email) throw new Error("Email mismatch");
          
          return acceptWorkspaceInvite(invite.id, ctx.user.id);
        }),
    }),
  }),
  sharedAccount: router({
    create: protectedProcedure
      .input(
        z.object({
          accountId: z.number(),
          workspaceId: z.number(),
          shareType: z.enum(["individual", "joint", "shared"]),
        })
      )
      .mutation(({ input, ctx }) => {
        logAuditAction({
          workspaceId: input.workspaceId,
          userId: ctx.user.id,
          action: "share_account",
          entityType: "account",
          entityId: input.accountId,
          changes: JSON.stringify({ shareType: input.shareType }),
        });
        return createSharedAccount(input as any);
      }),
    listByWorkspace: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(({ input }) => getSharedAccountsByWorkspace(input.workspaceId)),
  }),
  transactionResponsibility: router({
    add: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          userId: z.number(),
          percentage: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        logAuditAction({
          workspaceId: 0, // TODO: get from transaction
          userId: ctx.user.id,
          action: "add_responsibility",
          entityType: "transaction",
          entityId: input.transactionId,
          changes: JSON.stringify({ userId: input.userId, percentage: input.percentage }),
        });
        return addTransactionResponsibility({
          ...input,
          percentage: input.percentage?.toFixed(2),
        });
      }),
    list: protectedProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(({ input }) => getTransactionResponsibilities(input.transactionId)),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) => {
        logAuditAction({
          workspaceId: 0,
          userId: ctx.user.id,
          action: "remove_responsibility",
          entityType: "responsibility",
          entityId: input.id,
          changes: JSON.stringify({}),
        });
        return removeTransactionResponsibility(input.id);
      }),
  }),
  auditLog: router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.number(), limit: z.number().optional() }))
      .query(({ input }) => getAuditLogByWorkspace(input.workspaceId, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
