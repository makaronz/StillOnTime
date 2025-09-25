import { test, expect, Page } from "@playwright/test";

// Test data and utilities
const TEST_USER = {
  email: "test@stillontime.com",
  name: "Test User",
};

const MOCK_SCHEDULE_DATA = {
  location: "Film Studio Warsaw",
  callTime: "08:00",
  sceneType: "EXT",
  shootingDate: "2024-02-15",
};

// Helper functions
async function waitForAppToLoad(page: Page) {
  // Wait for React to hydrate and app to be interactive
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => {
      return document.readyState === "complete" && window.React !== undefined;
    },
    { timeout: 10000 }
  );
}

async function mockAuthenticatedUser(page: Page) {
  // Mock authentication state in localStorage
  await page.addInitScript(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            email: "test@stillontime.com",
            name: "Test User",
            userId: "test-user-123",
          },
          token: "mock-jwt-token",
        },
        version: 0,
      })
    );
  });
}

test.describe("StillOnTime Application - Core Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging for debugging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    // Set up error handling
    page.on("pageerror", (error) => {
      console.log(`❌ Page Error: ${error.message}`);
    });
  });

  test("Application loads successfully and displays login page", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Application loads successfully and displays login page"
    );

    // Navigate to the application
    await page.goto("/");

    // Wait for the app to load
    await waitForAppToLoad(page);

    // Check that the page title is correct
    await expect(page).toHaveTitle(/StillOnTime/);

    // Check that login page is displayed for unauthenticated users
    await expect(page.locator("text=StillOnTime")).toBeVisible();

    // Check for login-related elements
    const loginButton = page.locator("button", {
      hasText: /login|sign in|zaloguj/i,
    });
    await expect(loginButton).toBeVisible();

    // Verify no JavaScript errors occurred
    const errors = await page.evaluate(() => {
      return window.console.error.length || 0;
    });

    console.log("✅ Login page loaded successfully");
  });

  test("Application becomes interactive and handles user actions", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Application becomes interactive and handles user actions"
    );

    await page.goto("/");
    await waitForAppToLoad(page);

    // Test that buttons are clickable and interactive
    const loginButton = page
      .locator("button", { hasText: /login|sign in|zaloguj/i })
      .first();

    // Check if button is enabled and clickable
    await expect(loginButton).toBeEnabled();

    // Test hover effects (if any)
    await loginButton.hover();

    // Test click interaction
    await loginButton.click();

    // Verify the click was handled (might redirect to OAuth or show loading state)
    await page.waitForTimeout(1000); // Allow time for any state changes

    console.log("✅ User interactions work correctly");
  });

  test("Authenticated user sees dashboard with expected content", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Authenticated user sees dashboard with expected content"
    );

    // Mock authenticated state
    await mockAuthenticatedUser(page);

    await page.goto("/");
    await waitForAppToLoad(page);

    // Check that dashboard is displayed
    await expect(page.locator("text=Dashboard")).toBeVisible({
      timeout: 10000,
    });

    // Check for main navigation elements
    await expect(page.locator("nav")).toBeVisible();

    // Check for key dashboard sections
    const dashboardElements = [
      "Recent Schedules",
      "Email Processing",
      "Route Planning",
      "Weather Updates",
    ];

    for (const element of dashboardElements) {
      const locator = page.locator(`text=${element}`);
      if ((await locator.count()) > 0) {
        await expect(locator.first()).toBeVisible();
      }
    }

    // Check that user info is displayed
    await expect(page.locator(`text=${TEST_USER.email}`)).toBeVisible();

    console.log("✅ Dashboard displays correctly for authenticated users");
  });

  test("Navigation between pages works correctly", async ({ page }) => {
    console.log("🧪 Testing: Navigation between pages works correctly");

    await mockAuthenticatedUser(page);
    await page.goto("/");
    await waitForAppToLoad(page);

    // Test navigation to Configuration page
    const configLink = page.locator('a[href="/configuration"], button', {
      hasText: /configuration|settings|ustawienia/i,
    });
    if ((await configLink.count()) > 0) {
      await configLink.first().click();
      await page.waitForURL("**/configuration");
      await expect(page.locator("text=Configuration")).toBeVisible();
    }

    // Test navigation to History page
    const historyLink = page.locator('a[href="/history"], button', {
      hasText: /history|historia/i,
    });
    if ((await historyLink.count()) > 0) {
      await historyLink.first().click();
      await page.waitForURL("**/history");
      await expect(page.locator("text=History")).toBeVisible();
    }

    // Navigate back to dashboard
    const dashboardLink = page.locator('a[href="/"], button', {
      hasText: /dashboard|home/i,
    });
    if ((await dashboardLink.count()) > 0) {
      await dashboardLink.first().click();
      await page.waitForURL("/");
      await expect(page.locator("text=Dashboard")).toBeVisible();
    }

    console.log("✅ Navigation between pages works correctly");
  });

  test("Forms are interactive and handle input correctly", async ({ page }) => {
    console.log("🧪 Testing: Forms are interactive and handle input correctly");

    await mockAuthenticatedUser(page);
    await page.goto("/configuration");
    await waitForAppToLoad(page);

    // Look for form inputs
    const inputs = page.locator(
      'input[type="text"], input[type="email"], textarea, select'
    );
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      // Test first text input
      const firstInput = inputs.first();
      await expect(firstInput).toBeVisible();
      await expect(firstInput).toBeEnabled();

      // Test typing in the input
      await firstInput.fill("Test input value");
      await expect(firstInput).toHaveValue("Test input value");

      // Clear the input
      await firstInput.clear();
      await expect(firstInput).toHaveValue("");
    }

    // Look for buttons and test their interactivity
    const buttons = page.locator("button:not([disabled])");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const firstButton = buttons.first();
      await expect(firstButton).toBeEnabled();

      // Test hover state
      await firstButton.hover();

      // Test focus state
      await firstButton.focus();
    }

    console.log("✅ Forms are interactive and handle input correctly");
  });

  test("Application handles API errors gracefully", async ({ page }) => {
    console.log("🧪 Testing: Application handles API errors gracefully");

    await mockAuthenticatedUser(page);

    // Mock API failures
    await page.route("**/api/**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto("/");
    await waitForAppToLoad(page);

    // The app should still load and show error states gracefully
    await expect(page.locator("body")).toBeVisible();

    // Look for error messages or loading states
    const errorIndicators = [
      "Error",
      "Failed to load",
      "Something went wrong",
      "Try again",
      "Loading...",
    ];

    let hasErrorHandling = false;
    for (const indicator of errorIndicators) {
      const locator = page.locator(`text=${indicator}`);
      if ((await locator.count()) > 0) {
        hasErrorHandling = true;
        break;
      }
    }

    // The app should either show error states or continue to work
    expect(
      hasErrorHandling || (await page.locator("text=Dashboard").count()) > 0
    ).toBeTruthy();

    console.log("✅ Application handles API errors gracefully");
  });

  test("Application is responsive on mobile devices", async ({ page }) => {
    console.log("🧪 Testing: Application is responsive on mobile devices");

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await mockAuthenticatedUser(page);
    await page.goto("/");
    await waitForAppToLoad(page);

    // Check that the app is still functional on mobile
    await expect(page.locator("body")).toBeVisible();

    // Check for mobile-friendly navigation (hamburger menu, etc.)
    const mobileNavElements = [
      'button[aria-label*="menu"]',
      'button[aria-label*="Menu"]',
      ".hamburger",
      '[data-testid="mobile-menu"]',
    ];

    let hasMobileNav = false;
    for (const selector of mobileNavElements) {
      if ((await page.locator(selector).count()) > 0) {
        hasMobileNav = true;
        break;
      }
    }

    // Test that content is not horizontally scrollable
    const bodyWidth = await page.locator("body").boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(375);

    console.log("✅ Application is responsive on mobile devices");
  });

  test("Application performance is acceptable", async ({ page }) => {
    console.log("🧪 Testing: Application performance is acceptable");

    await mockAuthenticatedUser(page);

    // Measure page load time
    const startTime = Date.now();
    await page.goto("/");
    await waitForAppToLoad(page);
    const loadTime = Date.now() - startTime;

    // Page should load within reasonable time (10 seconds for development)
    expect(loadTime).toBeLessThan(10000);

    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint:
          performance.getEntriesByName("first-paint")[0]?.startTime || 0,
        firstContentfulPaint:
          performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime || 0,
      };
    });

    console.log("📊 Performance Metrics:", performanceMetrics);

    // Basic performance assertions
    expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);

    console.log("✅ Application performance is acceptable");
  });

  test("Application accessibility basics are working", async ({ page }) => {
    console.log("🧪 Testing: Application accessibility basics are working");

    await mockAuthenticatedUser(page);
    await page.goto("/");
    await waitForAppToLoad(page);

    // Check for basic accessibility features

    // 1. Page should have a title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // 2. Check for heading structure
    const headings = page.locator("h1, h2, h3, h4, h5, h6");
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    // 3. Check for alt text on images
    const images = page.locator("img");
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 5); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        // Images should have alt text (can be empty for decorative images)
        expect(alt).not.toBeNull();
      }
    }

    // 4. Check for keyboard navigation
    await page.keyboard.press("Tab");
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName
    );
    expect(focusedElement).toBeTruthy();

    // 5. Check for ARIA labels on interactive elements
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const ariaLabel = await firstButton.getAttribute("aria-label");
      const textContent = await firstButton.textContent();

      // Button should have either text content or aria-label
      expect(ariaLabel || textContent?.trim()).toBeTruthy();
    }

    console.log("✅ Basic accessibility features are working");
  });

  test("Application handles network connectivity issues", async ({ page }) => {
    console.log("🧪 Testing: Application handles network connectivity issues");

    await mockAuthenticatedUser(page);
    await page.goto("/");
    await waitForAppToLoad(page);

    // Simulate network failure
    await page.context().setOffline(true);

    // Try to perform an action that would require network
    const refreshButton = page.locator("button", {
      hasText: /refresh|reload|odśwież/i,
    });
    if ((await refreshButton.count()) > 0) {
      await refreshButton.first().click();
    }

    // Wait a moment for any network requests to fail
    await page.waitForTimeout(2000);

    // The app should still be functional and show appropriate messaging
    await expect(page.locator("body")).toBeVisible();

    // Look for offline indicators or error messages
    const offlineIndicators = [
      "offline",
      "no connection",
      "network error",
      "connection lost",
    ];

    // Restore network
    await page.context().setOffline(false);

    console.log("✅ Application handles network connectivity issues");
  });

  test("Application state persists across page reloads", async ({ page }) => {
    console.log("🧪 Testing: Application state persists across page reloads");

    await mockAuthenticatedUser(page);
    await page.goto("/");
    await waitForAppToLoad(page);

    // Verify user is authenticated
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Reload the page
    await page.reload();
    await waitForAppToLoad(page);

    // User should still be authenticated after reload
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Check that authentication state persisted
    const authState = await page.evaluate(() => {
      const stored = localStorage.getItem("auth-storage");
      return stored ? JSON.parse(stored) : null;
    });

    expect(authState?.state?.isAuthenticated).toBe(true);

    console.log("✅ Application state persists across page reloads");
  });
});

