import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, decimal } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  googleSheetsId: varchar("googleSheetsId", { length: 255 }),
  googleSheetsAccessToken: text("googleSheetsAccessToken"),
  googleSheetsRefreshToken: text("googleSheetsRefreshToken"),
  googleSheetsConnected: int("googleSheetsConnected").default(0).notNull(),
  // Configurações de competência padrão
  competencyStartDay: int("competencyStartDay").default(1).notNull(), // Dia de início (1-31)
  competencyEndDay: int("competencyEndDay").default(0).notNull(), // Dia de fim (0 = último dia do mês)
  // Timezone do usuário (IANA timezone string, ex: "America/Sao_Paulo")
  timezone: varchar("timezone", { length: 64 }).default("America/Sao_Paulo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Competências mensais (períodos contábeis)
export const competencies = mysqlTable("competencies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Janeiro 2026"
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Competency = typeof competencies.$inferSelect;
export type InsertCompetency = typeof competencies.$inferInsert;

// Cartões de crédito
export const creditCards = mysqlTable("creditCards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  lastDigits: varchar("lastDigits", { length: 4 }),
  cutoffDay: int("cutoffDay").notNull(), // Dia do corte (1-31)
  dueDay: int("dueDay").notNull(), // Dia do vencimento (1-31)
  limit: decimal("limit", { precision: 12, scale: 2 }),
  color: varchar("color", { length: 7 }).default("#3B82F6"), // Cor em hex
  isActive: int("isActive").default(1).notNull(), // 0 ou 1
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = typeof creditCards.$inferInsert;

// Lançamentos (receitas e despesas)
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  competencyId: int("competencyId").notNull(),
  creditCardId: int("creditCardId"), // NULL para receitas ou despesas em dinheiro
  type: mysqlEnum("type", ["income", "expense", "credit_card"]).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  transactionDate: timestamp("transactionDate").notNull(), // Data da transação
  dueDate: timestamp("dueDate"), // Data de vencimento (para despesas)
  installments: int("installments").default(1), // Número de parcelas
  currentInstallment: int("currentInstallment").default(1), // Parcela atual
  notes: text("notes"),
  links: text("links"), // JSON array de links [{url, title, description}]
  isPaid: int("isPaid").default(0).notNull(), // 0 = não pago, 1 = pago
  paidDate: timestamp("paidDate"), // Data do pagamento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Faturas de cartão de crédito
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  creditCardId: int("creditCardId").notNull(),
  competencyId: int("competencyId").notNull(),
  closingDate: timestamp("closingDate").notNull(), // Data de fechamento
  dueDate: timestamp("dueDate").notNull(), // Data de vencimento
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["open", "partial", "paid"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Relações
export const usersRelations = relations(users, ({ many }) => ({
  competencies: many(competencies),
  creditCards: many(creditCards),
  transactions: many(transactions),
  invoices: many(invoices),
}));

export const competenciesRelations = relations(competencies, ({ one, many }) => ({
  user: one(users, { fields: [competencies.userId], references: [users.id] }),
  transactions: many(transactions),
  invoices: many(invoices),
}));

export const creditCardsRelations = relations(creditCards, ({ one, many }) => ({
  user: one(users, { fields: [creditCards.userId], references: [users.id] }),
  transactions: many(transactions),
  invoices: many(invoices),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  competency: one(competencies, { fields: [transactions.competencyId], references: [competencies.id] }),
  creditCard: one(creditCards, { fields: [transactions.creditCardId], references: [creditCards.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  creditCard: one(creditCards, { fields: [invoices.creditCardId], references: [creditCards.id] }),
  competency: one(competencies, { fields: [invoices.competencyId], references: [competencies.id] }),
}));


// Tipologias de movimentações (categorias customizáveis)
export const typologies = mysqlTable("typologies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "credit_card"]).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // emoji ou nome do ícone
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  isActive: int("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0),
  parentId: int("parentId"), // NULL = categoria raiz; não-nulo = subcategoria
  links: text("links"), // JSON array [{url, title}]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Typology = typeof typologies.$inferSelect;
export type InsertTypology = typeof typologies.$inferInsert;

// Relação de tipologias
export const typologiesRelations = relations(typologies, ({ one }) => ({
  user: one(users, { fields: [typologies.userId], references: [users.id] }),
}));

// Atualizar relação de usuários
export const usersRelationsUpdated = relations(users, ({ many }) => ({
  competencies: many(competencies),
  creditCards: many(creditCards),
  transactions: many(transactions),
  invoices: many(invoices),
  typologies: many(typologies),
}));


// Filtros salvos por usuário
export const savedFilters = mysqlTable("savedFilters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // Nome do filtro (ex: "Últimos 30 dias")
  startDate: date("startDate"),
  endDate: date("endDate"),
  categories: text("categories"), // JSON array de categorias
  types: text("types"), // JSON array de tipos (income, expense, credit_card)
  minAmount: decimal("minAmount", { precision: 12, scale: 2 }),
  maxAmount: decimal("maxAmount", { precision: 12, scale: 2 }),
  isDefault: int("isDefault").default(0).notNull(), // Filtro padrão
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedFilter = typeof savedFilters.$inferSelect;
export type InsertSavedFilter = typeof savedFilters.$inferInsert;

// Relação de filtros salvos
export const savedFiltersRelations = relations(savedFilters, ({ one }) => ({
  user: one(users, { fields: [savedFilters.userId], references: [users.id] }),
}));


// Débitos/Créditos Fixos (Receitas e Despesas Recorrentes)
export const recurringTransactions = mysqlTable("recurringTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate"), // NULL = sem data de término
  accountId: int("accountId"), // NULL = conta principal
  creditCardId: int("creditCardId"), // NULL = não é cartão
  isActive: int("isActive").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type InsertRecurringTransaction = typeof recurringTransactions.$inferInsert;

// Parcelamentos (Installments)
export const installments = mysqlTable("installments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  installmentAmount: decimal("installmentAmount", { precision: 12, scale: 2 }).notNull(),
  totalInstallments: int("totalInstallments").notNull(),
  currentInstallment: int("currentInstallment").default(1).notNull(),
  type: mysqlEnum("type", ["expense", "credit_card"]).notNull(),
  category: varchar("category", { length: 100 }),
  startDate: date("startDate").notNull(),
  creditCardId: int("creditCardId"), // NULL = despesa normal
  isActive: int("isActive").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Installment = typeof installments.$inferSelect;
export type InsertInstallment = typeof installments.$inferInsert;

// Parcelas Geradas (Installment Transactions)
export const installmentTransactions = mysqlTable("installmentTransactions", {
  id: int("id").autoincrement().primaryKey(),
  installmentId: int("installmentId").notNull(),
  transactionId: int("transactionId"),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate").notNull(),
  paidDate: date("paidDate"),
  status: mysqlEnum("status", ["pending", "paid", "overdue"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InstallmentTransaction = typeof installmentTransactions.$inferSelect;
export type InsertInstallmentTransaction = typeof installmentTransactions.$inferInsert;

// Relações
export const recurringTransactionsRelations = relations(recurringTransactions, ({ one }) => ({
  user: one(users, { fields: [recurringTransactions.userId], references: [users.id] }),
  creditCard: one(creditCards, { fields: [recurringTransactions.creditCardId], references: [creditCards.id] }),
}));

export const installmentsRelations = relations(installments, ({ one, many }) => ({
  user: one(users, { fields: [installments.userId], references: [users.id] }),
  creditCard: one(creditCards, { fields: [installments.creditCardId], references: [creditCards.id] }),
  transactions: many(installmentTransactions),
}));

export const installmentTransactionsRelations = relations(installmentTransactions, ({ one }) => ({
  installment: one(installments, { fields: [installmentTransactions.installmentId], references: [installments.id] }),
  transaction: one(transactions, { fields: [installmentTransactions.transactionId], references: [transactions.id] }),
}));

// Contas (Bank Accounts)
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // Ex: "Conta Corrente", "Poupança"
  type: mysqlEnum("type", ["checking", "savings", "investment"]).default("checking").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"), // Saldo atual
  initialBalance: decimal("initialBalance", { precision: 12, scale: 2 }).notNull().default("0"), // Saldo inicial
  color: varchar("color", { length: 7 }).default("#3B82F6"), // Cor em hex
  isActive: int("isActive").default(1).notNull(), // 0 ou 1
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// Relações de contas
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));


// ===== TABELAS COLABORATIVAS =====

// Workspaces (Espaços Compartilhados)
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // Usuário que criou o workspace
  name: varchar("name", { length: 100 }).notNull(), // Ex: "Financeiro Familiar"
  description: text("description"), // Descrição do workspace
  type: mysqlEnum("type", ["personal", "family", "business"]).default("personal").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

// Membros do Workspace
export const workspaceMembers = mysqlTable("workspaceMembers", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "editor", "viewer"]).default("viewer").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  invitedBy: int("invitedBy"), // ID do usuário que convidou
  invitedAt: timestamp("invitedAt"),
  status: mysqlEnum("status", ["active", "pending", "declined"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;

// Convites para Workspace
export const workspaceInvites = mysqlTable("workspaceInvites", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  email: varchar("email", { length: 320 }).notNull(), // Email do convidado
  token: varchar("token", { length: 64 }).notNull().unique(), // Token único para aceitar convite
  role: mysqlEnum("role", ["owner", "editor", "viewer"]).default("viewer").notNull(),
  invitedBy: int("invitedBy").notNull(), // ID do usuário que convidou
  expiresAt: timestamp("expiresAt"), // Data de expiração do convite
  acceptedAt: timestamp("acceptedAt"), // Data de aceitação
  acceptedBy: int("acceptedBy"), // ID do usuário que aceitou
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type InsertWorkspaceInvite = typeof workspaceInvites.$inferInsert;

// Contas Compartilhadas (com tipo de compartilhamento)
export const sharedAccounts = mysqlTable("sharedAccounts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(), // Referência à conta original
  workspaceId: int("workspaceId").notNull(), // Workspace onde é compartilhada
  shareType: mysqlEnum("shareType", ["individual", "joint", "shared"]).default("shared").notNull(),
  // individual: conta de um membro
  // joint: conta compartilhada entre múltiplos membros (cada um responsável por seus lançamentos)
  // shared: conta totalmente compartilhada (qualquer membro pode editar)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SharedAccount = typeof sharedAccounts.$inferSelect;
export type InsertSharedAccount = typeof sharedAccounts.$inferInsert;

// Responsabilidades de Lançamentos (quem é responsável por cada transação)
export const transactionResponsibilities = mysqlTable("transactionResponsibilities", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  userId: int("userId").notNull(), // Usuário responsável
  percentage: decimal("percentage", { precision: 5, scale: 2 }).default("100"), // Percentual de responsabilidade
  notes: text("notes"), // Notas sobre a responsabilidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransactionResponsibility = typeof transactionResponsibilities.$inferSelect;
export type InsertTransactionResponsibility = typeof transactionResponsibilities.$inferInsert;

// Auditoria de Ações (log de quem fez o quê)
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(), // Quem fez a ação
  action: varchar("action", { length: 50 }).notNull(), // Ex: "created_transaction", "updated_account"
  entityType: varchar("entityType", { length: 50 }).notNull(), // Ex: "transaction", "account"
  entityId: int("entityId"), // ID da entidade afetada
  changes: text("changes"), // JSON com as mudanças
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// Relações Colaborativas
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  invites: many(workspaceInvites),
  sharedAccounts: many(sharedAccounts),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
  invitedByUser: one(users, { fields: [workspaceMembers.invitedBy], references: [users.id] }),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceInvites.workspaceId], references: [workspaces.id] }),
  invitedByUser: one(users, { fields: [workspaceInvites.invitedBy], references: [users.id] }),
  acceptedByUser: one(users, { fields: [workspaceInvites.acceptedBy], references: [users.id] }),
}));

export const sharedAccountsRelations = relations(sharedAccounts, ({ one }) => ({
  account: one(accounts, { fields: [sharedAccounts.accountId], references: [accounts.id] }),
  workspace: one(workspaces, { fields: [sharedAccounts.workspaceId], references: [workspaces.id] }),
}));

export const transactionResponsibilitiesRelations = relations(transactionResponsibilities, ({ one }) => ({
  transaction: one(transactions, { fields: [transactionResponsibilities.transactionId], references: [transactions.id] }),
  user: one(users, { fields: [transactionResponsibilities.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  workspace: one(workspaces, { fields: [auditLog.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));
