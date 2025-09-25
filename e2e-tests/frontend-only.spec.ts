import { test, expect } from "@playwright/test";

/**
 * Frontend-only tests that don't require backend services
 * These tests can run against just the frontend development server
 */
test.describe("StillOnTime Frontend - Standalone Tests", () => {
  // Override the web server config for frontend-only testing
  test.use({
    baseURL: "http://localhost:3000",
  });

  test("Frontend application loads and displays basic structure", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Frontend application loads and displays basic structure"
    );

    // Set up error tracking
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
      console.log(`❌ JS Error: ${error.message}`);
    });

    try {
      // Navigate to the frontend (assuming it's running on port 3000)
      await page.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Check basic HTML structure
      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("#root")).toBeAttached();

      // Check page title
      const title = await page.title();
      expect(title).toContain("StillOnTime");

      // Wait for React to potentially load
      await page.waitForTimeout(2000);

      // Check that we don't have critical JavaScript errors
      const criticalErrors = jsErrors.filter(
        (error) =>
          !error.includes("Failed to fetch") &&
          !error.includes("NetworkError") &&
          !error.includes("ERR_NETWORK") &&
          !error.includes("Loading chunk")
      );

      if (criticalErrors.length > 0) {
        console.log("⚠️  Critical JavaScript errors found:", criticalErrors);
      }

      // Allow some network errors since backend might not be running
      expect(criticalErrors.length).toBeLessThan(5);

      console.log(`✅ Frontend loaded successfully with title: "${title}"`);
    } catch (error) {
      console.log(`❌ Frontend test failed: ${error}`);

      // Check if it's a connection issue
      if (error.message.includes("ERR_CONNECTION_REFUSED")) {
        console.log(
          "⚠️  Connection refused - make sure frontend is running on port 3000"
        );
        console.log("   Run: cd frontend && npm run dev");
      }

      throw error;
    }
  });

  test("Frontend serves static assets correctly", async ({ page }) => {
    console.log("🧪 Testing: Frontend serves static assets correctly");

    await page.goto("/", { waitUntil: "networkidle", timeout: 15000 });

    // Check that some CSS is loaded
    const hasStyles = await page.evaluate(() => {
      const stylesheets = document.querySelectorAll(
        'link[rel="stylesheet"], style'
      );
      const computedStyle = window.getComputedStyle(document.body);

      return {
        stylesheetCount: stylesheets.length,
        hasFontFamily: computedStyle.fontFamily !== "",
        hasBackgroundColor:
          computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)",
        bodyDisplay: computedStyle.display,
      };
    });

    console.log("📊 Stylesheet info:", hasStyles);

    // Should have some styling
    expect(hasStyles.stylesheetCount).toBeGreaterThan(0);
    expect(hasStyles.hasFontFamily).toBe(true);

    console.log("✅ Static assets are loading correctly");
  });

  test("Frontend JavaScript functionality works", async ({ page }) => {
    console.log("🧪 Testing: Frontend JavaScript functionality works");

    await page.goto("/", { waitUntil: "networkidle", timeout: 15000 });

    // Test basic JavaScript functionality
    const jsTest = await page.evaluate(() => {
      try {
        // Test modern JavaScript features
        const testArray = [1, 2, 3];
        const doubled = testArray.map((x) => x * 2);
        const hasThree = testArray.includes(3);

        // Test object destructuring
        const testObj = { a: 1, b: 2 };
        const { a, b } = testObj;

        // Test arrow functions
        const arrowFunc = (x: number) => x * 2;

        // Test Promise support
        const promiseWorks = typeof Promise !== "undefined";

        // Test localStorage
        const storageWorks = typeof localStorage !== "undefined";

        // Test fetch API
        const fetchWorks = typeof fetch !== "undefined";

        return {
          arrayMethods: doubled.length === 3 && doubled[0] === 2,
          includes: hasThree,
          destructuring: a === 1 && b === 2,
          arrowFunctions: arrowFunc(5) === 10,
          promises: promiseWorks,
          localStorage: storageWorks,
          fetch: fetchWorks,
          reactPresent:
            typeof window.React !== "undefined" ||
            document.querySelector("[data-reactroot]") !== null,
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log("📊 JavaScript functionality test:", jsTest);

    expect(jsTest.arrayMethods).toBe(true);
    expect(jsTest.includes).toBe(true);
    expect(jsTest.destructuring).toBe(true);
    expect(jsTest.arrowFunctions).toBe(true);
    expect(jsTest.promises).toBe(true);
    expect(jsTest.localStorage).toBe(true);
    expect(jsTest.fetch).toBe(true);

    console.log("✅ JavaScript functionality works correctly");
  });

  test("Frontend is responsive across different screen sizes", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Frontend is responsive across different screen sizes"
    );

    await page.goto("/", { waitUntil: "networkidle", timeout: 15000 });

    const viewports = [
      { width: 1920, height: 1080, name: "Desktop Large" },
      { width: 1366, height: 768, name: "Desktop Standard" },
      { width: 768, height: 1024, name: "Tablet Portrait" },
      { width: 1024, height: 768, name: "Tablet Landscape" },
      { width: 375, height: 667, name: "Mobile Portrait" },
      { width: 667, height: 375, name: "Mobile Landscape" },
    ];

    for (const viewport of viewports) {
      console.log(
        `📱 Testing ${viewport.name} (${viewport.width}x${viewport.height})`
      );

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(500);

      // Check that content is visible
      await expect(page.locator("body")).toBeVisible();

      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          hasHorizontalScroll:
            document.body.scrollWidth > document.body.clientWidth,
          documentWidth: document.documentElement.clientWidth,
        };
      });

      console.log(
        `  📊 ${viewport.name}: scroll=${overflow.bodyScrollWidth}, client=${overflow.bodyClientWidth}, overflow=${overflow.hasHorizontalScroll}`
      );

      // Mobile and tablet should not have horizontal overflow
      if (viewport.width <= 768) {
        expect(overflow.hasHorizontalScroll).toBe(false);
      }
    }

    console.log("✅ Frontend is responsive across different screen sizes");
  });

  test("Frontend handles user interactions without errors", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Frontend handles user interactions without errors"
    );

    await page.goto("/", { waitUntil: "networkidle", timeout: 15000 });

    // Track any JavaScript errors during interactions
    const interactionErrors: string[] = [];
    page.on("pageerror", (error) => {
      interactionErrors.push(error.message);
    });

    // Test keyboard navigation
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Test mouse interactions
    await page.mouse.move(100, 100);
    await page.mouse.click(100, 100);
    await page.waitForTimeout(200);

    // Look for interactive elements and test them
    const buttons = page.locator("button:visible");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      console.log(`📊 Found ${buttonCount} buttons to test`);

      // Test first few buttons
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);

        try {
          await button.hover();
          await page.waitForTimeout(100);

          const isEnabled = await button.isEnabled();
          if (isEnabled) {
            await button.click();
            await page.waitForTimeout(200);
          }
        } catch (error) {
          console.log(`⚠️  Button ${i} interaction failed: ${error.message}`);
        }
      }
    }

    // Test input fields if any exist
    const inputs = page.locator("input:visible, textarea:visible");
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      console.log(`📊 Found ${inputCount} input fields to test`);

      const firstInput = inputs.first();
      try {
        await firstInput.click();
        await firstInput.fill("test input");
        await page.waitForTimeout(200);
        await firstInput.clear();
      } catch (error) {
        console.log(`⚠️  Input interaction failed: ${error.message}`);
      }
    }

    // Filter out expected network errors
    const criticalErrors = interactionErrors.filter(
      (error) =>
        !error.includes("Failed to fetch") &&
        !error.includes("NetworkError") &&
        !error.includes("ERR_NETWORK")
    );

    console.log(
      `📊 Interaction errors: ${criticalErrors.length} critical, ${interactionErrors.length} total`
    );

    expect(criticalErrors.length).toBe(0);

    console.log("✅ Frontend handles user interactions without errors");
  });

  test("Frontend accessibility basics are functional", async ({ page }) => {
    console.log("🧪 Testing: Frontend accessibility basics are functional");

    await page.goto("/", { waitUntil: "networkidle", timeout: 15000 });

    // Check basic accessibility features
    const accessibilityCheck = await page.evaluate(() => {
      // Check for headings
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

      // Check for images with alt text
      const images = document.querySelectorAll("img");
      const imagesWithAlt = Array.from(images).filter((img) =>
        img.hasAttribute("alt")
      );

      // Check for form labels
      const inputs = document.querySelectorAll("input, textarea, select");
      const inputsWithLabels = Array.from(inputs).filter((input) => {
        const id = input.id;
        return id && document.querySelector(`label[for="${id}"]`);
      });

      // Check for ARIA attributes
      const elementsWithAria = document.querySelectorAll(
        "[aria-label], [aria-labelledby], [role]"
      );

      // Check for focusable elements
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      return {
        headingCount: headings.length,
        imageCount: images.length,
        imagesWithAltCount: imagesWithAlt.length,
        inputCount: inputs.length,
        inputsWithLabelsCount: inputsWithLabels.length,
        ariaElementCount: elementsWithAria.length,
        focusableElementCount: focusableElements.length,
        hasLang: document.documentElement.hasAttribute("lang"),
        title: document.title,
      };
    });

    console.log("📊 Accessibility check results:", accessibilityCheck);

    // Basic accessibility assertions
    expect(accessibilityCheck.title.length).toBeGreaterThan(0);
    expect(accessibilityCheck.hasLang).toBe(true);
    expect(accessibilityCheck.focusableElementCount).toBeGreaterThan(0);

    // If there are images, they should have alt text
    if (accessibilityCheck.imageCount > 0) {
      expect(accessibilityCheck.imagesWithAltCount).toBeGreaterThan(0);
    }

    // Test keyboard navigation
    await page.keyboard.press("Tab");
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

    expect(focusedElement.tagName).toBeTruthy();

    console.log("✅ Frontend accessibility basics are functional");
  });
});

// Configuration for frontend-only tests
test.describe.configure({
  mode: "parallel",
  timeout: 30000,
});