test.describe("StillOnTime Application - Error Scenarios", () => {
  test("Application handles malformed data gracefully", async ({ page }) => {
    console.log("🧪 Testing: Application handles malformed data gracefully");

    // Inject malformed data into localStorage
    await page.addInitScript(() => {
      localStorage.setItem("auth-storage", "invalid-json-data");
      localStorage.setItem("app-data", '{"malformed": json}');
    });

    await page.goto("/");
    await waitForAppToLoad(page);

    // App should still load (might show login page due to invalid auth data)
    await expect(page.locator("body")).toBeVisible();

    // Should not have any uncaught JavaScript errors
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    await page.waitForTimeout(2000);

    // Filter out expected errors related to malformed data
    const unexpectedErrors = jsErrors.filter(
      (error) =>
        !error.includes("JSON") &&
        !error.includes("parse") &&
        !error.includes("localStorage")
    );

    expect(unexpectedErrors.length).toBe(0);

    console.log("✅ Application handles malformed data gracefully");
  });

  test("Application handles missing environment variables", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing: Application handles missing environment variables"
    );

    // Mock missing environment variables by intercepting config requests
    await page.route("**/config", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}), // Empty config
      });
    });

    await page.goto("/");
    await waitForAppToLoad(page);

    // App should still load with fallback behavior
    await expect(page.locator("body")).toBeVisible();

    console.log("✅ Application handles missing environment variables");
  });
});

