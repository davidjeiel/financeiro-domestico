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
  getUserTransactionsByDateRange,
  getCalendarEventsForYear,
  createTransaction,
  createRecurringTransactions,
  getTransactionById,
  createInstallmentTransactions,
  resolveCompetencyForCreate,
  addInvoicePayment,
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
  addTransactionResponsibility,
  getTransactionResponsibilities,
  removeTransactionResponsibility,
  logAuditAction,
  getAuditLogByWorkspace,
  updateUserTimezone,
  getUserTimezone,
  listPeople,
  addGuestPerson,
  upsertInvitedPerson,
  updatePerson,
  removePerson,
  assertResponsible,
} from "./db";
import {
  getActiveWorkspace,
  getDataUserId,
  getPersonalWorkspaceId,
  getSpreadsheetUrl,
  getStore,
  reload,
  signOut,
  switchWorkspace,
} from "./session";
import {
  allocationTotals,
  allocationsOf,
  incomeOptions,
  setAllocations,
} from "./allocations";
import {
  createSharedWorkspaceFile,
  joinLink,
  listSharedWorkspaces,
  renameWorkspaceFile,
  shareWorkspaceFile,
  unshareWorkspaceFile,
  type WorkspaceRef,
} from "./workspaces";

const dateOnlySchema = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data inválida");

const recurringTransactionSchema = z
  .object({
    type: z.enum(["income", "expense", "credit_card"]),
    category: z.string().min(1),
    description: z.string().optional(),
    amount: z.string().refine(value => Number.isFinite(Number(value)) && Number(value) > 0),
    creditCardId: z.number().optional(),
    notes: z.string().optional(),
    frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual"]),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    responsibleUserId: z.number().int().nullable().optional(),
  })
  .superRefine((input, context) => {
    if (input.endDate < input.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "A data limite deve ser igual ou posterior à data inicial.",
      });
    }
    if (input.type === "credit_card" && !input.creditCardId) {
      context.addIssue({
        code: "custom",
        path: ["creditCardId"],
        message: "Selecione um cartão de crédito.",
      });
    }
  });

