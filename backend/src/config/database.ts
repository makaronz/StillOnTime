import { PrismaClient } from "@prisma/client";
import { config } from "./config";

// Create Prisma client with proper configuration
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log:
    config.nodeEnv === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  errorFormat: "pretty",
});

// Handle graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
};

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    // Run a simple query to verify connection
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error("Database health check failed");
    }
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    throw error;
  }
};
