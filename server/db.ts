import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, competencies, creditCards, transactions, invoices, typologies, savedFilters, recurringTransactions, installments, installmentTransactions, accounts, Account, InsertAccount, InsertCreditCard, InsertTransaction, InsertTypology, InsertRecurringTransaction, InsertInstallment, InsertInstallmentTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';
import { calculateInvoiceDates } from './competencyLogic';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: any = null;

// Lazily create the drizzle instance with proper mysql2 pool
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = mysql.createPool({
          uri: process.env.DATABASE_URL,
          connectionLimit: 10,
          enableKeepAlive: true,
          waitForConnections: true,
          queueLimit: 0,
        });
      }
      _db = drizzle(_pool);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Competências
export async function getOrCreateCurrentCompetency(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now);

  // Capitalize first letter
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  const existing = await db
    .select()
    .from(competencies)
    .where(
      and(
        eq(competencies.userId, userId),
        eq(competencies.year, year),
        eq(competencies.month, month)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Create new competency
  await db.insert(competencies).values({
    userId,
    year,
    month,
    name: capitalizedName,
  });

  // Fetch and return the created competency
  const created = await db
    .select()
    .from(competencies)
    .where(
      and(
        eq(competencies.userId, userId),
        eq(competencies.year, year),
        eq(competencies.month, month)
      )
    )
    .limit(1);

  return created[0]!;
}

export async function getOrCreateCompetencyByYearMonth(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  const existing = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.userId, userId), eq(competencies.year, year), eq(competencies.month, month)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(competencies).values({ userId, year, month, name: capitalizedName });

  const created = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.userId, userId), eq(competencies.year, year), eq(competencies.month, month)))
    .limit(1);

  return created[0]!;
}

export async function getUserCompetencies(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(competencies).where(eq(competencies.userId, userId)).orderBy(desc(competencies.year), desc(competencies.month));
}

// Cartões de Crédito
export async function getUserCreditCards(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(creditCards).where(and(eq(creditCards.userId, userId), eq(creditCards.isActive, 1)));
}

export async function createCreditCard(data: InsertCreditCard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(creditCards).values(data);
  // Return the created card by querying it back
  const created = await db.select().from(creditCards).where(eq(creditCards.userId, data.userId!)).orderBy(desc(creditCards.createdAt)).limit(1);
  return created[0]!;
}

// Transações
export async function getCompetencyTransactions(competencyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(transactions).where(eq(transactions.competencyId, competencyId)).orderBy(desc(transactions.transactionDate));
}

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(transactions).values(data);
  // Return the created transaction by querying it back
  const created = await db.select().from(transactions).where(eq(transactions.userId, data.userId)).orderBy(desc(transactions.createdAt)).limit(1);
  return created[0]!;
}

// Faturas
export async function getCompetencyInvoices(competencyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(invoices).where(eq(invoices.competencyId, competencyId)).orderBy(desc(invoices.dueDate));
}


export async function upsertInvoiceForCreditCard(
  userId: number,
  creditCardId: number,
  competencyId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(creditCards).where(eq(creditCards.id, creditCardId)).limit(1);
  if (!card) return;

  const [competency] = await db.select().from(competencies).where(eq(competencies.id, competencyId)).limit(1);
  if (!competency) return;

  const { closingDate, dueDate } = calculateInvoiceDates(card, competency.year, competency.month);

  const txs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.creditCardId, creditCardId),
        eq(transactions.competencyId, competencyId)
      )
    );

  const total = txs.reduce((sum, t) => sum + parseFloat(String(t.amount) || "0"), 0);

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.creditCardId, creditCardId), eq(invoices.competencyId, competencyId)))
    .limit(1);

  if (existing) {
    await db
      .update(invoices)
      .set({ totalAmount: total.toFixed(2) })
      .where(eq(invoices.id, existing.id));
  } else {
    await db.insert(invoices).values({
      userId,
      creditCardId,
      competencyId,
      closingDate,
      dueDate,
      totalAmount: total.toFixed(2),
      paidAmount: "0",
      status: "open",
    });
  }
}

export async function updateInvoicePayment(invoiceId: number, paidAmount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new Error("Invoice not found");

  const total = parseFloat(String(invoice.totalAmount));
  const status = paidAmount <= 0 ? "open" : paidAmount >= total ? "paid" : "partial";

  await db
    .update(invoices)
    .set({ paidAmount: paidAmount.toFixed(2), status })
    .where(eq(invoices.id, invoiceId));
}