const allocationLinkSchema = z.object({
  incomeId: z.number().int(),
  amount: z
    .string()
    .refine(value => Number.isFinite(Number(value)) && Number(value) > 0, "Valor inválido"),
});

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
    updateTimezone: protectedProcedure
      .input(z.object({ timezone: z.string().min(1) }))
      .mutation(({ ctx, input }) =>
        updateUserTimezone(ctx.user.id, input.timezone)
      ),
    getTimezone: protectedProcedure.query(({ ctx }) =>
      getUserTimezone(ctx.user.id)
    ),
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
      getOrCreateCurrentCompetency(getDataUserId())
    ),
    list: protectedProcedure.query(({ ctx }) =>
      getUserCompetencies(getDataUserId())
    ),
    getByYearMonth: protectedProcedure
      .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .query(({ ctx, input }) =>
        getOrCreateCompetencyByYearMonth(getDataUserId(), input.year, input.month)
      ),
  }),

  calendar: router({
    eventsForYear: protectedProcedure
      .input(z.object({ year: z.number().int() }))
      .query(({ ctx, input }) =>
        getCalendarEventsForYear(getDataUserId(), input.year)
      ),
  }),

  creditCard: router({
    list: protectedProcedure.query(({ ctx }) =>
      getUserCreditCards(getDataUserId())
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
          userId: getDataUserId(),
          ...input,
        })
      ),
  }),

  transaction: router({
    list: protectedProcedure
      .input(
        z.object({
          competencyId: z.number(),
          startDate: dateOnlySchema.optional(),
          endDate: dateOnlySchema.optional(),
        }).superRefine((input, context) => {
          if (input.startDate && input.endDate && input.endDate < input.startDate) {
            context.addIssue({
              code: "custom",
              path: ["endDate"],
              message: "A data final deve ser igual ou posterior à data inicial.",
            });
          }
        })
      )
      .query(({ ctx, input }) =>
        input.startDate || input.endDate
          ? getUserTransactionsByDateRange(getDataUserId(), input.startDate, input.endDate)
          : getCompetencyTransactions(input.competencyId)
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
          transactionDate: z.string(), // Formato YYYY-MM-DD
          dueDate: z.string().optional(), // Formato YYYY-MM-DD
          installments: z.number().optional(),
          notes: z.string().optional(),
          responsibleUserId: z.number().int().nullable().optional(),
          // Receitas que pagam esta despesa (opcional).
          incomeLinks: z.array(allocationLinkSchema).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertResponsible(input.responsibleUserId);
        const { incomeLinks, ...txInput } = input;
        // Converter strings YYYY-MM-DD para Date (meia-noite local)
        const [year, month, day] = input.transactionDate.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day);
        
        const dueDate = input.dueDate ? (() => {
          const [y, m, d] = input.dueDate.split('-').map(Number);
          return new Date(y, m - 1, d);
        })() : undefined;
        
        // Compra no cartão vai para a fatura certa pelo dia de fechamento.
        const competencyId = resolveCompetencyForCreate(
          getDataUserId(),
          input.type,
          input.creditCardId,
          transactionDate,
          input.competencyId
        );
        const tx = await createTransaction({
          userId: getDataUserId(),
          ...txInput,
          competencyId,
          transactionDate,
          dueDate,
          // Sem responsável informado, fica com quem lançou.
          responsibleUserId:
            input.responsibleUserId === undefined ? ctx.user.id : input.responsibleUserId,
          createdBy: ctx.user.id,
        });
        if (incomeLinks?.length) {
          const s = getStore();
          try {
            setAllocations(s, tx.id, incomeLinks, ctx.user.id);
            await s.commit();
          } catch (error) {
            // Vínculo inválido: desfaz o lançamento para não ficar pela metade.
            await deleteTransaction(tx.id);
            throw error;
          }
        }
        if (input.type === "credit_card" && input.creditCardId) {
          await upsertInvoiceForCreditCard(getDataUserId(), input.creditCardId, competencyId);
        }
        return tx;
      }),
    /** Compra/despesa parcelada: uma parcela por mês, com o valor total dividido. */
    createInstallments: protectedProcedure
      .input(
        z
          .object({
            type: z.enum(["expense", "credit_card"]),
            category: z.string().min(1),
            description: z.string().optional(),
            totalAmount: z
              .string()
              .refine(v => Number.isFinite(Number(v)) && Number(v) > 0, "Valor inválido"),
            installments: z.number().int().min(2, "Mínimo de 2 parcelas").max(72),
            firstDate: dateOnlySchema,
            creditCardId: z.number().optional(),
            notes: z.string().optional(),
            responsibleUserId: z.number().int().nullable().optional(),
          })
          .refine(v => v.type !== "credit_card" || !!v.creditCardId, {
            message: "Selecione um cartão de crédito.",
            path: ["creditCardId"],
          })
      )
      .mutation(({ ctx, input }) => {
        assertResponsible(input.responsibleUserId);
        const [y, m, d] = input.firstDate.split("-").map(Number);
        return createInstallmentTransactions(getDataUserId(), {
          ...input,
          firstDate: new Date(y, m - 1, d),
          responsibleUserId:
            input.responsibleUserId === undefined ? ctx.user.id : input.responsibleUserId,
          createdBy: ctx.user.id,
        });
      }),
    createRecurring: protectedProcedure
      .input(recurringTransactionSchema)
      .mutation(({ ctx, input }) => {
        assertResponsible(input.responsibleUserId);
        const toLocalDate = (value: string) => {
          const [year, month, day] = value.split("-").map(Number);
          return new Date(year, month - 1, day);
        };

        return createRecurringTransactions(getDataUserId(), {
          ...input,
          startDate: toLocalDate(input.startDate),
          endDate: toLocalDate(input.endDate),
          responsibleUserId:
            input.responsibleUserId === undefined ? ctx.user.id : input.responsibleUserId,
          createdBy: ctx.user.id,
        });
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
          transactionDate: z.string().optional(), // Formato YYYY-MM-DD
          dueDate: z.string().optional(), // Formato YYYY-MM-DD
          installments: z.number().optional(),
          notes: z.string().optional(),
          responsibleUserId: z.number().int().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        assertResponsible(input.responsibleUserId);
        const { id, transactionDate, dueDate, ...rest } = input;
        
        const updates: any = { ...rest };
        
        if (transactionDate) {
          const [year, month, day] = transactionDate.split('-').map(Number);
          updates.transactionDate = new Date(year, month - 1, day);
        }
        
        if (dueDate) {
          const [y, m, d] = dueDate.split('-').map(Number);
          updates.dueDate = new Date(y, m - 1, d);
        }
        
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
        syncInvoicesForCompetency(getDataUserId(), input.competencyId)
      ),
    pay: protectedProcedure
      .input(z.object({ invoiceId: z.number(), paidAmount: z.number().min(0) }))
      .mutation(({ input }) =>
        updateInvoicePayment(input.invoiceId, input.paidAmount)
      ),
    /** Todas as faturas da área (para agrupar as compras na lista de lançamentos). */
    listAll: protectedProcedure.query(() =>
      getStore().select("invoices", i => i.userId === getDataUserId())
    ),
    /**
     * Registra um pagamento (parcial ou total) da fatura de um cartão numa
     * competência. Cria a fatura se ainda não existir.
     */
    addPayment: protectedProcedure
      .input(
        z.object({
          creditCardId: z.number().int(),
          competencyId: z.number().int(),
          amount: z.number().positive("Informe um valor maior que zero"),
        })
      )
      .mutation(({ input }) =>
        addInvoicePayment(getDataUserId(), input.creditCardId, input.competencyId, input.amount)
      ),
  }),

  typology: router({
    list: protectedProcedure.query(({ ctx }) =>
      getTypologiesByUser(getDataUserId())
    ),
    listByType: protectedProcedure
      .input(z.object({ type: z.enum(["income", "expense", "credit_card"]) }))
      .query(({ ctx, input }) =>
        getTypologiesByUserAndType(getDataUserId(), input.type)
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
          userId: getDataUserId(),
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
      getSavedFilters(getDataUserId())
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
        createSavedFilter(getDataUserId(), input)
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
        deleteAllSavedFilters(getDataUserId())
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
      getUserAccounts(getDataUserId())
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
          userId: getDataUserId(),
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
    /** Área pessoal + áreas compartilhadas acessíveis, com a ativa marcada. */
    list: protectedProcedure.query(async () => {
      const active = getActiveWorkspace();
      const personalId = getPersonalWorkspaceId();
      const shared = await listSharedWorkspaces();
      const personal: WorkspaceRef | null = personalId
        ? {
            id: personalId,
            name: "Pessoal",
            kind: "personal",
            ownedByMe: true,
            ownerName: null,
            ownerEmail: null,
            url: `https://docs.google.com/spreadsheets/d/${personalId}/edit`,
          }
        : null;
      // A ativa pode ainda não aparecer na busca do Drive logo após ser liberada.
      if (active?.kind === "shared" && !shared.some(w => w.id === active.id)) {
        shared.unshift(active);
      }
      return {
        activeId: active?.id ?? personalId,
        workspaces: [...(personal ? [personal] : []), ...shared].map(w => ({
          ...w,
          isActive: w.id === (active?.id ?? personalId),
        })),
      };
    }),
    active: protectedProcedure.query(({ ctx }) => {
      const active = getActiveWorkspace();
      return active
        ? { ...active, meId: ctx.user.id, joinLink: active.kind === "shared" ? joinLink(active.id) : null }
        : null;
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1, "Informe um nome").max(80) }))
      .mutation(async ({ input }) => {
        const file = await createSharedWorkspaceFile(input.name);
        return switchWorkspace(file.id);
      }),
    renameActive: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(80) }))
      .mutation(async ({ input }) => {
        const active = getActiveWorkspace();
        if (!active || active.kind !== "shared") {
          throw new Error("Só é possível renomear áreas compartilhadas.");
        }
        await renameWorkspaceFile(active.id, input.name);
        await reload();
        return getActiveWorkspace();
      }),
    /** Troca a área ativa. `id` nulo volta para a área pessoal. */
    switch: protectedProcedure
      .input(z.object({ id: z.string().min(1).nullable() }))
      .mutation(({ input }) => switchWorkspace(input.id)),
  }),

  allocation: router({
    /** Total vinculado de cada lançamento (coberto, nas despesas; comprometido, nas receitas). */
    totals: protectedProcedure.query(() =>
      Object.fromEntries(Array.from(allocationTotals(getStore()).entries()).map(([id, c]) => [id, (c / 100).toFixed(2)]))
    ),
    forTransaction: protectedProcedure
      .input(z.object({ transactionId: z.number().int() }))
      .query(({ input }) => allocationsOf(getStore(), input.transactionId)),
    incomeOptions: protectedProcedure
      .input(z.object({ expenseId: z.number().int().optional() }))
      .query(({ input }) => incomeOptions(getStore(), getDataUserId(), input.expenseId)),
    /** Substitui as receitas vinculadas a uma despesa. Lista vazia remove os vínculos. */
    set: protectedProcedure
      .input(z.object({ expenseId: z.number().int(), links: z.array(allocationLinkSchema) }))
      .mutation(async ({ ctx, input }) => {
        const s = getStore();
        setAllocations(s, input.expenseId, input.links, ctx.user.id);
        await s.commit();
        return allocationsOf(s, input.expenseId);
      }),
  }),

  people: router({
    list: protectedProcedure.query(({ ctx }) =>
      listPeople().map(p => ({ ...p, isMe: p.id === ctx.user.id }))
    ),
    addGuest: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Informe um nome").max(60),
          color: z.string().optional(),
        })
      )
      .mutation(({ input }) => addGuestPerson(input.name, input.color)),
    invite: protectedProcedure
      .input(
        z.object({
          email: z.string().trim().email("E-mail inválido"),
          name: z.string().trim().max(60).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const active = getActiveWorkspace();
        if (!active || active.kind !== "shared") {
          throw new Error(
            "Convites só podem ser feitos em uma área de trabalho compartilhada. Crie uma em Áreas de trabalho."
          );
        }
        const person = await upsertInvitedPerson(input.email, input.name);
        const inviter = ctx.user.name || ctx.user.email || "Alguém";
        await shareWorkspaceFile(
          active.id,
          input.email,
          `${inviter} convidou você para a área "${active.name}" no Financeiro Doméstico. ` +
            `Para entrar, abra: ${joinLink(active.id)}`
        );
        await logAuditAction({
          workspaceId: 0,
          userId: ctx.user.id,
          action: "invite_person",
          entityType: "user",
          entityId: person.id,
          changes: JSON.stringify({ email: input.email }),
        });
        return { person, joinLink: joinLink(active.id) };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          name: z.string().trim().min(1).max(60).optional(),
          color: z.string().optional(),
        })
      )
      .mutation(({ input }) => updatePerson(input.id, input)),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.user.id) throw new Error("Você não pode remover a si mesmo.");
        if (input.id === getDataUserId()) {
          throw new Error("O dono da área de trabalho não pode ser removido.");
        }
        const person = getStore().find("users", u => u.id === input.id);
        const active = getActiveWorkspace();
        if (person?.email && active?.kind === "shared" && person.status !== "guest") {
          await unshareWorkspaceFile(active.id, person.email);
        }
        return removePerson(input.id);
      }),
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
