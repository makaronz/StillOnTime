import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "./database-types";
import { config } from "./config";
import { logger } from "@/utils/logger";

// Create PostgreSQL connection pool
export const pool = new Pool({
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

// Migration complete - prisma alias removed

// Handle graceful shutdown.
// db.destroy() zamyka juz pule, ktora Kysely dostal przez PostgresDialect —
// dodatkowe pool.end() powodowalo "Called end on pool more than once"
// (widoczne jako unhandledRejection przy kazdym zamknieciu, m.in. w db:init).
// Handlery zdarzen sa synchroniczne i tylko odpalaja zamkniecie: przekazanie
// funkcji async do process.on zostawia odrzucenie promisy bez obslugi.
let shuttingDown = false;

const closeDatabase = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  await db.destroy();
};

process.on("beforeExit", () => {
  void closeDatabase();
});

process.on("SIGINT", () => {
  void closeDatabase().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void closeDatabase().finally(() => process.exit(0));
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

    // In development, allow server to start without database
    if (config.nodeEnv === "development") {
      logger.warn("⚠️ Development mode: Continuing without database connection");
      return;
    }

    throw error;
  }
};
