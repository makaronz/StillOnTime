export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',

  // App Configuration
  appName: 'StillOnTime',
  version: '1.0.0',

  // OAuth Configuration
  oauth: {
    google: {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar',
    },
  },

  // Feature Flags
  features: {
    enhancedPDF: true,
    enhancedEmail: true,
    enhancedRouting: true,
    enhancedCalendar: true,
    aiClassification: true,
  },

  // Timeouts
  timeouts: {
    api: 30000, // 30 seconds
    oauth: 60000, // 1 minute
    fileUpload: 120000, // 2 minutes
  },

  // File Upload Limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },

  // Cache Configuration
  cache: {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    userCacheTTL: 30 * 60 * 1000, // 30 minutes
    systemCacheTTL: 60 * 60 * 1000, // 1 hour
  },

  // Pagination
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  // UI Configuration
  ui: {
    theme: 'light',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },

  // Notification Settings
  notifications: {
    defaultEnabled: true,
    batchInterval: 5000, // 5 seconds
    maxBatchSize: 10,
  },
}