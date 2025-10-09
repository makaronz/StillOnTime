import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";

const pool = new Pool({
  connectionString: "postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation",
  max: 5,
  connectionTimeoutMillis: 10000,
});

const db = new Kysely<any>({
  dialect: new PostgresDialect({ pool }),
});

async function test() {
  try {
    console.log("Testing PostgreSQL connection with Kysely...");

    // Test raw pg connection
    const result = await pool.query("SELECT 1 as test");
    console.log("✅ Raw pg connection successful:", result.rows[0]);

    // Test Kysely query
    const kyselyResult = await db.selectFrom("users").selectAll().limit(1).execute();
    console.log("✅ Kysely query successful, found", kyselyResult.length, "users");

    await db.destroy();
    await pool.end();
    console.log("✅ All tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

test();
