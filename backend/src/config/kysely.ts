import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "./database-types";
import { logger } from "@/utils/logger";

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Kysely database instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Test connection
    await pool.query("SELECT 1");
    logger.info("✅ Database connected successfully", {
      environment: process.env.NODE_ENV,
      version: "1.0.0",
    });
  } catch (error) {
    logger.error("❌ Failed to connect to database", { error });
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await db.destroy();
    await pool.end();
    logger.info("Database connection closed", {
      environment: process.env.NODE_ENV,
      version: "1.0.0",
    });
  } catch (error) {
    logger.error("Error closing database connection", { error });
    throw error;
  }
}
