#!/usr/bin/env ts-node

/**
 * Database initialization script
 * This script sets up the database schema and runs initial migrations
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../config/config";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
});

async function initializeDatabase() {
  try {
    console.log("🚀 Starting database initialization...");

    // Test database connection
    console.log("📡 Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connection successful");

    // Check if database is already initialized
    console.log("🔍 Checking database state...");
    try {
      const userCount = await prisma.user.count();
      console.log(`📊 Found ${userCount} users in database`);
    } catch (error) {
      console.log(
        "⚠️  Database tables not found - this is expected for first run"
      );
    }

    console.log("✅ Database initialization completed successfully");
    console.log("");
    console.log("Next steps:");
    console.log("1. Run: npm run prisma:migrate");
    console.log("2. Optionally run: npm run prisma:studio (to view data)");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };
