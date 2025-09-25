# StillOnTime E2E Tests

This directory contains end-to-end tests for the StillOnTime Film Schedule Automation System using Playwright.

## Overview

The E2E tests verify that the application:

- Loads successfully without JavaScript errors
- Displays expected content and UI elements
- Becomes interactive and handles user actions
- Works across different browsers and devices
- Handles error scenarios gracefully
- Maintains good performance and accessibility

## Test Structure

### Basic Functionality Tests (`basic-functionality.spec.ts`)

These tests verify core functionality that should work with minimal setup:

- Application loads without JavaScript errors
- HTML structure is valid and accessible
- CSS and styling loads correctly
- Application is responsive to viewport changes
- Basic interactivity works (buttons, links, inputs)
- Keyboard navigation functions
- Performance metrics are reasonable
- Cross-browser compatibility

### Full Application Tests (`app-functionality.spec.ts`)

These tests require the full application to be running and test:

- Login/authentication flow
- Dashboard content and navigation
- Form interactions and data handling
- API error handling
- Mobile responsiveness
- State persistence
- Complete user workflows

## Running Tests

### Prerequisites

1. Install dependencies: `npm install`
2. Ensure both backend and frontend can run: `npm run dev`

### Quick Start

```bash
# Run basic tests (minimal setup required)
npm run test:e2e:basic

# Run all E2E tests with services auto-start
npm run e2e

# Run tests in headed mode (see browser)
npm run e2e:headed

# Run only full application tests
npm run test:e2e:full

# View test report
npm run test:e2e:report
```

### Advanced Usage

```bash
# Run tests with custom browser
npm run test:e2e -- --project=firefox

# Run specific test file
npx playwright test basic-functionality.spec.ts

# Run tests in debug mode
npx playwright test --debug

# Run tests with trace
npx playwright test --trace=on
```

## Test Configuration

The tests are configured in `playwright.config.ts` with:

- Multiple browser support (Chromium, Firefox, WebKit)
- Mobile device testing (iPhone, Android)
- Automatic service startup
- Screenshot and video capture on failure
- Trace collection for debugging

## Test Data and Mocking

### Authentication Mocking

Tests use localStorage mocking to simulate authenticated users:

```javascript
await page.addInitScript(() => {
  localStorage.setItem(
    "auth-storage",
    JSON.stringify({
      state: {
        isAuthenticated: true,
        user: { email: "test@example.com", name: "Test User" },
      },
    })
  );
});
```

### API Mocking

Tests can mock API responses for error scenarios:

```javascript
await page.route("**/api/**", (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: "Server Error" }),
  });
});
```

## Debugging Tests

### Visual Debugging

```bash
# Run with browser visible
npm run e2e:headed

# Run in debug mode (step through tests)
npx playwright test --debug

# Generate and view trace
npx playwright test --trace=on
npm run test:e2e:report
```

### Console Output

Tests log progress and capture errors:

- ✅ Success indicators
- ❌ Error messages
- 📊 Performance metrics
- ⚠️ Warnings

### Screenshots and Videos

Failed tests automatically capture:

- Screenshots at failure point
- Video recordings of test execution
- Network request logs
- Console error messages

## CI/CD Integration

The tests are configured for CI environments:

- Headless mode by default
- Retry failed tests
- Generate JUnit XML reports
- Capture artifacts on failure

### GitHub Actions Example

```yaml
- name: Run E2E Tests
  run: |
    npm run build
    npm run e2e

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Performance Testing

Tests include basic performance checks:

- Page load time measurement
- Core Web Vitals monitoring
- Resource loading verification
- Memory usage tracking

## Accessibility Testing

Basic accessibility features are tested:

- Keyboard navigation
- ARIA labels and roles
- Heading structure
- Alt text on images
- Focus management

## Troubleshooting

### Common Issues

1. **Services not starting**

   - Check if ports 3000/3001 are available
   - Verify environment variables are set
   - Check database/Redis connections

2. **Tests timing out**

   - Increase timeout in `playwright.config.ts`
   - Check network connectivity
   - Verify service health endpoints

3. **Authentication issues**

   - Verify localStorage mocking is working
   - Check OAuth configuration
   - Ensure test user data is valid

4. **Cross-browser failures**
   - Check browser-specific JavaScript features
   - Verify CSS compatibility
   - Test responsive design breakpoints

### Debug Commands

```bash
# Check service health
curl http://localhost:3001/health
curl http://localhost:3000

# View browser console in tests
npx playwright test --headed --debug

# Generate detailed report
npx playwright test --reporter=html
```

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add appropriate test descriptions
3. Include error handling and cleanup
4. Test across multiple browsers
5. Add documentation for complex scenarios

### Test Categories

- **Smoke tests**: Basic functionality that must always work
- **Integration tests**: Feature workflows and user journeys
- **Regression tests**: Previously fixed bugs
- **Performance tests**: Load time and responsiveness
- **Accessibility tests**: WCAG compliance checks
