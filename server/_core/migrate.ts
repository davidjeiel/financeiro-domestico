import fs from "fs";
import mysql from "mysql2/promise";
import path from "path";

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[Migration] DATABASE_URL not set, skipping");
    return;
  }

  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(databaseUrl);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`applied_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(process.cwd(), "drizzle");
    if (!fs.existsSync(migrationsDir)) {
      console.warn("[Migration] drizzle/ not found, skipping");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const [rows] = await connection.execute(
        "SELECT id FROM `__drizzle_migrations` WHERE name = ?",
        [file]
      );
      if ((rows as unknown[]).length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map(s => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await connection.execute(stmt);
      }

      await connection.execute(
        "INSERT INTO `__drizzle_migrations` (name) VALUES (?)",
        [file]
      );
      console.log(`[Migration] Applied: ${file}`);
    }

    console.log("[Migration] Done");
  } catch (error) {
    console.error("[Migration] Failed:", error);
    throw error;
  } finally {
    await connection?.end();
  }
}
