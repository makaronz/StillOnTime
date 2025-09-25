import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Running global teardown for StillOnTime E2E tests...");

  // Clean up any global resources if needed
  // For now, just log completion
  console.log("✅ Global teardown completed");
}

export default globalTeardown;
