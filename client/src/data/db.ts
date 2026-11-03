/**
 * Operações de dados do aplicativo, gravadas na planilha Google do usuário.
 * Mantém as mesmas funções da antiga camada MySQL (server/db.ts).
 */
import { calculateInvoiceDates } from "./competencyLogic";
import { getStore } from "./session";
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
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from "./schema";

const byNewest = <T extends { createdAt: Date }>(a: T, b: T) =>
  b.createdAt.getTime() - a.createdAt.getTime();

function competencyName(year: number, month: number) {
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

export async function createTransaction(data: Insert<"transactions">) {
  const s = getStore();
  const created = s.insert("transactions", data);
  await s.commit();
  return created;
}

export async function getTransactionById(id: number) {
  return getStore().find("transactions", t => t.id === id);
}

export async function updateTransaction(id: number, updates: Insert<"transactions">) {
  const s = getStore();
  const before = s.find("transactions", t => t.id === id);
  s.update("transactions", t => t.id === id, updates);
  syncInvoicesTouchedBy(s, before, s.find("transactions", t => t.id === id));
  await s.commit();
  return { success: true } as const;
}

export async function deleteTransaction(id: number) {
  const s = getStore();
  const before = s.find("transactions", t => t.id === id);
  s.delete("transactions", t => t.id === id);
  syncInvoicesTouchedBy(s, before, null);
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

function recalcInvoice(s: SheetStore, userId: number, creditCardId: number, competencyId: number) {
  const card = s.find("creditCards", c => c.id === creditCardId);
  const competency = s.find("competencies", c => c.id === competencyId);
  if (!card || !competency) return;

  const total = s
    .select("transactions", t => t.creditCardId === creditCardId && t.competencyId === competencyId)
    .reduce((sum, t) => sum + parseFloat(String(t.amount) || "0"), 0);

  const where = (i: { creditCardId: number; competencyId: number }) =>
    i.creditCardId === creditCardId && i.competencyId === competencyId;

  if (s.find("invoices", where)) {
    s.update("invoices", where, { totalAmount: total.toFixed(2) });
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
