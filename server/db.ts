import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, competencies, creditCards, transactions, invoices, InsertCreditCard, InsertTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
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