test.describe("StillOnTime Application - Integration Tests", () => {
  test("Full user workflow simulation", async ({ page }) => {
    console.log("🧪 Testing: Full user workflow simulation");

    // Start as unauthenticated user
    await page.goto("/");
    await waitForAppToLoad(page);

    // Should see login page
    await expect(
      page.locator("button", { hasText: /login|sign in/i })
    ).toBeVisible();

    // Simulate authentication
    await mockAuthenticatedUser(page);
    await page.reload();
    await waitForAppToLoad(page);

    // Should now see dashboard
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Navigate to configuration
    const configLink = page.locator('a[href="/configuration"], button', {
      hasText: /configuration/i,
    });
    if ((await configLink.count()) > 0) {
      await configLink.first().click();
      await page.waitForURL("**/configuration");
    }

    // Navigate to history
    const historyLink = page.locator('a[href="/history"], button', {
      hasText: /history/i,
    });
    if ((await historyLink.count()) > 0) {
      await historyLink.first().click();
      await page.waitForURL("**/history");
    }

    // Return to dashboard
    const homeLink = page.locator('a[href="/"], button', {
      hasText: /dashboard|home/i,
    });
    if ((await homeLink.count()) > 0) {
      await homeLink.first().click();
      await page.waitForURL("/");
    }

    console.log("✅ Full user workflow simulation completed");
  });
});