export async function syncInvoicesForCompetency(userId: number, competencyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const txs = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.competencyId, competencyId), eq(transactions.type, "credit_card")));

  const cardIds = Array.from(new Set(txs.map((t) => t.creditCardId).filter(Boolean))) as number[];
  for (const cardId of cardIds) {
    await upsertInvoiceForCreditCard(userId, cardId, competencyId);
  }
}

// Tipologias
export async function createTypology(typology: InsertTypology) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(typologies).values(typology);
  return result;
}

export async function getTypologiesByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Retornar todas as tipologias do usuário, ativas ou não
  return db.select().from(typologies).where(eq(typologies.userId, userId)).orderBy(typologies.order);
}

export async function getTypologiesByUserAndType(userId: number, type: "income" | "expense" | "credit_card") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Retornar todas as tipologias do usuário por tipo, ativas ou não
  return db.select().from(typologies).where(and(eq(typologies.userId, userId), eq(typologies.type, type))).orderBy(typologies.order);
}

export async function updateTypology(id: number, updates: Partial<InsertTypology>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(typologies).set(updates).where(eq(typologies.id, id));
}

export async function deleteTypology(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(typologies).where(eq(typologies.id, id));
}


// Google Sheets Integration
export async function updateUserGoogleSheets(
  userId: number,
  googleSheetsId: string,
  accessToken: string,
  refreshToken?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(users).set({
    googleSheetsId,
    googleSheetsAccessToken: accessToken,
    googleSheetsRefreshToken: refreshToken,
    googleSheetsConnected: 1,
  }).where(eq(users.id, userId));
}

export async function getUserGoogleSheetsConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await db.select({
    googleSheetsId: users.googleSheetsId,
    googleSheetsAccessToken: users.googleSheetsAccessToken,
    googleSheetsRefreshToken: users.googleSheetsRefreshToken,
    googleSheetsConnected: users.googleSheetsConnected,
  }).from(users).where(eq(users.id, userId)).limit(1);

  return user.length > 0 ? user[0] : null;
}

export async function disconnectGoogleSheets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(users).set({
    googleSheetsId: null,
    googleSheetsAccessToken: null,
    googleSheetsRefreshToken: null,
    googleSheetsConnected: 0,
  }).where(eq(users.id, userId));
}


// Filtros Salvos
export async function createSavedFilter(
  userId: number,
  filter: {
    name: string;
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    types?: string[];
    minAmount?: number;
    maxAmount?: number;
    isDefault?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(savedFilters).values({
    userId,
    name: filter.name,
    startDate: filter.startDate,
    endDate: filter.endDate,
    categories: filter.categories ? JSON.stringify(filter.categories) : null,
    types: filter.types ? JSON.stringify(filter.types) : null,
    minAmount: filter.minAmount ? filter.minAmount.toString() : null,
    maxAmount: filter.maxAmount ? filter.maxAmount.toString() : null,
    isDefault: filter.isDefault ? 1 : 0,
  });
}

export async function getSavedFilters(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(savedFilters).where(eq(savedFilters.userId, userId));
}

export async function getSavedFilter(filterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(savedFilters).where(eq(savedFilters.id, filterId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateSavedFilter(
  filterId: number,
  filter: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    types?: string[];
    minAmount?: number;
    maxAmount?: number;
    isDefault?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = {};
  if (filter.name) updateData.name = filter.name;
  if (filter.startDate) updateData.startDate = filter.startDate;
  if (filter.endDate) updateData.endDate = filter.endDate;
  if (filter.categories) updateData.categories = JSON.stringify(filter.categories);
  if (filter.types) updateData.types = JSON.stringify(filter.types);
  if (filter.minAmount !== undefined) updateData.minAmount = filter.minAmount.toString();
  if (filter.maxAmount !== undefined) updateData.maxAmount = filter.maxAmount.toString();
  if (filter.isDefault !== undefined) updateData.isDefault = filter.isDefault ? 1 : 0;

  return db.update(savedFilters).set(updateData).where(eq(savedFilters.id, filterId));
}

export async function deleteSavedFilter(filterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(savedFilters).where(eq(savedFilters.id, filterId));
}

// Deletar todos os filtros de um usuário (para limpeza)
export async function deleteAllSavedFilters(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(savedFilters).where(eq(savedFilters.userId, userId));
}

// Configuração de Competência Padrão
export async function updateUserCompetencyConfig(
  userId: number,
  startDay: number,
  endDay: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(users).set({
    competencyStartDay: startDay,
    competencyEndDay: endDay,
  }).where(eq(users.id, userId));
}

export async function getUserCompetencyConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await db.select({
    competencyStartDay: users.competencyStartDay,
    competencyEndDay: users.competencyEndDay,
  }).from(users).where(eq(users.id, userId)).limit(1);

  return user.length > 0 ? user[0] : null;
}


// Transações Recorrentes
export async function createRecurringTransaction(data: InsertRecurringTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(recurringTransactions).values(data);
}

export async function getRecurringTransactions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(recurringTransactions).where(
    and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.isActive, 1))
  );
}

