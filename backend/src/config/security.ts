/**
 * Security Configuration for StillOnTime Automation System
 * Centralizes all security-related settings and validation
 */

export interface SecurityConfig {
  jwt: {
    minSecretLength: number;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  rateLimiting: {
    global: {
      windowMs: number;
      max: number;
    };
    auth: {
      windowMs: number;
      max: number;
      login: {
        windowMs: number;
        max: number;
      };
      callback: {
        windowMs: number;
        max: number;
      };
      refresh: {
        windowMs: number;
        max: number;
      };
      logout: {
        windowMs: number;
        max: number;
      };
      reauth: {
        windowMs: number;
        max: number;
      };
    };
  };
  apiKeys: {
    minLength: number;
    required: string[];
  };
  oauth: {
    requiredScopes: string[];
    tokenRefreshThreshold: number; // seconds before expiry to refresh
  };
}

export const securityConfig: SecurityConfig = {
  jwt: {
    minSecretLength: 32,
    expiresIn: "1h",
    refreshExpiresIn: "7d",
  },
  rateLimiting: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // auth requests per window
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // login attempts per window
      },
      callback: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // callback attempts per window
      },
      refresh: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 30, // refresh attempts per window
      },
      logout: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10, // logout attempts per window
      },
      reauth: {
        windowMs: 30 * 60 * 1000, // 30 minutes
        max: 3, // reauth attempts per window (very restrictive)
      },
    },
  },
  apiKeys: {
    minLength: 10,
    required: ["OPENWEATHER_API_KEY", "GOOGLE_MAPS_API_KEY"],
  },
  oauth: {
    requiredScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive.file",
    ],
    tokenRefreshThreshold: 300, // 5 minutes
  },
};

/**
 * Validates security configuration on startup
 */
export function validateSecurityConfig(): void {
  // Validate JWT secret length
  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < securityConfig.jwt.minSecretLength) {
      throw new Error(
        `JWT_SECRET must be at least ${securityConfig.jwt.minSecretLength} characters long in production`
      );
    }
  }

  // Validate API keys
  for (const apiKey of securityConfig.apiKeys.required) {
    const value = process.env[apiKey];
    if (value && value.length < securityConfig.apiKeys.minLength) {
      throw new Error(`${apiKey} appears to be invalid (too short)`);
    }
  }

  console.log("✅ Security configuration validated successfully");
}

/**
 * Security headers configuration for helmet
 */
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.openweathermap.org",
        "https://maps.googleapis.com",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Google APIs compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
};

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Request-ID",
    "X-API-Key",
  ],
  exposedHeaders: [
    "X-Request-ID",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
  ],
  maxAge: 86400, // 24 hours
};
