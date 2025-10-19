module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173'],
      startServerCommand: 'cd frontend && npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'categories:pwa': 'off',

        // Performance budgets
        'performance-budget:script-size': ['error', { maxSize: 500000 }],
        'performance-budget:total-byte-weight': ['error', { maxSize: 1000000 }],

        // Web Vitals thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }],

        // Resource loading
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'uses-text-compression': 'warn',
        'uses-rel-preconnect': 'warn',

        // Caching
        'uses-long-cache-ttl': 'warn',
        'efficient-animated-gifs': 'warn',

        // JavaScript optimization
        'unused-javascript': 'warn',
        'unused-css-rules': 'warn',
        'dom-size': ['warn', { maxNumericValue: 1500 }],

        // Network optimization
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        'interactive': ['warn', { maxNumericValue: 3800 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};