export async function updateRecurringTransaction(id: number, data: Partial<InsertRecurringTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(recurringTransactions).set(data).where(eq(recurringTransactions.id, id));
}

export async function deleteRecurringTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
}

// Parcelamentos
export async function createInstallment(data: InsertInstallment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(installments).values(data);
}

export async function getInstallments(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(installments).where(
    and(eq(installments.userId, userId), eq(installments.isActive, 1))
  );
}

export async function getInstallmentById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(installments).where(eq(installments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateInstallment(id: number, data: Partial<InsertInstallment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(installments).set(data).where(eq(installments.id, id));
}

// Transações de Parcelamento
export async function createInstallmentTransaction(data: InsertInstallmentTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(installmentTransactions).values(data);
}

export async function getInstallmentTransactions(installmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(installmentTransactions).where(eq(installmentTransactions.installmentId, installmentId));
}

export async function updateInstallmentTransaction(id: number, data: Partial<InsertInstallmentTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(installmentTransactions).set(data).where(eq(installmentTransactions.id, id));
}


export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateTransaction(id: number, updates: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(transactions).set(updates).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(transactions).where(eq(transactions.id, id));
}

// Link management for transactions
export interface TransactionLink {
  url: string;
  title?: string;
  description?: string;
}

export async function getTransactionLinks(transactionId: number): Promise<TransactionLink[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!result.length || !result[0].links) return [];
  
  try {
    return JSON.parse(result[0].links);
  } catch {
    return [];
  }
}

export async function addTransactionLink(transactionId: number, link: TransactionLink): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const currentLinks = await getTransactionLinks(transactionId);
  const updatedLinks = [...currentLinks, link];
  
  await db.update(transactions)
    .set({ links: JSON.stringify(updatedLinks) })
    .where(eq(transactions.id, transactionId));
}

export async function updateTransactionLink(transactionId: number, linkIndex: number, link: TransactionLink): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const currentLinks = await getTransactionLinks(transactionId);
  if (linkIndex >= 0 && linkIndex < currentLinks.length) {
    currentLinks[linkIndex] = link;
    await db.update(transactions)
      .set({ links: JSON.stringify(currentLinks) })
      .where(eq(transactions.id, transactionId));
  }
}

export async function deleteTransactionLink(transactionId: number, linkIndex: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const currentLinks = await getTransactionLinks(transactionId);
  const updatedLinks = currentLinks.filter((_, index) => index !== linkIndex);
  
  await db.update(transactions)
    .set({ links: updatedLinks.length > 0 ? JSON.stringify(updatedLinks) : null })
    .where(eq(transactions.id, transactionId));
}

export async function setTransactionLinks(transactionId: number, links: TransactionLink[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions)
    .set({ links: links.length > 0 ? JSON.stringify(links) : null })
    .where(eq(transactions.id, transactionId));
}


// Contas (Bank Accounts)
export async function createAccount(data: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(accounts).values(data);
}

export async function getUserAccounts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(accounts).where(
    and(eq(accounts.userId, userId), eq(accounts.isActive, 1))
  ).orderBy(desc(accounts.createdAt));
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAccount(id: number, data: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(accounts).set(data).where(eq(accounts.id, id));
}

export async function updateAccountBalance(id: number, newBalance: number | string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(accounts).set({ balance: newBalance.toString() as any }).where(eq(accounts.id, id));
}

export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(accounts).set({ isActive: 0 }).where(eq(accounts.id, id));
}
