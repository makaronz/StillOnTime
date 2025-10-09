import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "./database-types";
import { config } from "./config";
import { logger } from "@/utils/logger";

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.databaseUrl,
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

// Export prisma alias for backward compatibility during migration
export const prisma = db;

// Handle graceful shutdown
process.on("beforeExit", async () => {
  await db.destroy();
  await pool.end();
});

process.on("SIGINT", async () => {
  await db.destroy();
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await db.destroy();
  await pool.end();
  process.exit(0);
});

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    logger.error("Database connection failed", { error });
    return false;
  }
};

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Test connection
    await pool.query("SELECT 1");
    logger.info("✅ Database connected successfully", {
      environment: config.nodeEnv,
      version: "1.0.0",
    });

    // Run health check
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error("Database health check failed");
    }
  } catch (error) {
    logger.error("❌ Failed to connect to database", { error });
    throw error;
  }
};
