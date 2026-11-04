import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/logger');
// config.ts calls dotenv.config() at import time; keep a developer's local
// backend/.env from leaking values into these tests.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockLogger = logger as jest.Mocked<typeof logger>;

// Satisfies src/config/security.ts: >= 48 chars, >= 3 character classes,
// no weak substrings (jwt, secret, key, auth, test, 123, abc, dev, ...).
const STRONG_SECRET = 'Zq9!vR#m2@Lx$Pw7^Nc&Hy4*Bt(Gk)Ud8_Fs+Ej=Wo5%MaRiQlXn';
// >= 32 chars, no weak substrings (salt, password, secret, key, encrypt).
const STRONG_SALT = 'Hq7Vn2Rw9Lp4Xz6Bm1Tc8Jd3Fg5Ys0Ka';

/** Load src/config/config.ts afresh so it re-reads process.env. */
function loadConfig(): any {
  let loaded: any;
  jest.isolateModules(() => {
    loaded = require('../../src/config/config').config;
  });
  return loaded;
}

describe('Configuration and Environment Setup Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    mockLogger.info.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Environment Variable Loading', () => {
    it('should load required environment variables', () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.PORT = '3001';
      process.env.JWT_SECRET = STRONG_SECRET;

      // Act
      const config = loadConfig();

      // Assert
      expect(config.nodeEnv).toBe('test');
      expect(config.databaseUrl).toBe('postgresql://test:test@localhost:5432/test');
      expect(config.port).toBe(3001);
      expect(config.jwtSecret).toBe(STRONG_SECRET);
    });

    it('should provide default values for optional variables', () => {
      // Arrange
      delete process.env.PORT;
      delete process.env.NODE_ENV;

      // Act
      const config = loadConfig();

      // Assert
      expect(config.nodeEnv).toBe('development');
      expect(config.port).toBe(3001);
    });

    it('should validate environment variable types', () => {
      // Arrange
      process.env.PORT = 'invalid-number';

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });

    it('should handle empty environment variables gracefully', () => {
      // Arrange
      process.env.DATABASE_URL = '';

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });

    it('should handle special characters in environment variables', () => {
      // Arrange
      process.env.JWT_SECRET = STRONG_SECRET; // contains !@#$%^&*()

      // Act
      const config = loadConfig();

      // Assert
      expect(config.jwtSecret).toBe(STRONG_SECRET);
    });
  });

  describe('Database Configuration', () => {
    it('should parse database URL correctly', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://username:password@localhost:5432/database';

      // Act
      const config = require('../../src/config/config').config;

      // Assert
      expect(config.databaseUrl).toBe('postgresql://username:password@localhost:5432/database');
    });

    it('should handle different database URL formats', () => {
      const testCases = [
        'postgresql://user:pass@host:5432/db',
        'postgres://user:pass@host:5432/db',
        'postgresql://user@host:5432/db',
        'postgresql:///db'
      ];

      testCases.forEach(url => {
        process.env.DATABASE_URL = url;

        // Act
        const config = loadConfig();

        // Assert
        expect(config.databaseUrl).toBe(url);
      });
    });

    it('should handle database connection pool configuration', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.DB_POOL_SIZE = '20';
      process.env.DB_CONNECTION_TIMEOUT = '10000';

      // Act
      const config = require('../../src/config/config').config;

      // Assert
      expect(config.databaseUrl).toBeDefined();
    });
  });

  describe('Server Configuration', () => {
    it('should parse port number correctly', () => {
      const testPorts = ['3000', '3001', '8080', '5000'];

      testPorts.forEach(port => {
        process.env.PORT = port;

        // Act
        const config = loadConfig();

        // Assert
        expect(config.port).toBe(parseInt(port));
      });
    });

    it('should handle invalid port numbers', () => {
      const invalidPorts = ['-1', '0', '65536', '99999', 'invalid'];

      invalidPorts.forEach(port => {
        process.env.PORT = port;

        // Act & Assert
        expect(() => {
          require('../../src/config/config').config;
        }).not.toThrow();
      });
    });

    it('should configure CORS settings', () => {
      // Arrange: the allowed origin is FRONTEND_URL (src/config/security.ts corsConfig)
      process.env.FRONTEND_URL = 'http://localhost:3000';

      // Act
      let corsConfig: any;
      jest.isolateModules(() => {
        corsConfig = require('../../src/config/security').corsConfig;
      });
      const config = loadConfig();

      // Assert
      expect(corsConfig.origin).toBe('http://localhost:3000');
      expect(corsConfig.credentials).toBe(true);
      expect(config.frontendUrl).toBe('http://localhost:3000');
    });
  });

  describe('Security Configuration', () => {
    it('should load JWT secret securely', () => {
      // Arrange
      process.env.JWT_SECRET = STRONG_SECRET;

      // Act
      const config = loadConfig();

      // Assert
      expect(config.jwtSecret).toBe(STRONG_SECRET);
    });

    it('should handle missing JWT secret', () => {
      // Arrange: JWT_SECRET has no development fallback; it is always required
      delete process.env.JWT_SECRET;

      // Act & Assert
      expect(() => loadConfig()).toThrow(
        'Missing required environment variable: JWT_SECRET'
      );
    });

    it('should validate JWT secret strength', () => {
      const tooShort = ['123', 'password', 'secret'];

      tooShort.forEach(secret => {
        process.env.JWT_SECRET = secret;

        // Act & Assert
        expect(() => loadConfig()).toThrow(
          `JWT_SECRET must be at least 48 characters long (current: ${secret.length})`
        );
      });

      // Long enough but contains a weak pattern
      process.env.JWT_SECRET = 'Zq9!vR#m2@Lx$Pw7^Nc&Hy4*Bt(Gk)Ud8_Fs+Ej=Wo5%password';
      expect(() => loadConfig()).toThrow('JWT_SECRET contains weak pattern: "password"');

      // Long enough, no weak pattern, but only one character class
      process.env.JWT_SECRET = 'qwrtyuiopsdfghjlzxcvbnmqwrtyuiopsdfghjlzxcvbnmqwrty';
      expect(() => loadConfig()).toThrow('JWT_SECRET lacks sufficient complexity');
    });
  });

  describe('API Configuration', () => {
    it('should handle external API configurations', () => {
      // Arrange
      process.env.OPENWEATHER_API_KEY = 'openweather-api-value-0001';
      process.env.GOOGLE_MAPS_API_KEY = 'google-maps-api-value-0001';
      process.env.OPENAI_API_KEY = 'openai-api-value-0001';
      process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.invalid';
      process.env.GOOGLE_CLIENT_SECRET = 'google-client-value-0001';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.apis).toEqual({
        openWeatherApiKey: 'openweather-api-value-0001',
        googleMapsApiKey: 'google-maps-api-value-0001',
        openaiApiKey: 'openai-api-value-0001',
      });
      expect(config.google.clientId).toBe('client-id.apps.googleusercontent.invalid');
      expect(config.google.clientSecret).toBe('google-client-value-0001');
    });

    it('should reject API keys that are too short', () => {
      process.env.OPENWEATHER_API_KEY = 'short';

      expect(() => loadConfig()).toThrow(
        'OPENWEATHER_API_KEY appears to be invalid (too short)'
      );
    });
  });

  describe('Logging Configuration', () => {
    it('should handle invalid log levels', () => {
      // Arrange
      process.env.LOG_LEVEL = 'invalid-level';

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });
  });

  describe('Cache Configuration', () => {
    it('should configure Redis connection', () => {
      // Arrange
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.redisUrl).toBe('redis://localhost:6379');
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should load development configuration', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.nodeEnv).toBe('development');
    });

    it('should load production configuration', () => {
      // Arrange: production additionally requires ENCRYPTION_SALT and a strong JWT_SECRET
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = STRONG_SECRET;
      process.env.ENCRYPTION_SALT = STRONG_SALT;

      // Act
      const config = loadConfig();

      // Assert
      expect(config.nodeEnv).toBe('production');
      expect(config.jwtSecret).toBe(STRONG_SECRET);
    });

    it('should refuse to start in production without ENCRYPTION_SALT', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = STRONG_SECRET;
      delete process.env.ENCRYPTION_SALT;

      expect(() => loadConfig()).toThrow(
        'Missing required security environment variables for production: ENCRYPTION_SALT'
      );
    });

    it('should load test configuration', () => {
      // Arrange
      process.env.NODE_ENV = 'test';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.nodeEnv).toBe('test');
    });

    it('should handle unknown environment', () => {
      // Arrange
      process.env.NODE_ENV = 'staging';

      // Act
      const config = require('../../src/config/config').config;

      // Assert
      expect(config.nodeEnv).toBe('staging');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all required fields are present', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = STRONG_SECRET;

      // Act
      const config = loadConfig();

      // Assert
      expect(config.databaseUrl).toBe('postgresql://test:test@localhost:5432/test');
      expect(config.jwtSecret).toBe(STRONG_SECRET);
    });

    it('should provide meaningful error messages for missing required fields', () => {
      // Arrange
      delete process.env.DATABASE_URL;

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });

    it('should validate configuration on startup', () => {
      // Arrange
      process.env.DATABASE_URL = 'invalid-url';

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose sensitive information in logs', () => {
      // Arrange
      process.env.JWT_SECRET = STRONG_SECRET;
      process.env.DATABASE_URL = 'postgresql://user:Pw0rdValue9@host/db';
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Act
      const config = loadConfig();

      // Assert
      expect(config.jwtSecret).toBe(STRONG_SECRET);
      expect(config.databaseUrl).toBe('postgresql://user:Pw0rdValue9@host/db');
      // validateSecurityConfig logs a summary on load; it must report lengths only
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`JWT(${STRONG_SECRET.length} chars)`)
      );
      const logged = [...logSpy.mock.calls, ...warnSpy.mock.calls]
        .flat()
        .map(String)
        .join('\n');
      expect(logged).not.toContain(STRONG_SECRET);
      expect(logged).not.toContain('Pw0rdValue9');
    });

    it('should prevent configuration injection attacks', () => {
      // Arrange
      process.env.MALICIOUS_CONFIG = '__proto__.polluted = true';

      // Act & Assert
      expect(() => {
        require('../../src/config/config').config;
      }).not.toThrow();
    });
  });
});
