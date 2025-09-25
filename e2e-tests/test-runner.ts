#!/usr/bin/env node

/**
 * StillOnTime E2E Test Runner
 *
 * This script provides utilities for running E2E tests with proper setup and teardown.
 */

import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";

interface TestConfig {
  headless: boolean;
  browser: string;
  timeout: number;
  retries: number;
  workers: number;
}

class TestRunner {
  private backendProcess: ChildProcess | null = null;
  private frontendProcess: ChildProcess | null = null;
  private config: TestConfig;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      headless: true,
      browser: "chromium",
      timeout: 30000,
      retries: 1,
      workers: 1,
      ...config,
    };
  }

  async startServices(): Promise<void> {
    console.log("🚀 Starting services for E2E tests...");

    // Start backend
    console.log("📡 Starting backend service...");
    this.backendProcess = spawn("npm", ["run", "dev:backend"], {
      stdio: "pipe",
      detached: false,
    });

    // Start frontend
    console.log("🌐 Starting frontend service...");
    this.frontendProcess = spawn("npm", ["run", "dev:frontend"], {
      stdio: "pipe",
      detached: false,
    });

    // Wait for services to be ready
    await this.waitForServices();
  }

  async waitForServices(): Promise<void> {
    console.log("⏳ Waiting for services to be ready...");

    const maxAttempts = 60; // 2 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Check backend health
        const backendResponse = await fetch("http://localhost:3001/health");
        const frontendResponse = await fetch("http://localhost:3000");

        if (backendResponse.ok && frontendResponse.ok) {
          console.log("✅ All services are ready!");
          return;
        }
      } catch (error) {
        // Services not ready yet
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (attempts % 10 === 0) {
        console.log(`⏳ Still waiting... (${attempts}/${maxAttempts})`);
      }
    }

    throw new Error("Services failed to start within timeout");
  }

  async stopServices(): Promise<void> {
    console.log("🛑 Stopping services...");

    if (this.backendProcess) {
      this.backendProcess.kill("SIGTERM");
      this.backendProcess = null;
    }

    if (this.frontendProcess) {
      this.frontendProcess.kill("SIGTERM");
      this.frontendProcess = null;
    }

    // Wait a moment for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("✅ Services stopped");
  }

  async runTests(testPattern?: string): Promise<boolean> {
    console.log("🧪 Running E2E tests...");

    const args = ["npx", "playwright", "test", "--config=playwright.config.ts"];

    if (testPattern) {
      args.push(testPattern);
    }

    if (this.config.headless) {
      args.push("--headed=false");
    } else {
      args.push("--headed=true");
    }

    args.push(`--project=${this.config.browser}`);
    args.push(`--timeout=${this.config.timeout}`);
    args.push(`--retries=${this.config.retries}`);
    args.push(`--workers=${this.config.workers}`);

    return new Promise((resolve) => {
      const testProcess = spawn(args[0], args.slice(1), {
        stdio: "inherit",
      });

      testProcess.on("close", (code) => {
        resolve(code === 0);
      });
    });
  }

  async generateReport(): Promise<void> {
    console.log("📊 Generating test report...");

    try {
      await fs.access("test-results");

      // Generate HTML report
      const reportProcess = spawn("npx", ["playwright", "show-report"], {
        stdio: "inherit",
      });

      await new Promise((resolve) => {
        reportProcess.on("close", resolve);
      });
    } catch (error) {
      console.log("⚠️  No test results found to generate report");
    }
  }

  async cleanup(): Promise<void> {
    await this.stopServices();

    // Clean up any temporary files
    try {
      await fs.rmdir("test-results", { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "test";

  const runner = new TestRunner({
    headless: !args.includes("--headed"),
    browser:
      args.find((arg) => arg.startsWith("--browser="))?.split("=")[1] ||
      "chromium",
    timeout: parseInt(
      args.find((arg) => arg.startsWith("--timeout="))?.split("=")[1] || "30000"
    ),
    retries: parseInt(
      args.find((arg) => arg.startsWith("--retries="))?.split("=")[1] || "1"
    ),
    workers: parseInt(
      args.find((arg) => arg.startsWith("--workers="))?.split("=")[1] || "1"
    ),
  });

  let success = false;

  try {
    switch (command) {
      case "test":
        await runner.startServices();
        success = await runner.runTests(args[1]);
        break;

      case "test-only":
        // Run tests without starting services (assumes they're already running)
        success = await runner.runTests(args[1]);
        break;

      case "start-services":
        await runner.startServices();
        console.log("✅ Services started. Press Ctrl+C to stop.");
        process.on("SIGINT", async () => {
          await runner.stopServices();
          process.exit(0);
        });
        // Keep process alive
        await new Promise(() => {});
        break;

      case "report":
        await runner.generateReport();
        success = true;
        break;

      default:
        console.log(
          "Usage: npm run e2e [test|test-only|start-services|report] [test-pattern] [options]"
        );
        console.log("Options:");
        console.log("  --headed          Run tests in headed mode");
        console.log(
          "  --browser=name    Browser to use (chromium, firefox, webkit)"
        );
        console.log("  --timeout=ms      Test timeout in milliseconds");
        console.log("  --retries=n       Number of retries");
        console.log("  --workers=n       Number of parallel workers");
        success = true;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    success = false;
  } finally {
    if (command === "test") {
      await runner.cleanup();
    }
  }

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

export { TestRunner };
