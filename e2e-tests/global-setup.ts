import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global setup for StillOnTime E2E tests...");

  // Wait for services to be ready
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Check if backend is ready
    console.log("⏳ Waiting for backend service...");
    let backendReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!backendReady && attempts < maxAttempts) {
      try {
        const response = await page.goto("http://localhost:3001/health", {
          waitUntil: "networkidle",
          timeout: 5000,
        });
        if (response?.ok()) {
          backendReady = true;
          console.log("✅ Backend service is ready");
        }
      } catch (error) {
        attempts++;
        console.log(
          `⏳ Backend not ready yet (attempt ${attempts}/${maxAttempts})`
        );
        await page.waitForTimeout(2000);
      }
    }

    if (!backendReady) {
      throw new Error("Backend service failed to start within timeout");
    }

    // Check if frontend is ready
    console.log("⏳ Waiting for frontend service...");
    let frontendReady = false;
    attempts = 0;

    while (!frontendReady && attempts < maxAttempts) {
      try {
        const response = await page.goto("http://localhost:3000", {
          waitUntil: "networkidle",
          timeout: 5000,
        });
        if (response?.ok()) {
          frontendReady = true;
          console.log("✅ Frontend service is ready");
        }
      } catch (error) {
        attempts++;
        console.log(
          `⏳ Frontend not ready yet (attempt ${attempts}/${maxAttempts})`
        );
        await page.waitForTimeout(2000);
      }
    }

    if (!frontendReady) {
      throw new Error("Frontend service failed to start within timeout");
    }

    console.log("🎉 All services are ready for testing!");
  } finally {
    await browser.close();
  }
}

export default globalSetup;
