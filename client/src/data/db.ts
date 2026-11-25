/**
 * Operações de dados do aplicativo, gravadas na planilha Google do usuário.
 * Mantém as mesmas funções da antiga camada MySQL (server/db.ts).
 */
import {
  addMonthsClamped,
  shiftCompetency,
  splitInstallmentCents,
  calculateInvoiceDates,
  filterTransactionsByDateRange,
  generateRecurringDates,
  getCompetencyForTransaction,
  type RecurrenceFrequency,
} from "./competencyLogic";
import { getStore } from "./session";
import { cleanupAllocationsAfterUpdate, removeAllocationsOf } from "./allocations";
import type { SheetStore } from "./sheetStore";
import type {
  Account,
  AuditLog,
  Insert,
  SharedAccount,
  Transaction,
  TransactionResponsibility,
  TransactionType,
  Typology,
  User,
  UserStatus,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from "./schema";

const byNewest = <T extends { createdAt: Date }>(a: T, b: T) =>
  b.createdAt.getTime() - a.createdAt.getTime();

export function competencyName(year: number, month: number) {
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Competências ────────────────────────────────────────────────────────────

export async function getOrCreateCompetencyByYearMonth(userId: number, year: number, month: number) {
  const s = getStore();
  const existing = s.find(
    "competencies",
    c => c.userId === userId && c.year === year && c.month === month
  );
  if (existing) return existing;

  const created = s.insert("competencies", {
    userId,
    year,
    month,
    name: competencyName(year, month),
  });
  await s.commit();
  return created;
}

export function getOrCreateCurrentCompetency(userId: number) {
  const now = new Date();
  return getOrCreateCompetencyByYearMonth(userId, now.getFullYear(), now.getMonth() + 1);
}

export async function getUserCompetencies(userId: number) {
  return getStore()
    .select("competencies", c => c.userId === userId)
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

// ─── Cartões de crédito ──────────────────────────────────────────────────────

export async function getUserCreditCards(userId: number) {
  return getStore().select("creditCards", c => c.userId === userId && c.isActive === 1);
}

export async function createCreditCard(data: Insert<"creditCards">) {
  const s = getStore();
  const created = s.insert("creditCards", data);
  await s.commit();
  return created;
}

// ─── Transações ──────────────────────────────────────────────────────────────

export async function getCompetencyTransactions(competencyId: number) {
  return getStore()
    .select("transactions", t => t.competencyId === competencyId)
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
}

/** Vencimento da fatura em que uma compra no cartão é cobrada. */
export function invoiceDueDateOf(s: SheetStore, t: Transaction): Date | null {
  if (t.type !== "credit_card" || !t.creditCardId) return null;
  const invoice = s.find(
    "invoices",
    i => i.creditCardId === t.creditCardId && i.competencyId === t.competencyId
  );
  if (invoice?.dueDate) return invoice.dueDate;
  const card = s.find("creditCards", c => c.id === t.creditCardId);
  const competency = s.find("competencies", c => c.id === t.competencyId);
  return card && competency ? calculateInvoiceDates(card, competency.year, competency.month).dueDate : null;
}

/**
 * Lançamentos de um intervalo de datas. Compras no cartão entram pelo
 * vencimento da fatura (é quando o dinheiro sai), as demais pela data.
 */
export function getUserTransactionsByDateRange(
  userId: number,
  startDate?: string,
  endDate?: string
) {
  const s = getStore();
  const all = s.select("transactions", transaction => transaction.userId === userId);
  const byDate = filterTransactionsByDateRange(
    all.filter(t => t.type !== "credit_card"),
    startDate,
    endDate
  );
  const byInvoice = all.filter(t => {
    if (t.type !== "credit_card") return false;
    const due = invoiceDueDateOf(s, t) ?? t.transactionDate;
    return filterTransactionsByDateRange([{ transactionDate: due }], startDate, endDate).length > 0;
  });
  return [...byDate, ...byInvoice].sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime()
  );
}

export function getCalendarEventsForYear(userId: number, year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const store = getStore();

  return {
    transactions: store.select(
      "transactions",
      transaction =>
        transaction.userId === userId &&
        transaction.transactionDate instanceof Date &&
        transaction.transactionDate >= start &&
        transaction.transactionDate < end
    ),
    invoices: store.select(
      "invoices",
      invoice =>
        invoice.userId === userId &&
        invoice.dueDate instanceof Date &&
        invoice.dueDate >= start &&
        invoice.dueDate < end
    ),
  };
}

export async function createTransaction(data: Insert<"transactions">) {
  const s = getStore();
  const created = s.insert("transactions", data);
  await s.commit();
  return created;
}

export async function createRecurringTransactions(
  userId: number,
  data: {
    type: TransactionType;
    category: string;
    description?: string;
    amount: string;
    creditCardId?: number;
    notes?: string;
    frequency: RecurrenceFrequency;
    startDate: Date;
    endDate: Date;
    responsibleUserId?: number | null;
    createdBy?: number | null;
  }
) {
  const s = getStore();
  const creditCard = data.type === "credit_card" && data.creditCardId
    ? s.find(
        "creditCards",
        card => card.id === data.creditCardId && card.userId === userId && card.isActive === 1
      )
    : null;

  if (data.type === "credit_card" && !creditCard) {
    throw new Error("Selecione um cartão de crédito ativo.");
  }

  const competencies = new Map<string, number>();
  const created: Transaction[] = [];
  // Marca a série como recorrente (despesa/receita fixa).
  const recurrenceGroup = newRecurrenceGroup();
  const invoiceCompetencies = new Set<number>();

  for (const transactionDate of generateRecurringDates(
    data.startDate,
    data.endDate,
    data.frequency
  )) {
    const { year, month } = getCompetencyForTransaction(transactionDate, creditCard);
    const competencyKey = `${year}-${month}`;
    let competencyId = competencies.get(competencyKey);

    if (competencyId === undefined) {
      let competency = s.find(
        "competencies",
        item => item.userId === userId && item.year === year && item.month === month
      );
      if (!competency) {
        competency = s.insert("competencies", {
          userId,
          year,
          month,
          name: competencyName(year, month),
        });
      }
      competencyId = competency.id;
      competencies.set(competencyKey, competencyId);
    }

    created.push(
      s.insert("transactions", {
        userId,
        competencyId,
        creditCardId: creditCard?.id,
        type: data.type,
        category: data.category,
        description: data.description ?? "",
        amount: data.amount,
        transactionDate,
        notes: data.notes ?? "",
        responsibleUserId: data.responsibleUserId ?? null,
        createdBy: data.createdBy ?? null,
        recurrence: data.frequency,
        recurrenceGroup,
      })
    );

    if (creditCard) invoiceCompetencies.add(competencyId);
  }

  if (creditCard) {
    invoiceCompetencies.forEach(competencyId =>
      recalcInvoice(s, userId, creditCard.id, competencyId)
    );
  }

  await s.commit();
  return created;
}

/** Garante a competência (ano/mês) do usuário e devolve o id. */
function ensureCompetency(s: SheetStore, userId: number, year: number, month: number) {
  const existing = s.find(
    "competencies",
    c => c.userId === userId && c.year === year && c.month === month
  );
  if (existing) return existing.id;
  return s.insert("competencies", { userId, year, month, name: competencyName(year, month) }).id;
}

/**
 * Compra/despesa parcelada: cria uma parcela por mês com o valor dividido.
 * No cartão, a 1ª parcela cai na fatura da data da compra (respeitando o dia
 * de fechamento) e as demais nas faturas seguintes.
 */
export async function createInstallmentTransactions(
  userId: number,
  data: {
    type: "expense" | "credit_card";
    category: string;
    description?: string;
    totalAmount: string;
    installments: number;
    firstDate: Date;
    creditCardId?: number;
    notes?: string;
    responsibleUserId?: number | null;
    createdBy?: number | null;
  }
) {
  const s = getStore();
  const card =
    data.type === "credit_card" && data.creditCardId
      ? s.find("creditCards", c => c.id === data.creditCardId && c.userId === userId)
      : null;
  if (data.type === "credit_card" && !card) throw new Error("Selecione um cartão de crédito ativo.");

  const totalCents = Math.round(Number(data.totalAmount) * 100);
  if (!(totalCents > 0)) throw new Error("Informe um valor total maior que zero.");
  const parts = splitInstallmentCents(totalCents, data.installments);
  const first = getCompetencyForTransaction(data.firstDate, card);

  const created: Transaction[] = parts.map((cents, i) => {
    const transactionDate = addMonthsClamped(data.firstDate, i);
    const { year, month } = card
      ? shiftCompetency(first.year, first.month, i)
      : { year: transactionDate.getFullYear(), month: transactionDate.getMonth() + 1 };
    return s.insert("transactions", {
      userId,
      competencyId: ensureCompetency(s, userId, year, month),
      creditCardId: card?.id ?? null,
      type: data.type,
      category: data.category,
      description: data.description ?? "",
      amount: (cents / 100).toFixed(2),
      transactionDate,
      installments: data.installments,
      currentInstallment: i + 1,
      notes: data.notes ?? "",
      responsibleUserId: data.responsibleUserId ?? null,
      createdBy: data.createdBy ?? null,
    });
  });

  if (card) {
    new Set(created.map(t => t.competencyId)).forEach(competencyId =>
      recalcInvoice(s, userId, card.id, competencyId)
    );
  }
  await s.commit();
  return created;
}

/**
 * Competência certa de uma compra no cartão, pelo dia de fechamento do cartão.
 * Para outros tipos, a competência informada.
 */
export function resolveCompetencyForCreate(
  userId: number,
  type: TransactionType,
  creditCardId: number | undefined,
  transactionDate: Date,
  fallbackCompetencyId: number
) {
  if (type !== "credit_card" || !creditCardId) return fallbackCompetencyId;
  const s = getStore();
  const card = s.find("creditCards", c => c.id === creditCardId);
  if (!card) return fallbackCompetencyId;
  const { year, month } = getCompetencyForTransaction(transactionDate, card);
  return ensureCompetency(s, userId, year, month);
}

export function newRecurrenceGroup() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "r" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Marca (ou desmarca, com `frequency` nulo) lançamentos como recorrentes/fixos.
 * Usado para lançamentos antigos, criados antes de a série ser registrada.
 */
export async function setRecurrence(ids: number[], frequency: string | null) {
  const s = getStore();
  const set = new Set(ids);
  const group = frequency ? newRecurrenceGroup() : null;
  s.update("transactions", t => set.has(t.id), { recurrence: frequency, recurrenceGroup: group });
  await s.commit();
  return { count: ids.length };
}

export async function getTransactionById(id: number) {
  return getStore().find("transactions", t => t.id === id);
}

export async function updateTransaction(id: number, updates: Insert<"transactions">) {
  const s = getStore();
  const before = s.find("transactions", t => t.id === id);
  s.update("transactions", t => t.id === id, updates);
  syncInvoicesTouchedBy(s, before, s.find("transactions", t => t.id === id));
  cleanupAllocationsAfterUpdate(s, id);
  await s.commit();
  return { success: true } as const;
}

export async function deleteTransaction(id: number) {
  const s = getStore();
  const before = s.find("transactions", t => t.id === id);
  s.delete("transactions", t => t.id === id);
  syncInvoicesTouchedBy(s, before, null);
  removeAllocationsOf(s, id);
  await s.commit();
  return { success: true } as const;
}

/** Recalcula as faturas afetadas por uma alteração de lançamento de cartão. */
function syncInvoicesTouchedBy(
  s: SheetStore,
  before: Transaction | null,
  after: Transaction | null
) {
  const touched = [before, after].filter(
    (t): t is Transaction => !!t && t.type === "credit_card" && !!t.creditCardId
  );
  for (const t of touched) {
    recalcInvoice(s, t.userId, t.creditCardId!, t.competencyId);
  }
}

// ─── Faturas ─────────────────────────────────────────────────────────────────

export async function getCompetencyInvoices(competencyId: number) {
  return getStore()
    .select("invoices", i => i.competencyId === competencyId)
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
}

export function recalcInvoice(s: SheetStore, userId: number, creditCardId: number, competencyId: number) {
  const card = s.find("creditCards", c => c.id === creditCardId);
  const competency = s.find("competencies", c => c.id === competencyId);
  if (!card || !competency) return;

  const total = s
    .select("transactions", t => t.creditCardId === creditCardId && t.competencyId === competencyId)
    .reduce((sum, t) => sum + parseFloat(String(t.amount) || "0"), 0);

  const where = (i: { creditCardId: number; competencyId: number }) =>
    i.creditCardId === creditCardId && i.competencyId === competencyId;

  const existing = s.find("invoices", where);
  if (existing) {
    // Mudou o total (compra nova/excluída): o status acompanha o valor já pago.
    const paid = parseFloat(String(existing.paidAmount ?? 0)) || 0;
    const status = paid <= 0 ? "open" : paid + 0.005 >= total ? "paid" : "partial";
    s.update("invoices", where, { totalAmount: total.toFixed(2), status });
  } else {
    const { closingDate, dueDate } = calculateInvoiceDates(card, competency.year, competency.month);
    s.insert("invoices", {
      userId,
      creditCardId,
      competencyId,
      closingDate,
      dueDate,
      totalAmount: total.toFixed(2),
      paidAmount: "0.00",
      status: "open",
    });
  }
}

export async function upsertInvoiceForCreditCard(
  userId: number,
  creditCardId: number,
  competencyId: number
) {
  const s = getStore();
  recalcInvoice(s, userId, creditCardId, competencyId);
  await s.commit();
}

export async function updateInvoicePayment(invoiceId: number, paidAmount: number) {
  const s = getStore();
  const invoice = s.find("invoices", i => i.id === invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const total = parseFloat(String(invoice.totalAmount));
  const status = paidAmount <= 0 ? "open" : paidAmount >= total ? "paid" : "partial";
  s.update("invoices", i => i.id === invoiceId, { paidAmount: paidAmount.toFixed(2), status });
  await s.commit();
}

/**
 * Recalcula as faturas de todas as compras no cartão do dono da área. Dados
 * antigos podiam ficar sem fatura ou com total desatualizado. Devolve
 * quantas faturas mudaram.
 */
export function syncAllInvoices(s: SheetStore, userId: number) {
  const before = JSON.stringify(s.select("invoices").map(i => [i.id, i.totalAmount, i.status]));
  const groups = new Set<string>();
  for (const t of s.select("transactions", t => t.userId === userId && t.type === "credit_card" && !!t.creditCardId)) {
    groups.add(`${t.creditCardId}:${t.competencyId}`);
  }
  // Faturas que ficaram sem compras (ex.: compras excluídas) também são zeradas.
  for (const i of s.select("invoices", i => i.userId === userId)) {
    groups.add(`${i.creditCardId}:${i.competencyId}`);
  }
  groups.forEach(key => {
    const [card, comp] = key.split(":").map(Number);
    recalcInvoice(s, userId, card, comp);
  });
  const after = JSON.stringify(s.select("invoices").map(i => [i.id, i.totalAmount, i.status]));
  return before === after ? 0 : 1;
}

/** Soma um pagamento ao valor já pago da fatura (sem passar do total). */
export async function addInvoicePayment(
  userId: number,
  creditCardId: number,
  competencyId: number,
  amount: number
) {
  const s = getStore();
  recalcInvoice(s, userId, creditCardId, competencyId);
  const where = (i: { creditCardId: number; competencyId: number }) =>
    i.creditCardId === creditCardId && i.competencyId === competencyId;
  const invoice = s.find("invoices", where);
  if (!invoice) throw new Error("Fatura não encontrada.");

  const totalCents = Math.round(Number(invoice.totalAmount) * 100);
  const paidCents = Math.round(Number(invoice.paidAmount ?? 0) * 100);
  const remaining = totalCents - paidCents;
  const payCents = Math.round(amount * 100);
  if (remaining <= 0) throw new Error("Esta fatura já está paga.");
  if (payCents > remaining) {
    throw new Error(
      `O pagamento passa do valor em aberto (${(remaining / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`
    );
  }
  const newPaid = paidCents + payCents;
  s.update("invoices", where, {
    paidAmount: (newPaid / 100).toFixed(2),
    status: newPaid >= totalCents ? "paid" : "partial",
  });
  await s.commit();
  return s.find("invoices", where)!;
}

export async function syncInvoicesForCompetency(userId: number, competencyId: number) {
  const s = getStore();
  const cardIds = new Set(
    s
      .select(
        "transactions",
        t => t.userId === userId && t.competencyId === competencyId && t.type === "credit_card"
      )
      .map(t => t.creditCardId)
      .filter((id): id is number => id !== null)
  );
  cardIds.forEach(cardId => recalcInvoice(s, userId, cardId, competencyId));
  await s.commit();
}

// ─── Tipologias (categorias) ─────────────────────────────────────────────────

const bySortOrder = (a: Typology, b: Typology) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export async function createTypology(typology: Insert<"typologies">) {
  const s = getStore();
  const created = s.insert("typologies", typology);
  await s.commit();
  return created;
}

export async function getTypologiesByUser(userId: number) {
  return getStore()
    .select("typologies", t => t.userId === userId)
    .sort(bySortOrder);
}

export async function getTypologiesByUserAndType(userId: number, type: TransactionType) {
  return getStore()
    .select("typologies", t => t.userId === userId && t.type === type)
    .sort(bySortOrder);
}

export async function updateTypology(id: number, updates: Insert<"typologies">) {
  const s = getStore();
  s.update("typologies", t => t.id === id, updates);
  await s.commit();
  return { success: true } as const;
}

export async function deleteTypology(id: number) {
  const s = getStore();
  s.delete("typologies", t => t.id === id);
  await s.commit();
  return { success: true } as const;
}

/** Categorias padrão para um novo usuário (gravadas no próximo commit). */
export function createDefaultTypologies(s: SheetStore, userId: number) {
  const defaults: Insert<"typologies">[] = [
    // Receitas
    { name: "Salário", type: "income", icon: "💰", color: "#10B981", sortOrder: 1 },
    { name: "Freelance", type: "income", icon: "💻", color: "#10B981", sortOrder: 2 },
    { name: "Investimentos", type: "income", icon: "📈", color: "#10B981", sortOrder: 3 },
    { name: "Outros", type: "income", icon: "💵", color: "#10B981", sortOrder: 4 },
    // Despesas
    { name: "Alimentação", type: "expense", icon: "🍔", color: "#EF4444", sortOrder: 1 },
    { name: "Transporte", type: "expense", icon: "🚗", color: "#EF4444", sortOrder: 2 },
    { name: "Saúde", type: "expense", icon: "🏥", color: "#EF4444", sortOrder: 3 },
    { name: "Educação", type: "expense", icon: "📚", color: "#EF4444", sortOrder: 4 },
    { name: "Entretenimento", type: "expense", icon: "🎬", color: "#EF4444", sortOrder: 5 },
    { name: "Utilidades", type: "expense", icon: "💡", color: "#EF4444", sortOrder: 6 },
    { name: "Moradia", type: "expense", icon: "🏠", color: "#EF4444", sortOrder: 7 },
    { name: "Outros", type: "expense", icon: "📌", color: "#EF4444", sortOrder: 8 },
    // Cartão de crédito
    { name: "Compras", type: "credit_card", icon: "🛍️", color: "#3B82F6", sortOrder: 1 },
    { name: "Alimentação", type: "credit_card", icon: "🍽️", color: "#3B82F6", sortOrder: 2 },
    { name: "Assinaturas", type: "credit_card", icon: "📱", color: "#3B82F6", sortOrder: 3 },
    { name: "Outros", type: "credit_card", icon: "💳", color: "#3B82F6", sortOrder: 4 },
  ];
  defaults.forEach(t => s.insert("typologies", { ...t, userId, isActive: 1 }));
}

// ─── Filtros salvos ──────────────────────────────────────────────────────────

type FilterInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
  types?: string[];
  minAmount?: number;
  maxAmount?: number;
  isDefault?: boolean;
};

export async function createSavedFilter(userId: number, filter: FilterInput & { name: string }) {
  const s = getStore();
  const created = s.insert("savedFilters", {
    userId,
    name: filter.name,
    startDate: filter.startDate ?? null,
    endDate: filter.endDate ?? null,
    categories: filter.categories ? JSON.stringify(filter.categories) : null,
    types: filter.types ? JSON.stringify(filter.types) : null,
    minAmount: filter.minAmount ? filter.minAmount.toString() : null,
    maxAmount: filter.maxAmount ? filter.maxAmount.toString() : null,
    isDefault: filter.isDefault ? 1 : 0,
  });
  await s.commit();
  return created;
}

export async function getSavedFilters(userId: number) {
  return getStore().select("savedFilters", f => f.userId === userId);
}

export async function getSavedFilter(filterId: number) {
  return getStore().find("savedFilters", f => f.id === filterId);
}

export async function updateSavedFilter(filterId: number, filter: FilterInput) {
  const s = getStore();
  s.update("savedFilters", f => f.id === filterId, {
    name: filter.name || undefined,
    startDate: filter.startDate,
    endDate: filter.endDate,
    categories: filter.categories ? JSON.stringify(filter.categories) : undefined,
    types: filter.types ? JSON.stringify(filter.types) : undefined,
    minAmount: filter.minAmount?.toString(),
    maxAmount: filter.maxAmount?.toString(),
    isDefault: filter.isDefault === undefined ? undefined : filter.isDefault ? 1 : 0,
  });
  await s.commit();
  return { success: true } as const;
}

export async function deleteSavedFilter(filterId: number) {
  const s = getStore();
  s.delete("savedFilters", f => f.id === filterId);
  await s.commit();
  return { success: true } as const;
}

export async function deleteAllSavedFilters(userId: number) {
  const s = getStore();
  s.delete("savedFilters", f => f.userId === userId);
  await s.commit();
  return { success: true } as const;
}

// ─── Links de transações ─────────────────────────────────────────────────────

export interface TransactionLink {
  url: string;
  title?: string;
  description?: string;
}

export async function getTransactionLinks(transactionId: number): Promise<TransactionLink[]> {
  const tx = getStore().find("transactions", t => t.id === transactionId);
  if (!tx?.links) return [];
  try {
    return JSON.parse(tx.links);
  } catch {
    return [];
  }
}

export async function setTransactionLinks(transactionId: number, links: TransactionLink[]) {
  const s = getStore();
  s.update("transactions", t => t.id === transactionId, {
    links: links.length > 0 ? JSON.stringify(links) : null,
  });
  await s.commit();
}

export async function addTransactionLink(transactionId: number, link: TransactionLink) {
  const current = await getTransactionLinks(transactionId);
  await setTransactionLinks(transactionId, [...current, link]);
}

export async function updateTransactionLink(
  transactionId: number,
  linkIndex: number,
  link: TransactionLink
) {
  const current = await getTransactionLinks(transactionId);
  if (linkIndex < 0 || linkIndex >= current.length) return;
  current[linkIndex] = link;
  await setTransactionLinks(transactionId, current);
}

export async function deleteTransactionLink(transactionId: number, linkIndex: number) {
  const current = await getTransactionLinks(transactionId);
  await setTransactionLinks(
    transactionId,
    current.filter((_, index) => index !== linkIndex)
  );
}

// ─── Contas bancárias ────────────────────────────────────────────────────────

export async function createAccount(data: Insert<"accounts">): Promise<Account> {
  const s = getStore();
  const created = s.insert("accounts", data);
  await s.commit();
  return created;
}

export async function getUserAccounts(userId: number) {
  return getStore()
    .select("accounts", a => a.userId === userId && a.isActive === 1)
    .sort(byNewest);
}

export async function getAccountById(id: number) {
  return getStore().find("accounts", a => a.id === id);
}

export async function updateAccount(id: number, data: Insert<"accounts">) {
  const s = getStore();
  s.update("accounts", a => a.id === id, data);
  await s.commit();
  return { success: true } as const;
}

export async function updateAccountBalance(id: number, newBalance: number | string) {
  const s = getStore();
  s.update("accounts", a => a.id === id, { balance: Number(newBalance).toFixed(2) });
  await s.commit();
  return { success: true } as const;
}

export async function deleteAccount(id: number) {
  // Exclusão lógica, como na versão anterior.
  return updateAccount(id, { isActive: 0 });
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

export async function createWorkspace(data: Insert<"workspaces">): Promise<Workspace> {
  const s = getStore();
  const created = s.insert("workspaces", data);
  await s.commit();
  return created;
}

export async function getWorkspacesByUser(userId: number) {
  return getStore().select("workspaces", w => w.ownerId === userId);
}

export async function getWorkspaceById(id: number) {
  return getStore().find("workspaces", w => w.id === id);
}

export async function updateWorkspace(id: number, data: Insert<"workspaces">) {
  const s = getStore();
  s.update("workspaces", w => w.id === id, data);
  await s.commit();
  return s.find("workspaces", w => w.id === id);
}

export async function addWorkspaceMember(data: Insert<"workspaceMembers">): Promise<WorkspaceMember> {
  const s = getStore();
  const created = s.insert("workspaceMembers", data);
  await s.commit();
  return created;
}

export async function getWorkspaceMembers(workspaceId: number) {
  return getStore().select("workspaceMembers", m => m.workspaceId === workspaceId);
}

export async function updateWorkspaceMemberRole(memberId: number, role: WorkspaceMember["role"]) {
  const s = getStore();
  s.update("workspaceMembers", m => m.id === memberId, { role });
  await s.commit();
  return s.find("workspaceMembers", m => m.id === memberId);
}

export async function removeWorkspaceMember(memberId: number) {
  const s = getStore();
  const member = s.find("workspaceMembers", m => m.id === memberId);
  s.delete("workspaceMembers", m => m.id === memberId);
  await s.commit();
  return member;
}

export async function createWorkspaceInvite(data: Insert<"workspaceInvites">): Promise<WorkspaceInvite> {
  const s = getStore();
  const created = s.insert("workspaceInvites", data);
  await s.commit();
  return created;
}

export async function getWorkspaceInviteByToken(token: string) {
  return getStore().find("workspaceInvites", i => i.token === token);
}

export async function getPendingInvitesByEmail(email: string) {
  return getStore().select("workspaceInvites", i => i.email === email && i.status === "pending");
}

export async function acceptWorkspaceInvite(inviteId: number, userId: number) {
  const s = getStore();
  const invite = s.find("workspaceInvites", i => i.id === inviteId);
  if (!invite) throw new Error("Invite not found");

  s.insert("workspaceMembers", {
    workspaceId: invite.workspaceId,
    userId,
    role: invite.role,
    status: "active",
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
  });
  s.update("workspaceInvites", i => i.id === inviteId, {
    status: "accepted",
    acceptedAt: new Date(),
    acceptedBy: userId,
  });
  await s.commit();
  return s.find("workspaceInvites", i => i.id === inviteId);
}

// ─── Contas compartilhadas ───────────────────────────────────────────────────

export async function createSharedAccount(data: Insert<"sharedAccounts">): Promise<SharedAccount> {
  const s = getStore();
  const created = s.insert("sharedAccounts", data);
  await s.commit();
  return created;
}

export async function getSharedAccountsByWorkspace(workspaceId: number) {
  return getStore().select("sharedAccounts", a => a.workspaceId === workspaceId);
}

// ─── Responsabilidades ───────────────────────────────────────────────────────

export async function addTransactionResponsibility(
  data: Insert<"transactionResponsibilities">
): Promise<TransactionResponsibility> {
  const s = getStore();
  const created = s.insert("transactionResponsibilities", data);
  await s.commit();
  return created;
}

export async function getTransactionResponsibilities(transactionId: number) {
  return getStore().select("transactionResponsibilities", r => r.transactionId === transactionId);
}

export async function removeTransactionResponsibility(id: number) {
  const s = getStore();
  const removed = s.find("transactionResponsibilities", r => r.id === id);
  s.delete("transactionResponsibilities", r => r.id === id);
  await s.commit();
  return removed;
}

// ─── Auditoria ───────────────────────────────────────────────────────────────

export async function logAuditAction(data: Insert<"auditLog">): Promise<AuditLog> {
  const s = getStore();
  const created = s.insert("auditLog", data);
  await s.commit();
  return created;
}

export async function getAuditLogByWorkspace(workspaceId: number, limit = 100) {
  return getStore()
    .select("auditLog", a => a.workspaceId === workspaceId)
    .sort(byNewest)
    .slice(0, limit);
}

// ─── Pessoas da área de trabalho ─────────────────────────────────────────────
//
// As pessoas são as linhas da aba `Usuarios` da planilha ativa: quem já entrou
// (active), convidados que ainda não abriram a área (invited) e pessoas sem
// acesso que só aparecem como responsáveis (guest).

const PERSON_COLORS = [
  "#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6",
  "#06B6D4", "#EF4444", "#14B8A6", "#F97316", "#6366F1",
];

export type Person = {
  id: number;
  name: string;
  email: string | null;
  status: UserStatus;
  role: User["role"];
  color: string;
};

function toPerson(u: User): Person {
  return {
    id: u.id,
    name: u.name || u.email?.split("@")[0] || `Pessoa ${u.id}`,
    email: u.email,
    status: u.status ?? "active",
    role: u.role,
    color: u.color || PERSON_COLORS[(u.id - 1) % PERSON_COLORS.length],
  };
}

const STATUS_ORDER: Record<UserStatus, number> = { active: 0, invited: 1, guest: 2, removed: 3 };

/** Pessoas da área (inclui removidas, para exibir o histórico). */
export function listPeople(): Person[] {
  return getStore()
    .select("users")
    .map(toPerson)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "pt-BR")
    );
}

function nextColor(s: SheetStore) {
  const used = new Set(s.select("users").map(u => u.color?.toUpperCase()));
  return PERSON_COLORS.find(c => !used.has(c)) ?? PERSON_COLORS[s.select("users").length % PERSON_COLORS.length];
}

/** Pessoa sem acesso ao app, só para indicar como responsável. */
export async function addGuestPerson(name: string, color?: string) {
  const s = getStore();
  const created = s.insert("users", {
    openId: "",
    name: name.trim(),
    email: null,
    loginMethod: null,
    role: "user",
    status: "guest",
    color: color || nextColor(s),
  });
  await s.commit();
  return toPerson(created);
}

/** Registra (ou reativa) uma pessoa convidada por e-mail. */
export async function upsertInvitedPerson(email: string, name?: string) {
  const s = getStore();
  const normalized = email.trim().toLowerCase();
  const existing = s.find("users", u => u.email?.trim().toLowerCase() === normalized);
  if (existing) {
    if (existing.status === "active" && existing.openId) {
      throw new Error("Essa pessoa já participa desta área de trabalho.");
    }
    s.update("users", u => u.id === existing.id, {
      status: existing.openId ? "active" : "invited",
      name: name?.trim() || existing.name,
    });
    await s.commit();
    return toPerson(s.find("users", u => u.id === existing.id)!);
  }
  const created = s.insert("users", {
    openId: "",
    name: name?.trim() || normalized.split("@")[0],
    email: normalized,
    loginMethod: "google",
    role: "user",
    status: "invited",
    color: nextColor(s),
  });
  await s.commit();
  return toPerson(created);
}

export async function updatePerson(id: number, data: { name?: string; color?: string }) {
  const s = getStore();
  if (!s.find("users", u => u.id === id)) throw new Error("Pessoa não encontrada");
  s.update("users", u => u.id === id, {
    name: data.name?.trim() || undefined,
    color: data.color || undefined,
  });
  await s.commit();
  return toPerson(s.find("users", u => u.id === id)!);
}

/**
 * Tira a pessoa da área. A linha é mantida (status "removed") para que os
 * lançamentos antigos continuem mostrando quem era o responsável.
 */
export async function removePerson(id: number) {
  const s = getStore();
  const person = s.find("users", u => u.id === id);
  if (!person) throw new Error("Pessoa não encontrada");
  const used = s.find("transactions", t => t.responsibleUserId === id);
  if (used || person.openId) {
    s.update("users", u => u.id === id, { status: "removed" });
  } else {
    s.delete("users", u => u.id === id);
  }
  await s.commit();
  return toPerson(person);
}

/** Garante que o responsável informado é uma pessoa ativa da área. */
export function assertResponsible(id: number | null | undefined) {
  if (id === null || id === undefined) return;
  const person = getStore().find("users", u => u.id === id);
  if (!person || person.status === "removed") {
    throw new Error("Responsável inválido: escolha uma pessoa desta área de trabalho.");
  }
}

// ─── Preferências do usuário ─────────────────────────────────────────────────

export async function updateUserTimezone(userId: number, timezone: string) {
  const s = getStore();
  s.update("users", u => u.id === userId, { timezone });
  await s.commit();
  return { success: true } as const;
}

export async function getUserTimezone(userId: number): Promise<string> {
  return getStore().find("users", u => u.id === userId)?.timezone ?? "America/Sao_Paulo";
}
