/**
 * Advanced E2E Workflow Testing
 * Comprehensive testing of complete user journeys with real-world scenarios
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'

// Test configuration and utilities
interface TestUser {
  email: string
  name: string
  googleId: string
  accessToken?: string
}

interface EmailScenario {
  subject: string
  sender: string
  hasAttachments: boolean
  scheduleType: 'daily' | 'weekly' | 'location_change' | 'cancellation'
  expectedOutcome: 'success' | 'warning' | 'error'
}

// Test data configurations
const TEST_USERS: TestUser[] = [
  {
    email: 'test.director@stillontime.test',
    name: 'Test Director',
    googleId: 'google_test_director_123'
  },
  {
    email: 'test.producer@stillontime.test', 
    name: 'Test Producer',
    googleId: 'google_test_producer_456'
  }
]

const EMAIL_SCENARIOS: EmailScenario[] = [
  {
    subject: 'Updated Shooting Schedule - Day 15',
    sender: 'production@filmstudio.com',
    hasAttachments: true,
    scheduleType: 'daily',
    expectedOutcome: 'success'
  },
  {
    subject: 'URGENT: Location Change for Tomorrow',
    sender: 'locations@filmstudio.com', 
    hasAttachments: false,
    scheduleType: 'location_change',
    expectedOutcome: 'warning'
  },
  {
    subject: 'Shooting Cancelled - Weather Alert',
    sender: 'production@filmstudio.com',
    hasAttachments: false,
    scheduleType: 'cancellation',
    expectedOutcome: 'error'
  }
]

test.describe('Advanced E2E Workflow Testing', () => {
  let context: BrowserContext
  let page: Page
  let testUser: TestUser

  test.beforeAll(async ({ browser }) => {
    // Create persistent context for authentication
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['notifications'],
      geolocation: { latitude: 52.5200, longitude: 13.4050 }, // Berlin coordinates
    })
    
    page = await context.newPage()
    testUser = TEST_USERS[0]
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.describe('Complete User Authentication Flow', () => {
    test('should handle OAuth2 authentication with Google', async () => {
      // Navigate to application
      await page.goto('/')
      
      // Verify redirect to login
      await expect(page).toHaveURL(/.*\/login/)
      
      // Check login page accessibility
      await expect(page.locator('[data-testid=\"login-page\"]')).toBeVisible()
      await expect(page.locator('h1')).toContainText('Sign in to StillOnTime')
      
      // Test keyboard navigation
      await page.keyboard.press('Tab')
      const focusedElement = await page.locator(':focus')
      await expect(focusedElement).toHaveAttribute('data-testid', 'google-signin-button')
      
      // Mock Google OAuth2 flow
      await page.route('**/auth/google', async route => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': '/auth/callback?code=mock_auth_code&state=mock_state'
          }
        })
      })
      
      await page.route('**/auth/callback*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: testUser,
            token: 'mock_jwt_token'
          })
        })
      })
      
      // Click Google Sign In
      await page.click('[data-testid=\"google-signin-button\"]')
      
      // Verify successful authentication and redirect to dashboard
      await expect(page).toHaveURL('/')
      await expect(page.locator('[data-testid=\"dashboard\"]')).toBeVisible()
      
      // Verify user information in UI
      await expect(page.locator('[data-testid=\"user-name\"]')).toContainText(testUser.name)
      await expect(page.locator('[data-testid=\"user-email\"]')).toContainText(testUser.email)
    })

    test('should maintain authentication across page reloads', async () => {
      // Reload page
      await page.reload()
      
      // Verify still authenticated
      await expect(page).toHaveURL('/')
      await expect(page.locator('[data-testid=\"dashboard\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"user-name\"]')).toContainText(testUser.name)
    })
  })

  test.describe('Email Processing Workflow', () => {
    test.beforeEach(async () => {
      // Ensure we're on the dashboard
      await page.goto('/')
      await expect(page.locator('[data-testid=\"dashboard\"]')).toBeVisible()
    })

    test('should process shooting schedule email with attachments', async () => {
      const scenario = EMAIL_SCENARIOS[0] // Daily schedule with attachments
      
      // Mock Gmail API responses
      await page.route('**/api/emails/monitor', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            newEmails: [
              {
                id: 'email_123',
                subject: scenario.subject,
                sender: scenario.sender,
                attachments: scenario.hasAttachments ? [
                  {
                    filename: 'shooting_schedule.pdf',
                    mimeType: 'application/pdf',
                    size: 1024000
                  }
                ] : [],
                timestamp: new Date().toISOString()
              }
            ]
          })
        })
      })
      
      // Mock email processing endpoint
      await page.route('**/api/emails/process', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            jobId: 'job_123',
            estimatedCompletion: new Date(Date.now() + 30000).toISOString(),
            scheduleData: {
              location: 'Studio A, Babelsberg',
              callTime: '06:00',
              wrapTime: '18:00',
              date: new Date().toISOString(),
              participants: ['Director', 'Lead Actor', 'Camera Crew']
            },
            routeData: {
              duration: '35 minutes',
              distance: '18.2 km',
              departureTime: '05:25'
            },
            calendarEvent: {
              id: 'cal_event_123',
              created: true,
              url: 'https://calendar.google.com/event/123'
            }
          })
        })
      })
      
      // Trigger email monitoring
      await page.click('[data-testid=\"check-emails-button\"]')
      
      // Verify processing started
      await expect(page.locator('[data-testid=\"processing-status\"]')).toContainText('Processing new emails...')
      
      // Wait for processing completion
      await expect(page.locator('[data-testid=\"processing-complete\"]')).toBeVisible({ timeout: 10000 })
      
      // Verify results display
      await expect(page.locator('[data-testid=\"schedule-created\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"route-calculated\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"calendar-updated\"]')).toBeVisible()
      
      // Verify schedule details
      await expect(page.locator('[data-testid=\"schedule-location\"]')).toContainText('Studio A, Babelsberg')
      await expect(page.locator('[data-testid=\"call-time\"]')).toContainText('06:00')
      await expect(page.locator('[data-testid=\"departure-time\"]')).toContainText('05:25')
    })

    test('should handle location change notifications', async () => {
      const scenario = EMAIL_SCENARIOS[1] // Location change
      
      // Mock urgent notification scenario
      await page.route('**/api/emails/process', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            priority: 'urgent',
            scheduleData: {
              changeType: 'location',
              newLocation: 'Studio B, Babelsberg', 
              originalLocation: 'Studio A, Babelsberg',
              effectiveDate: new Date().toISOString()
            },
            notifications: {
              email: true,
              sms: true,
              push: true
            },
            warningLevel: 'high'
          })
        })
      })
      
      // Simulate receiving urgent email
      await page.click('[data-testid=\"check-emails-button\"]')
      
      // Verify urgent notification display
      await expect(page.locator('[data-testid=\"urgent-notification\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"location-change-alert\"]')).toContainText('Location Changed')
      await expect(page.locator('[data-testid=\"new-location\"]')).toContainText('Studio B, Babelsberg')
      
      // Verify notification channels activated
      await expect(page.locator('[data-testid=\"email-notification-sent\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"sms-notification-sent\"]')).toBeVisible()
      
      // Test notification acknowledgment
      await page.click('[data-testid=\"acknowledge-notification\"]')
      await expect(page.locator('[data-testid=\"notification-acknowledged\"]')).toBeVisible()
    })

    test('should handle shooting cancellation with weather alerts', async () => {
      const scenario = EMAIL_SCENARIOS[2] // Cancellation
      
      // Mock weather service response
      await page.route('**/api/weather/current', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            location: 'Berlin',
            conditions: ['heavy_rain', 'strong_wind'],
            temperature: 8,
            precipitation: 85,
            windSpeed: 45,
            warning: {
              level: 'severe',
              message: 'Severe weather warning in effect'
            }
          })
        })
      })
      
      // Mock cancellation processing
      await page.route('**/api/emails/process', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            scheduleData: {
              status: 'cancelled',
              reason: 'severe_weather',
              originalDate: new Date().toISOString(),
              rescheduledDate: null
            },
            calendarEvent: {
              updated: true,
              status: 'cancelled'
            },
            weatherData: {
              severity: 'high',
              conditions: ['heavy_rain', 'strong_wind']
            }
          })
        })
      })
      
      // Process cancellation email
      await page.click('[data-testid=\"check-emails-button\"]')
      
      // Verify cancellation display
      await expect(page.locator('[data-testid=\"schedule-cancelled\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"cancellation-reason\"]')).toContainText('severe weather')
      await expect(page.locator('[data-testid=\"weather-warning\"]')).toBeVisible()
      
      // Verify calendar update
      await expect(page.locator('[data-testid=\"calendar-cancelled\"]')).toBeVisible()
    })
  })

  test.describe('Configuration and Settings Management', () => {
    test('should manage notification preferences', async () => {
      // Navigate to configuration
      await page.click('[data-testid=\"nav-configuration\"]')
      await expect(page).toHaveURL('/configuration')
      
      // Test notification settings
      await page.click('[data-testid=\"notification-config-card\"]')
      
      // Verify current settings loaded
      await expect(page.locator('[data-testid=\"email-notifications\"]')).toBeChecked()
      
      // Test SMS configuration
      await page.click('[data-testid=\"enable-sms\"]')
      await page.fill('[data-testid=\"sms-number\"]', '+49 30 12345678')
      
      // Test push notification setup
      await page.click('[data-testid=\"enable-push\"]')
      
      // Mock configuration save
      await page.route('**/api/user/config', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            config: {
              notifications: {
                email: true,
                sms: true,
                push: true,
                smsNumber: '+49 30 12345678'
              }
            }
          })
        })
      })
      
      // Save configuration
      await page.click('[data-testid=\"save-config\"]')
      
      // Verify success message
      await expect(page.locator('[data-testid=\"config-saved\"]')).toBeVisible()
    })

    test('should configure time buffers and preferences', async () => {
      // Navigate to time buffer configuration
      await page.click('[data-testid=\"time-buffer-config-card\"]')
      
      // Test buffer adjustments
      await page.fill('[data-testid=\"car-change-buffer\"]', '10')
      await page.fill('[data-testid=\"parking-buffer\"]', '15')
      await page.fill('[data-testid=\"entry-buffer\"]', '5')
      await page.fill('[data-testid=\"traffic-buffer\"]', '20')
      await page.fill('[data-testid=\"morning-routine-buffer\"]', '45')
      
      // Mock save endpoint
      await page.route('**/api/user/time-buffers', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            buffers: {
              carChange: 10,
              parking: 15,
              entry: 5,
              traffic: 20,
              morningRoutine: 45
            }
          })
        })
      })
      
      await page.click('[data-testid=\"save-time-buffers\"]')
      await expect(page.locator('[data-testid=\"buffers-saved\"]')).toBeVisible()
    })
  })

  test.describe('System Monitoring and Health', () => {
    test('should display system performance metrics', async () => {
      // Navigate to monitoring page
      await page.click('[data-testid=\"nav-monitoring\"]')
      await expect(page).toHaveURL('/monitoring')
      
      // Mock monitoring data
      await page.route('**/api/monitoring/dashboard', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            systemStatus: 'healthy',
            services: {
              gmail: { status: 'healthy', responseTime: 245 },
              calendar: { status: 'healthy', responseTime: 186 },
              weather: { status: 'degraded', responseTime: 1250 },
              database: { status: 'healthy', responseTime: 45 }
            },
            metrics: {
              totalEmails: 1247,
              processedToday: 23,
              successRate: 0.96,
              averageProcessingTime: 4500
            },
            alerts: [
              {
                id: 'alert_1',
                severity: 'warning',
                message: 'Weather service response time elevated',
                timestamp: new Date().toISOString()
              }
            ]
          })
        })
      })
      
      // Verify dashboard loads
      await expect(page.locator('[data-testid=\"monitoring-dashboard\"]')).toBeVisible()
      
      // Verify system status
      await expect(page.locator('[data-testid=\"system-status\"]')).toContainText('healthy')
      
      // Verify service statuses
      await expect(page.locator('[data-testid=\"gmail-status\"]')).toContainText('healthy')
      await expect(page.locator('[data-testid=\"weather-status\"]')).toContainText('degraded')
      
      // Verify metrics display
      await expect(page.locator('[data-testid=\"total-emails\"]')).toContainText('1247')
      await expect(page.locator('[data-testid=\"success-rate\"]')).toContainText('96%')
      
      // Verify alerts
      await expect(page.locator('[data-testid=\"active-alerts\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"alert-weather\"]')).toContainText('Weather service response time elevated')
    })
  })

  test.describe('History and Analytics', () => {
    test('should display processed email history with filtering', async () => {
      // Navigate to history page
      await page.click('[data-testid=\"nav-history\"]')
      await expect(page).toHaveURL('/history')
      
      // Mock history data
      await page.route('**/api/history/emails*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [
              {
                id: 'email_1',
                subject: 'Shooting Schedule - Day 14',
                processedAt: new Date(Date.now() - 86400000).toISOString(),
                status: 'success',
                scheduleCreated: true,
                processingTime: 4500
              },
              {
                id: 'email_2', 
                subject: 'Location Update',
                processedAt: new Date(Date.now() - 172800000).toISOString(),
                status: 'warning',
                scheduleCreated: false,
                processingTime: 2100
              }
            ],
            pagination: {
              total: 2,
              page: 1,
              limit: 10
            }
          })
        })
      })
      
      // Verify history table loads
      await expect(page.locator('[data-testid=\"email-history-table\"]')).toBeVisible()
      
      // Verify email entries
      await expect(page.locator('[data-testid=\"email-1\"]')).toBeVisible()
      await expect(page.locator('[data-testid=\"email-1-subject\"]')).toContainText('Shooting Schedule - Day 14')
      await expect(page.locator('[data-testid=\"email-1-status\"]')).toContainText('success')
      
      // Test filtering
      await page.selectOption('[data-testid=\"status-filter\"]', 'success')
      await expect(page.locator('[data-testid=\"email-1\"]')).toBeVisible()
      
      // Test date range filtering
      await page.fill('[data-testid=\"date-from\"]', new Date(Date.now() - 604800000).toISOString().split('T')[0])
      await page.fill('[data-testid=\"date-to\"]', new Date().toISOString().split('T')[0])
      await page.click('[data-testid=\"apply-filters\"]')
      
      // Verify filtered results
      await expect(page.locator('[data-testid=\"email-history-table\"]')).toBeVisible()
    })
  })

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      await page.goto('/')
      
      // Test skip to content
      await page.keyboard.press('Tab')
      const skipLink = page.locator('[href=\"#main-content\"]')
      await expect(skipLink).toBeFocused()
      
      await page.keyboard.press('Enter')
      const mainContent = page.locator('#main-content')
      await expect(mainContent).toBeFocused()
      
      // Test navigation menu keyboard access
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab') // Navigate to first menu item
      await expect(page.locator('[data-testid=\"nav-dashboard\"]')).toBeFocused()
      
      // Test menu navigation with arrow keys
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid=\"nav-configuration\"]')).toBeFocused()
      
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid=\"nav-history\"]')).toBeFocused()
    })

    test('should have proper ARIA labels and roles', async () => {
      await page.goto('/')
      
      // Verify main navigation has proper ARIA
      const nav = page.locator('nav[role=\"navigation\"]')
      await expect(nav).toHaveAttribute('aria-label', 'Main navigation')
      
      // Verify main content area
      const main = page.locator('main[role=\"main\"]')
      await expect(main).toHaveAttribute('aria-label', 'Main content area')
      
      // Verify dashboard cards have proper labels
      await expect(page.locator('[data-testid=\"system-status-card\"]')).toHaveAttribute('role', 'region')
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent operations', async () => {
      const startTime = Date.now()
      
      // Simulate multiple concurrent requests
      const operations = [
        page.goto('/'),
        page.click('[data-testid=\"check-emails-button\"]'),
        page.click('[data-testid=\"nav-configuration\"]'),
        page.click('[data-testid=\"nav-monitoring\"]')
      ]
      
      await Promise.all(operations)
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Verify operations completed within reasonable time
      expect(totalTime).toBeLessThan(5000) // 5 seconds
      
      // Verify UI remains responsive
      await expect(page.locator('[data-testid=\"dashboard\"]')).toBeVisible()
    })
  })
})