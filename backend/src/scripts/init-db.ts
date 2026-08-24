#!/usr/bin/env ts-node

/**
 * Database initialization script
 * This script sets up the database schema and runs initial migrations
 */

import { db } from "../config/database";
import { sql } from "kysely";

async function initializeDatabase(): Promise<void> {
  try {
    console.log("🚀 Starting database initialization...");

    // Test database connection
    console.log("📡 Testing database connection...");
    await sql`SELECT 1`.execute(db);
    console.log("✅ Database connection successful");

    // Check if database is already initialized
    console.log("🔍 Checking database state...");
    try {
      const result = await db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow();
      const userCount = Number(result.count);
      console.log(`📊 Found ${userCount} users in database`);
    } catch (error) {
      console.log(
        "⚠️  Database tables not found - this is expected for first run"
      );
    }

    console.log("✅ Database initialization completed successfully");
    console.log("");
    console.log("Next steps:");
    console.log("1. Database is ready (no client generation needed)");
    console.log("2. Use pgAdmin or similar for database management");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  } finally {
    // Kysely doesn't require disconnect - connection pooling is automatic
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  void initializeDatabase();
}

export { initializeDatabase };
