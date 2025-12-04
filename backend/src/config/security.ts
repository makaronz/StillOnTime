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
    minSecretLength: 48,
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
 * Enhanced security configuration validation with comprehensive checks
 */
export function validateSecurityConfig(): void {
  // Validate JWT secret strength
  if (process.env.JWT_SECRET) {
    const jwtSecret = process.env.JWT_SECRET;

    // Check minimum length
    if (jwtSecret.length < securityConfig.jwt.minSecretLength) {
      throw new Error(
        `JWT_SECRET must be at least ${securityConfig.jwt.minSecretLength} characters long (current: ${jwtSecret.length})`
      );
    }

    // Check for weak patterns
    const weakPatterns = [
      "jwt", "secret", "password", "token", "key", "auth",
      "123", "abc", "test", "demo", "default", "example"
    ];

    const lowerSecret = jwtSecret.toLowerCase();
    for (const pattern of weakPatterns) {
      if (lowerSecret.includes(pattern)) {
        throw new Error(`JWT_SECRET contains weak pattern: "${pattern}". Use a strong, random secret.`);
      }
    }

    // Check entropy - require mix of character types
    const hasUpperCase = /[A-Z]/.test(jwtSecret);
    const hasLowerCase = /[a-z]/.test(jwtSecret);
    const hasNumbers = /\d/.test(jwtSecret);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(jwtSecret);

    const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;

    if (complexityScore < 3) {
      throw new Error(
        "JWT_SECRET lacks sufficient complexity. Must contain at least 3 of: uppercase, lowercase, numbers, special characters"
      );
    }
  }

  // Validate encryption salt if provided
  if (process.env.ENCRYPTION_SALT) {
    const encryptionSalt = process.env.ENCRYPTION_SALT;

    if (encryptionSalt.length < 32) {
      throw new Error(
        `ENCRYPTION_SALT must be at least 32 characters long (current: ${encryptionSalt.length})`
      );
    }

    // Check for weak patterns in encryption salt
    const weakSaltPatterns = ["salt", "password", "secret", "key", "encrypt"];
    const lowerSalt = encryptionSalt.toLowerCase();

    for (const pattern of weakSaltPatterns) {
      if (lowerSalt.includes(pattern)) {
        throw new Error(`ENCRYPTION_SALT contains weak pattern: "${pattern}". Use a strong, random salt.`);
      }
    }
  }

  // Validate API keys
  for (const apiKey of securityConfig.apiKeys.required) {
    const value = process.env[apiKey];
    if (value && value.length < securityConfig.apiKeys.minLength) {
      throw new Error(`${apiKey} appears to be invalid (too short)`);
    }
  }

  // Validate environment-specific security settings
  if (process.env.NODE_ENV === "production") {
    // Ensure required security variables are set
    const requiredProductionVars = ["JWT_SECRET", "ENCRYPTION_SALT"];
    const missingVars = requiredProductionVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required security environment variables for production: ${missingVars.join(", ")}`
      );
    }

    // Check for development values in production
    if (process.env.JWT_SECRET && (process.env.JWT_SECRET.length < 48 || process.env.JWT_SECRET.includes("dev"))) {
      throw new Error("JWT_SECRET appears to be a development value. Use a strong production secret.");
    }
  }

  console.log("✅ Security configuration validated successfully");

  // Log security summary (without exposing secrets)
  console.log(`🔒 Security configuration: JWT(${process.env.JWT_SECRET?.length || 0} chars), Encryption Salt(${process.env.ENCRYPTION_SALT?.length || 0} chars)`);
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
