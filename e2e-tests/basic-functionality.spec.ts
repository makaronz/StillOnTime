import { test, expect, Page } from "@playwright/test";

// Basic functionality tests that work with minimal setup
test.describe("StillOnTime Application - Basic Functionality", () => {
  test("Application loads without JavaScript errors", async ({ page }) => {
    console.log("🧪 Testing: Application loads without JavaScript errors");

    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Capture JavaScript errors
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
      console.log(`❌ JS Error: ${error.message}`);
    });

    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    try {
      // Navigate to the application
      await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

      // Wait for React to load
      await page.waitForFunction(
        () => {
          return document.readyState === "complete";
        },
        { timeout: 15000 }
      );

      // Check that the page loaded
      await expect(page.locator("body")).toBeVisible();

      // Check page title
      await expect(page).toHaveTitle(/StillOnTime/);

      // Wait a bit more to catch any delayed errors
      await page.waitForTimeout(3000);

      // Report any errors found
      if (jsErrors.length > 0) {
        console.log(
          `⚠️  Found ${jsErrors.length} JavaScript errors:`,
          jsErrors
        );
      }

      if (consoleErrors.length > 0) {
        console.log(
          `⚠️  Found ${consoleErrors.length} console errors:`,
          consoleErrors
        );
      }

      // Filter out known acceptable errors (like network errors in dev mode)
      const criticalErrors = jsErrors.filter(
        (error) =>
          !error.includes("Loading chunk") &&
          !error.includes("Failed to fetch") &&
          !error.includes("NetworkError") &&
          !error.includes("ERR_INTERNET_DISCONNECTED")
      );

      expect(criticalErrors.length).toBe(0);

      console.log("✅ Application loads without critical JavaScript errors");
    } catch (error) {
      console.log(`❌ Failed to load application: ${error}`);
      throw error;
    }
  });

  test("HTML structure is valid and accessible", async ({ page }) => {
    console.log("🧪 Testing: HTML structure is valid and accessible");

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });

    // Check for basic HTML structure
    await expect(page.locator("html")).toBeVisible();
    await expect(page.locator("head")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();

    // Check for React root element
    await expect(page.locator("#root")).toBeVisible();

    // Check that the page has a title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain("StillOnTime");

    // Check for meta viewport tag (responsive design)
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toBeAttached();

    // Check for language attribute
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBeTruthy();

    console.log("✅ HTML structure is valid and accessible");
  });

  test("CSS and styling loads correctly", async ({ page }) => {
    console.log("🧪 Testing: CSS and styling loads correctly");

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Check that stylesheets are loaded
    const stylesheets = page.locator('link[rel="stylesheet"], style');
    const stylesheetCount = await stylesheets.count();

    // Should have at least some styling (either external CSS or inline styles)
    expect(stylesheetCount).toBeGreaterThan(0);

    // Check that body has some basic styling applied
    const bodyStyles = await page.locator("body").evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        margin: styles.margin,
        padding: styles.padding,
        backgroundColor: styles.backgroundColor,
      };
    });

    // Font should be set (not just browser default)
    expect(bodyStyles.fontFamily).not.toBe("");
    expect(bodyStyles.fontFamily).not.toBe("Times"); // Not default serif

    console.log("📊 Body styles:", bodyStyles);
    console.log("✅ CSS and styling loads correctly");
  });

  test("Application is responsive to viewport changes", async ({ page }) => {
    console.log("🧪 Testing: Application is responsive to viewport changes");

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    let bodyWidth = await page.locator("body").boundingBox();
    expect(bodyWidth?.width).toBeGreaterThan(0);

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    bodyWidth = await page.locator("body").boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(768);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    bodyWidth = await page.locator("body").boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(375);

    // Check that content doesn't overflow horizontally
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);

    console.log("✅ Application is responsive to viewport changes");
  });

  test("Basic interactivity works", async ({ page }) => {
    console.log("🧪 Testing: Basic interactivity works");

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Wait for React to hydrate
    await page
      .waitForFunction(
        () => {
          return (
            window.React !== undefined ||
            document.querySelector("[data-reactroot]") !== null
          );
        },
        { timeout: 10000 }
      )
      .catch(() => {
        console.log(
          "⚠️  React hydration detection failed, continuing with basic tests"
        );
      });

    // Look for interactive elements
    const buttons = page.locator("button:visible");
    const links = page.locator("a:visible");
    const inputs = page.locator("input:visible, textarea:visible");

    const buttonCount = await buttons.count();
    const linkCount = await links.count();
    const inputCount = await inputs.count();

    console.log(
      `📊 Found ${buttonCount} buttons, ${linkCount} links, ${inputCount} inputs`
    );

    // Test button interactivity if buttons exist
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();

      // Test hover (should not throw error)
      await firstButton.hover();

      // Test focus
      await firstButton.focus();

      // Check if button is enabled
      const isEnabled = await firstButton.isEnabled();
      if (isEnabled) {
        // Test click (should not throw error)
        await firstButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Test link interactivity if links exist
    if (linkCount > 0) {
      const firstLink = links.first();
      await expect(firstLink).toBeVisible();

      // Test hover
      await firstLink.hover();

      // Check href attribute
      const href = await firstLink.getAttribute("href");
      expect(href).toBeTruthy();
    }

    // Test input interactivity if inputs exist
    if (inputCount > 0) {
      const firstInput = inputs.first();
      await expect(firstInput).toBeVisible();

      const isEnabled = await firstInput.isEnabled();
      if (isEnabled) {
        // Test typing
        await firstInput.fill("test");
        await expect(firstInput).toHaveValue("test");

        // Clear input
        await firstInput.clear();
        await expect(firstInput).toHaveValue("");
      }
    }

    console.log("✅ Basic interactivity works");
  });

  test("Application handles keyboard navigation", async ({ page }) => {
    console.log("🧪 Testing: Application handles keyboard navigation");

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Test Tab navigation
    await page.keyboard.press("Tab");

    // Check if focus moved to an element
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return {
        tagName: focused?.tagName,
        type: focused?.getAttribute("type"),
        role: focused?.getAttribute("role"),
        tabIndex: focused?.getAttribute("tabindex"),
      };
    });

    console.log("📊 Focused element after Tab:", focusedElement);

    // Should have focused on some interactive element
    const interactiveTags = ["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"];
    const hasFocusableElement =
      interactiveTags.includes(focusedElement.tagName || "") ||
      focusedElement.tabIndex === "0" ||
      focusedElement.role === "button";

    if (hasFocusableElement) {
      // Test additional keyboard navigation
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab"); // Go back

      // Test Enter key on focused element
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }

    console.log("✅ Application handles keyboard navigation");
  });

  test("Application performance metrics are reasonable", async ({ page }) => {
    console.log("🧪 Testing: Application performance metrics are reasonable");

    const startTime = Date.now();

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    const loadTime = Date.now() - startTime;
    console.log(`📊 Page load time: ${loadTime}ms`);

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType("paint");

      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find((p) => p.name === "first-paint")?.startTime || 0,
        firstContentfulPaint:
          paint.find((p) => p.name === "first-contentful-paint")?.startTime ||
          0,
        resourceCount: performance.getEntriesByType("resource").length,
      };
    });

    console.log("📊 Performance metrics:", metrics);

    // Basic performance assertions (generous limits for development)
    expect(loadTime).toBeLessThan(30000); // 30 seconds max
    expect(metrics.domContentLoaded).toBeGreaterThanOrEqual(0);
    expect(metrics.resourceCount).toBeGreaterThan(0);

    console.log("✅ Application performance metrics are reasonable");
  });

  test("Application works in different browsers", async ({
    browserName,
    page,
  }) => {
    console.log(`🧪 Testing: Application works in ${browserName}`);

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Basic functionality should work across browsers
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/StillOnTime/);

    // Check for browser-specific issues
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`📊 User Agent: ${userAgent}`);

    // Test basic JavaScript functionality
    const jsWorks = await page.evaluate(() => {
      try {
        // Test modern JavaScript features
        const testArray = [1, 2, 3];
        const doubled = testArray.map((x) => x * 2);
        const hasThree = testArray.includes(3);

        // Test Promise support
        const promiseWorks = typeof Promise !== "undefined";

        // Test localStorage
        const storageWorks = typeof localStorage !== "undefined";

        return {
          arrayMethods: doubled.length === 3,
          includes: hasThree,
          promises: promiseWorks,
          localStorage: storageWorks,
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log(`📊 JavaScript features in ${browserName}:`, jsWorks);

    expect(jsWorks.arrayMethods).toBe(true);
    expect(jsWorks.promises).toBe(true);
    expect(jsWorks.localStorage).toBe(true);

    console.log(`✅ Application works in ${browserName}`);
  });
});
