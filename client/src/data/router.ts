/**
 * Router tRPC executado no próprio navegador (via `unstable_localLink`).
 * Os dados ficam na planilha Google do usuário (ver ./db.ts).
 */
import { matchesDescription } from "../lib/filterCriteria";
import { publicProcedure, protectedProcedure, router } from "./trpc";
import { z } from "zod";
import {
  getOrCreateCurrentCompetency,
  getOrCreateCompetencyByYearMonth,
  getCompetencyConfig,
  previewCompetencyStartDay,
  setCompetencyStartDay,
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
  invoiceDueDateOf,
  invoicesForCard,
  findMisplacedCardPurchases,
  fixMisplacedCardPurchases,
  reorderTransactions,
  setRecurrence,
  syncAllInvoices,
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
  getSignedInProfile,
  getSpreadsheetUrl,
  getStore,
  openOtherWorkspace,
  reload,
  workspaceAccessMessage,
  signOut,
  switchWorkspace,
} from "./session";
import { previewTransfer, transferTransactions } from "./transfer";
import { fixedVsVariableReport, suggestRecurringSeries } from "./fixedExpenses";
import { consolidateWorkspace } from "./allWorkspaces";
import { GoogleApiError } from "./google";
import {
  applyFromOccurrence,
  continueSeries,
  deleteRecurring,
  endRecurrence,
  recurringDeletePreview,
  RECURRING_DELETE_SCOPES,
  listRecurrences,
  materializeRecurrences,
  ruleOfTransaction,
} from "./recurrences";
import {
  allocationTotals,
  allocationsOf,
  incomeOptions,
  setAllocations,
  incomesWithExpenses,
  transactionsPaidBy,
} from "./allocations";
import {
  createSharedWorkspaceFile,
  joinLink,
  getHiddenWorkspaceIds,
  getWorkspaceFile,
  listSharedWorkspaces,
  renameWorkspaceFile,
  setWorkspaceHidden,
  trashWorkspaceFile,
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
    // Sem data final: repete sem fim (ocorrências geradas com 1 ano de antecedência).
    endDate: dateOnlySchema.optional().nullable(),
    responsibleUserId: z.number().int().nullable().optional(),
    /** O valor muda a cada mês: as ocorrências ficam como estimadas até confirmar. */
    variableAmount: z.boolean().optional(),
  })
  .superRefine((input, context) => {
    if (input.endDate && input.endDate < input.startDate) {
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

/**
 * Os ids de lançamento são de cada planilha. Quem vincula informa a área em
 * que estava; se ela não for a ativa (ex.: tela aberta antes de trocar de
 * área), o vínculo é recusado em vez de cair numa receita de mesmo id.
 */
function assertActiveWorkspace(workspaceId: string | undefined) {
  const active = getActiveWorkspace();
  if (workspaceId !== undefined && workspaceId !== active?.id) {
    throw new Error(
      "A área de trabalho mudou desde que esta tela foi aberta. Recarregue e escolha uma receita da área ativa."
    );
  }
}

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

/** Recorrentes: só os selecionados, desta em diante, ou a série toda. */
const seriesScopeSchema = z.enum(["selected", "following", "all"]).default("selected");

/** Área pessoal + áreas compartilhadas acessíveis, com a ativa marcada. */
async function listWorkspacesWithActive() {
  const active = getActiveWorkspace();
  const personalId = getPersonalWorkspaceId();
  const profile = getSignedInProfile();
  const hidden = profile ? getHiddenWorkspaceIds(profile.sub) : new Set<string>();
  // Áreas excluídas ou de que o usuário saiu não aparecem (a ativa sempre aparece).
  const shared = (await listSharedWorkspaces()).filter(w => !hidden.has(w.id) || w.id === active?.id);
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
}

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
/** Critérios de um filtro salvo (ver client/src/lib/filterCriteria.ts). */
const savedFilterCriteriaSchema = z.object({
  startDate: dateInput,
  endDate: dateInput,
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  types: z.array(z.enum(["income", "expense", "credit_card"])).optional(),
  creditCardIds: z.array(z.number().int()).optional(),
  minAmount: z.number().nonnegative().nullable().optional(),
  maxAmount: z.number().nonnegative().nullable().optional(),
});

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
    /** Dia em que a competência começa (1 = mês do calendário). */
    config: protectedProcedure.query(() => getCompetencyConfig(getDataUserId())),
    /** Quantos lançamentos mudariam de competência com outro dia inicial. */
    previewStartDay: protectedProcedure
      .input(z.object({ startDay: z.number().int().min(1).max(31) }))
      .query(({ input }) => previewCompetencyStartDay(getDataUserId(), input.startDay)),
    setStartDay: protectedProcedure
      .input(z.object({ startDay: z.number().int().min(1).max(31) }))
      .mutation(({ input }) => setCompetencyStartDay(getDataUserId(), input.startDay)),
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
          if (input.description && !matchesDescription(tx.description, input.description)) return false;
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
          // Área em que as receitas vinculadas foram escolhidas.
          workspaceId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertResponsible(input.responsibleUserId);
        if (input.incomeLinks?.length) assertActiveWorkspace(input.workspaceId);
        const { incomeLinks, workspaceId: _workspaceId, ...txInput } = input;
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
          // Para avisar em qual fatura (mês de vencimento) a compra entrou.
          return { ...tx, invoiceDueDate: invoiceDueDateOf(getStore(), tx) };
        }
        return { ...tx, invoiceDueDate: null as Date | null };
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
    /** Grava a ordem manual (arrastar e soltar) dos lançamentos listados. */
    reorder: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int()).min(1).max(2000) }))
      .mutation(({ input }) => reorderTransactions(input.ids)),
    /** Marca lançamentos como fixos (recorrentes) ou volta a deixá-los variáveis. */
    setRecurrence: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.number().int()).min(1),
          frequency: z
            .enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual"])
            .nullable(),
        })
      )
      .mutation(({ input }) => setRecurrence(input.ids, input.frequency)),
    /** O que vai acontecer ao transferir os lançamentos para outra área. */
    transferPreview: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.number().int()).min(1),
          sourceWorkspaceId: z.string(),
          targetWorkspaceId: z.string(),
          seriesScope: seriesScopeSchema,
        })
      )
      .query(async ({ input }) => {
        assertActiveWorkspace(input.sourceWorkspaceId);
        const target = await openOtherWorkspace(input.targetWorkspaceId);
        return previewTransfer(getStore(), target.store, {
          ids: input.ids,
          sourceOwnerId: getDataUserId(),
          targetOwnerId: target.ownerId,
          seriesScope: input.seriesScope,
        });
      }),
    /**
     * Move ou copia lançamentos da área ativa para outra área. Ao mover, grava
     * no destino primeiro e só depois remove da origem.
     */
    transfer: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.number().int()).min(1),
          sourceWorkspaceId: z.string(),
          targetWorkspaceId: z.string(),
          cardMap: z.record(z.string(), z.union([z.number().int(), z.literal("new")])).optional(),
          mode: z.enum(["move", "copy"]).default("move"),
          seriesScope: seriesScopeSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertActiveWorkspace(input.sourceWorkspaceId);
        const target = await openOtherWorkspace(input.targetWorkspaceId);
        const source = getStore();
        const result = transferTransactions(source, target.store, {
          ids: input.ids,
          sourceOwnerId: getDataUserId(),
          targetOwnerId: target.ownerId,
          actorTargetUserId: target.user.id,
          cardMap: input.cardMap,
          mode: input.mode,
          seriesScope: input.seriesScope,
        });
        await target.store.commit();
        // Cópia não altera a origem (não há o que gravar nela).
        if (input.mode === "move") {
          try {
            await source.commit();
          } catch (error) {
            throw new Error(
              "Os lançamentos foram copiados para o destino, mas não foi possível removê-los desta área. " +
                "Use Recarregar dados e exclua-os aqui manualmente."
            );
          }
        }
        await logAuditAction({
          workspaceId: 0,
          userId: ctx.user.id,
          action: input.mode === "copy" ? "copy_transactions" : "transfer_transactions",
          entityType: "transaction",
          entityId: null,
          changes: JSON.stringify({ to: input.targetWorkspaceId, count: result.created.length }),
        });
        return {
          count: result.created.length,
          mode: input.mode,
          rulesTransferred: result.rulesTransferred,
          allocationsRemoved: result.allocationsRemoved,
          target: { id: target.workspace.id, name: target.workspace.name },
        };
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
          endDate: input.endDate ? toLocalDate(input.endDate) : null,
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
          /** false = valor real confirmado (ocorrência de recorrência). */
          isEstimated: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        assertResponsible(input.responsibleUserId);
        const { id, transactionDate, dueDate, isEstimated, ...rest } = input;
        
        const updates: any = { ...rest };
        // Valor estimado vira confirmado quando o usuário confirma ou muda o valor.
        const current = getStore().find("transactions", t => t.id === id);
        if (isEstimated !== undefined) updates.isEstimated = isEstimated ? 1 : 0;
        else if (
          current?.isEstimated &&
          input.amount !== undefined &&
          Number(input.amount).toFixed(2) !== Number(current.amount).toFixed(2)
        ) {
          updates.isEstimated = 0;
        }
        
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
      .input(
        z.object({
          id: z.number(),
          /** Lançamento recorrente: só este, este e os anteriores não pagos, este e os próximos, ou todos os não pagos. */
          scope: z.enum(RECURRING_DELETE_SCOPES).optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (!input.scope || input.scope === "this") return deleteTransaction(input.id);
        const s = getStore();
        const result = deleteRecurring(s, input.id, input.scope);
        await s.commit();
        return { success: true as const, ...result };
      }),
    markAsPaid: protectedProcedure
      .input(z.object({ id: z.number(), isPaid: z.boolean() }))
      .mutation(({ input }) => {
        const paidDate = input.isPaid ? new Date() : null;
        return updateTransaction(input.id, {
          isPaid: input.isPaid ? 1 : 0,
          paidDate,
          // Pagar confirma o valor (deixa de ser estimado).
          ...(input.isPaid ? { isEstimated: 0 } : {}),
        });
      }),
    /** Confirma o valor real de uma ocorrência estimada (opcionalmente com outro valor). */
    confirmAmount: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          amount: z
            .string()
            .refine(v => Number.isFinite(Number(v)) && Number(v) > 0, "Valor inválido")
            .optional(),
        })
      )
      .mutation(({ input }) =>
        updateTransaction(input.id, {
          isEstimated: 0,
          ...(input.amount ? { amount: Number(input.amount).toFixed(2) } : {}),
        })
      ),
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
    /** Compras antigas gravadas na fatura errada (prévia da correção). */
    misplacedPurchases: protectedProcedure.query(() =>
      findMisplacedCardPurchases(getStore(), getDataUserId())
    ),
    /** Move as compras escolhidas para a fatura certa (depois da confirmação). */
    fixMisplacedPurchases: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int()).min(1) }))
      .mutation(({ input }) => fixMisplacedCardPurchases(getDataUserId(), input.ids)),
    /** Faturas de um cartão, com as compras de cada uma (tela de Cartões). */
    byCard: protectedProcedure
      .input(z.object({ creditCardId: z.number().int() }))
      .query(async ({ input }) => {
        const s = getStore();
        const result = invoicesForCard(s, getDataUserId(), input.creditCardId);
        await s.commit(); // grava se o recálculo corrigiu alguma fatura
        return result;
      }),
    /** Todas as faturas da área (para agrupar as compras na lista de lançamentos). */
    listAll: protectedProcedure.query(async () => {
      const s = getStore();
      // Corrige faturas antigas (sem registro ou com total desatualizado).
      if (syncAllInvoices(s, getDataUserId())) await s.commit();
      return s.select("invoices", i => i.userId === getDataUserId());
    }),
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
      .input(savedFilterCriteriaSchema.extend({ name: z.string().trim().min(1), isDefault: z.boolean().optional() }))
      .mutation(({ input }) =>
        createSavedFilter(getDataUserId(), input)
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          isDefault: z.boolean().optional(),
          criteria: savedFilterCriteriaSchema.optional(),
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
    list: protectedProcedure.query(() => listWorkspacesWithActive()),
    /**
     * Lançamentos do período em todas as áreas (só leitura). Áreas que não
     * abrirem vêm com o motivo em `error`.
     */
    allTransactions: protectedProcedure
      .input(
        z.object({
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
          mode: z.enum(["competency", "monthly"]),
        })
      )
      .query(async ({ input }) => {
        const { workspaces } = await listWorkspacesWithActive();
        const results = await Promise.all(
          workspaces.map(async w => {
            const ref = { id: w.id, name: w.name, kind: w.kind, isActive: w.isActive };
            try {
              let store, ownerId;
              if (w.isActive) {
                store = getStore();
                ownerId = getDataUserId();
              } else {
                const other = await openOtherWorkspace(w.id);
                store = other.store;
                ownerId = other.ownerId;
                // Recorrências que a área ainda não gerou (só em memória; nada é gravado).
                materializeRecurrences(store, ownerId);
              }
              return { ...ref, error: null, ...consolidateWorkspace(store, ownerId, w.id, input.year, input.month, input.mode) };
            } catch (error) {
              return { ...ref, error: workspaceAccessMessage(error), rows: [], totals: null };
            }
          })
        );
        return { workspaces: results };
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
    /**
     * Exclui ou sai de áreas compartilhadas. Criada por mim: a planilha vai para
     * a lixeira do Drive (todos perdem o acesso; dá para recuperar por 30 dias).
     * De outra pessoa: tiro minha permissão (se o Drive deixar) e a área sai da
     * minha lista; os dados continuam com o dono. A área pessoal não pode ser
     * excluída. Se a ativa estiver entre elas, volta para a pessoal.
     */
    remove: protectedProcedure
      .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }))
      .mutation(async ({ input }) => {
        const profile = getSignedInProfile();
        if (!profile) throw new Error("Entre com sua conta Google de novo.");
        const personalId = getPersonalWorkspaceId();
        const activeId = getActiveWorkspace()?.id;
        const results: { id: string; name: string; action: "deleted" | "left" | "error"; error?: string }[] = [];

        for (const id of Array.from(new Set(input.ids))) {
          if (id === personalId) {
            results.push({ id, name: "Pessoal", action: "error", error: "A área pessoal não pode ser excluída." });
            continue;
          }
          try {
            const file = await getWorkspaceFile(id);
            if (file.kind !== "shared") throw new Error("Esta planilha não é uma área compartilhada.");
            if (file.ownedByMe) {
              await trashWorkspaceFile(id);
              results.push({ id, name: file.name, action: "deleted" });
            } else {
              // Sem permissão para tirar a si mesmo, a área ainda sai da lista.
              await unshareWorkspaceFile(id, profile.email).catch(() => undefined);
              results.push({ id, name: file.name, action: "left" });
            }
            setWorkspaceHidden(profile.sub, id, true);
          } catch (error) {
            // Já não existe ou não há mais acesso: só tira da lista.
            if (error instanceof GoogleApiError && (error.status === 404 || error.status === 403)) {
              setWorkspaceHidden(profile.sub, id, true);
              results.push({ id, name: id, action: "left" });
            } else {
              results.push({ id, name: id, action: "error", error: workspaceAccessMessage(error) });
            }
          }
        }

        const activeRemoved = !!activeId && results.some(r => r.id === activeId && r.action !== "error");
        if (activeRemoved) await switchWorkspace(null);
        return { results, switchedToPersonal: activeRemoved };
      }),
    /** Troca a área ativa. `id` nulo volta para a área pessoal. */
    switch: protectedProcedure
      .input(z.object({ id: z.string().min(1).nullable() }))
      .mutation(({ input }) => switchWorkspace(input.id)),
  }),

  recurrence: router({
    /** Quantos lançamentos cada opção de exclusão alcança. */
    deletePreview: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(({ input }) => recurringDeletePreview(getStore(), input.id)),
    /** Regras (com ou sem data final) e séries antigas, para a tela de Fixos. */
    list: protectedProcedure.query(() => listRecurrences(getStore(), getDataUserId())),
    /** Série antiga (criada com data final): passa a continuar sem fim. */
    continueSeries: protectedProcedure
      .input(z.object({ groupKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const s = getStore();
        continueSeries(s, getDataUserId(), input.groupKey, ctx.user.id);
        materializeRecurrences(s, getDataUserId());
        await s.commit();
        return { success: true } as const;
      }),
    /** Encerra a recorrência depois da data informada (padrão: hoje). */
    end: protectedProcedure
      .input(z.object({ groupKey: z.string().min(1), lastDate: dateOnlySchema.optional() }))
      .mutation(async ({ input }) => {
        const s = getStore();
        const last = input.lastDate
          ? (() => {
              const [y, m, d] = input.lastDate.split("-").map(Number);
              return new Date(y, m - 1, d);
            })()
          : new Date();
        const result = endRecurrence(s, input.groupKey, getDataUserId(), last);
        await s.commit();
        return result;
      }),
    /** "Alterar a partir deste mês": valor/descrição/categoria/responsável das próximas. */
    applyFrom: protectedProcedure
      .input(
        z.object({
          transactionId: z.number().int(),
          amount: z.string().optional(),
          description: z.string().optional(),
          category: z.string().optional(),
          responsibleUserId: z.number().int().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        assertResponsible(input.responsibleUserId);
        const s = getStore();
        const { transactionId, ...changes } = input;
        const result = applyFromOccurrence(s, transactionId, changes);
        await s.commit();
        return result;
      }),
    /** Dados da recorrência de um lançamento (para a tela de edição). */
    ofTransaction: protectedProcedure
      .input(z.object({ transactionId: z.number().int() }))
      .query(({ input }) => {
        const s = getStore();
        const t = s.find("transactions", x => x.id === input.transactionId);
        const rule = t ? ruleOfTransaction(s, t) : null;
        return rule
          ? {
              groupKey: rule.groupKey,
              frequency: rule.frequency,
              startDate: rule.startDate,
              endDate: rule.endDate,
              variableAmount: rule.variableAmount === 1,
            }
          : null;
      }),
  }),

  report: router({
    /** Despesas fixas (recorrentes) × variáveis: últimos meses e detalhe do mês. */
    fixedVsVariable: protectedProcedure
      .input(
        z.object({
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
          months: z.number().int().min(1).max(24).optional(),
          mode: z.enum(["competency", "monthly"]).optional(),
        })
      )
      .query(({ input }) =>
        fixedVsVariableReport(getStore(), getDataUserId(), input.year, input.month, input.months ?? 6, input.mode)
      ),
    /** Séries antigas que parecem recorrentes, para marcar como fixas. */
    recurringSuggestions: protectedProcedure.query(() =>
      suggestRecurringSeries(getStore(), getDataUserId())
    ),
  }),

  allocation: router({
    /** Total vinculado de cada lançamento (coberto, nas despesas; comprometido, nas receitas). */
    totals: protectedProcedure.query(() =>
      Object.fromEntries(Array.from(allocationTotals(getStore()).entries()).map(([id, c]) => [id, (c / 100).toFixed(2)]))
    ),
    // `workspaceId` entra na chave do cache: dados de uma área nunca aparecem em outra.
    forTransaction: protectedProcedure
      .input(z.object({ transactionId: z.number().int(), workspaceId: z.string() }))
      .query(({ input }) => {
        assertActiveWorkspace(input.workspaceId);
        return allocationsOf(getStore(), input.transactionId);
      }),
    incomeOptions: protectedProcedure
      .input(z.object({ expenseId: z.number().int().optional(), workspaceId: z.string() }))
      .query(({ input }) => {
        assertActiveWorkspace(input.workspaceId);
        return incomeOptions(getStore(), getDataUserId(), input.expenseId);
      }),
    /** Receitas que pagam despesas, para filtrar a lista por receita. */
    incomesWithExpenses: protectedProcedure
      .input(z.object({ workspaceId: z.string() }))
      .query(({ input }) => {
        assertActiveWorkspace(input.workspaceId);
        return incomesWithExpenses(getStore(), getDataUserId());
      }),
    /** A receita e as despesas pagas com ela, de qualquer período. */
    paidBy: protectedProcedure
      .input(z.object({ incomeId: z.number().int(), workspaceId: z.string() }))
      .query(({ input }) => {
        assertActiveWorkspace(input.workspaceId);
        return transactionsPaidBy(getStore(), getDataUserId(), input.incomeId);
      }),
    /** Substitui as receitas vinculadas a uma despesa. Lista vazia remove os vínculos. */
    set: protectedProcedure
      .input(
        z.object({
          expenseId: z.number().int(),
          links: z.array(allocationLinkSchema),
          workspaceId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertActiveWorkspace(input.workspaceId);
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
          `${inviter} convidou você para a área "${active.name}" no Financeiro Doméstico.\n\n` +
            `IMPORTANTE: não use o botão "Abrir" deste e-mail (ele abre só a planilha). ` +
            `Para usar o app, abra este link e entre com esta conta Google (${input.email}):\n` +
            `${joinLink(active.id)}\n\n` +
            `Na primeira vez, selecione a planilha na janela do Google e clique em "Selecionar".`
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
