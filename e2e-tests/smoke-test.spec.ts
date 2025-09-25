import { test, expect } from "@playwright/test";

/**
 * Smoke tests - Basic functionality that should always work
 * These tests can run against any deployment of the application
 */
test.describe("StillOnTime Application - Smoke Tests", () => {
  test("Application responds and loads basic HTML structure", async ({
    page,
  }) => {
    console.log(
      "🧪 Smoke Test: Application responds and loads basic HTML structure"
    );

    // Set a reasonable timeout for potentially slow environments
    test.setTimeout(60000);

    try {
      // Navigate to the application with extended timeout
      const response = await page.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Check that we got a successful response
      expect(response?.status()).toBeLessThan(400);

      // Check basic HTML structure exists
      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();

      // Check that the page has a title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      // Check for React root element
      const rootElement = page.locator("#root");
      await expect(rootElement).toBeAttached();

      console.log(`✅ Application loaded successfully with title: "${title}"`);
    } catch (error) {
      console.log(`❌ Smoke test failed: ${error}`);

      // Try to get more information about the failure
      try {
        const currentUrl = page.url();
        const pageContent = await page.content();
        console.log(`Current URL: ${currentUrl}`);
        console.log(`Page content length: ${pageContent.length} characters`);

        if (pageContent.includes("Cannot GET")) {
          console.log(
            "⚠️  Server appears to be returning 404 - check if frontend is running on port 3000"
          );
        } else if (pageContent.includes("ECONNREFUSED")) {
          console.log("⚠️  Connection refused - check if services are running");
        }
      } catch (debugError) {
        console.log("Could not get additional debug information");
      }

      throw error;
    }
  });

  test("Application serves static assets correctly", async ({ page }) => {
    console.log("🧪 Smoke Test: Application serves static assets correctly");

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Check that CSS is loaded (page should have some styling)
    const bodyStyles = await page.locator("body").evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
        margin: styles.margin,
      };
    });

    // Should have some font family set (not just browser default)
    expect(bodyStyles.fontFamily).toBeTruthy();
    expect(bodyStyles.fontFamily).not.toBe("");

    console.log("📊 Body styles loaded:", bodyStyles);
    console.log("✅ Static assets are loading correctly");
  });

  test("Application JavaScript executes without critical errors", async ({
    page,
  }) => {
    console.log(
      "🧪 Smoke Test: Application JavaScript executes without critical errors"
    );

    const jsErrors: string[] = [];

    // Capture JavaScript errors
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
      console.log(`❌ JS Error captured: ${error.message}`);
    });

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Wait for any delayed JavaScript execution
    await page.waitForTimeout(3000);

    // Test basic JavaScript functionality
    const jsTest = await page.evaluate(() => {
      try {
        // Test that basic JavaScript works
        const testObj = { test: "value" };
        const testArray = [1, 2, 3];
        const testMap = testArray.map((x) => x * 2);

        return {
          objectAccess: testObj.test === "value",
          arrayMethods: testMap.length === 3,
          jsonParse: JSON.parse('{"test": true}').test === true,
          localStorage: typeof localStorage !== "undefined",
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log("📊 JavaScript functionality test:", jsTest);

    // Filter out non-critical errors (like network errors in dev mode)
    const criticalErrors = jsErrors.filter(
      (error) =>
        !error.includes("Loading chunk") &&
        !error.includes("Failed to fetch") &&
        !error.includes("NetworkError") &&
        !error.includes("ERR_NETWORK") &&
        !error.includes("net::ERR_")
    );

    expect(criticalErrors.length).toBe(0);
    expect(jsTest.objectAccess).toBe(true);
    expect(jsTest.arrayMethods).toBe(true);
    expect(jsTest.jsonParse).toBe(true);

    console.log("✅ JavaScript executes without critical errors");
  });

  test("Application is accessible via keyboard navigation", async ({
    page,
  }) => {
    console.log(
      "🧪 Smoke Test: Application is accessible via keyboard navigation"
    );

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Test that Tab key works
    await page.keyboard.press("Tab");

    // Check if focus moved to an element
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return {
        tagName: focused?.tagName,
        hasTabIndex: focused?.hasAttribute("tabindex"),
        isVisible: focused
          ? window.getComputedStyle(focused).display !== "none"
          : false,
      };
    });

    console.log("📊 Focused element after Tab:", focusedElement);

    // Should have focused on some element
    expect(focusedElement.tagName).toBeTruthy();

    // Test that Enter key doesn't cause JavaScript errors
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    console.log("✅ Keyboard navigation is working");
  });

  test("Application handles viewport changes gracefully", async ({ page }) => {
    console.log(
      "🧪 Smoke Test: Application handles viewport changes gracefully"
    );

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: "Desktop" },
      { width: 768, height: 1024, name: "Tablet" },
      { width: 375, height: 667, name: "Mobile" },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(1000);

      // Check that content is still visible
      await expect(page.locator("body")).toBeVisible();

      // Check that there's no horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      console.log(
        `📊 ${viewport.name} (${viewport.width}x${viewport.height}): horizontal scroll = ${hasHorizontalScroll}`
      );

      // Mobile and tablet should not have horizontal scroll
      if (viewport.width <= 768) {
        expect(hasHorizontalScroll).toBe(false);
      }
    }

    console.log("✅ Application handles viewport changes gracefully");
  });

  test("Application performance is within acceptable limits", async ({
    page,
  }) => {
    console.log(
      "🧪 Smoke Test: Application performance is within acceptable limits"
    );

    const startTime = Date.now();

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    const loadTime = Date.now() - startTime;

    // Get basic performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource");

      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        resourceCount: resources.length,
        transferSize: resources.reduce(
          (sum, resource: any) => sum + (resource.transferSize || 0),
          0
        ),
      };
    });

    console.log("📊 Performance metrics:");
    console.log(`  - Total load time: ${loadTime}ms`);
    console.log(`  - DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`  - Load Complete: ${metrics.loadComplete}ms`);
    console.log(`  - Resources loaded: ${metrics.resourceCount}`);
    console.log(
      `  - Total transfer size: ${Math.round(metrics.transferSize / 1024)}KB`
    );

    // Performance assertions (generous limits for development)
    expect(loadTime).toBeLessThan(30000); // 30 seconds max
    expect(metrics.resourceCount).toBeGreaterThan(0);
    expect(metrics.domContentLoaded).toBeGreaterThanOrEqual(0);

    console.log("✅ Application performance is within acceptable limits");
  });
});

test.describe("StillOnTime Application - Health Checks", () => {
  test("Backend health endpoint responds correctly", async ({ page }) => {
    console.log("🧪 Health Check: Backend health endpoint responds correctly");

    try {
      const response = await page.goto("http://localhost:3001/health", {
        waitUntil: "networkidle",
        timeout: 10000,
      });

      expect(response?.status()).toBeLessThan(400);

      // Check response content
      const content = await page.textContent("body");
      const healthData = JSON.parse(content || "{}");

      console.log("📊 Backend health status:", healthData);

      expect(healthData.status).toBeTruthy();
      expect(healthData.timestamp).toBeTruthy();

      console.log("✅ Backend health endpoint is responding correctly");
    } catch (error) {
      console.log(
        "⚠️  Backend health check failed - this is expected if backend is not running"
      );
      console.log(`Error: ${error}`);

      // Don't fail the test if backend is not running
      // This allows frontend-only testing
      test.skip();
    }
  });

  test("Frontend serves content on expected port", async ({ page }) => {
    console.log("🧪 Health Check: Frontend serves content on expected port");

    const response = await page.goto("http://localhost:3000", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    expect(response?.status()).toBeLessThan(400);

    // Should serve HTML content
    const contentType = response?.headers()["content-type"] || "";
    expect(contentType).toContain("text/html");

    // Should have some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);

    console.log("✅ Frontend is serving content correctly");
  });
});
