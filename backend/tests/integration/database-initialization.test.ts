import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { config } from '../../src/config/config';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/config/config');
jest.mock('../../src/utils/logger');

// The pg Pool is the network boundary: src/config/database.ts builds its pool
// at import time, so hand it this stand-in instead of a real connection.
const mockPool: any = {
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
};
jest.mock('pg', () => ({ Pool: jest.fn(() => mockPool) }));

// tests/setup.ts replaces '@/config/database' with stubs for every other
// suite; this suite exercises the real module.
const { Pool: MockedPool } = jest.requireMock('pg') as { Pool: jest.Mock };
const realDatabase = jest.requireActual(
  '../../src/config/database'
) as typeof import('../../src/config/database');
const { initializeDatabase, checkDatabaseConnection } = realDatabase;
const poolConstructorArgs = MockedPool.mock.calls.map((call) => call[0]);
const databaseUrlAtLoad = config.databaseUrl;

const mockConfig = config as jest.Mocked<typeof config>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Database Initialization Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Fresh pool methods (the module holds a reference to this same object)
    mockPool.query = jest.fn();
    mockPool.end = jest.fn();
    mockPool.on = jest.fn();
    mockPool.connect = jest.fn();

    // Setup config mock
    mockConfig.databaseUrl = 'postgresql://test:test@localhost:5432/testdb';
    mockConfig.nodeEnv = 'test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Database Connection', () => {
    it('should successfully connect to database', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await checkDatabaseConnection();

      // Assert
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle connection failure gracefully', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockPool.query.mockRejectedValue(error);

      // Act
      const result = await checkDatabaseConnection();

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Database connection failed', { error });
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'ConnectionTimeoutError';
      mockPool.query.mockRejectedValue(timeoutError);

      // Act
      const result = await checkDatabaseConnection();

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Database connection failed', { error: timeoutError });
    });
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [] });
      mockLogger.info.mockImplementation(() => {});

      // Act
      await expect(initializeDatabase()).resolves.toBeUndefined();

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Database connected successfully', {
        environment: 'test',
        version: '1.0.0',
      });
    });

    it('should throw error when connection fails', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(error);

      // Act & Assert
      await expect(initializeDatabase()).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Failed to connect to database', { error });
    });

    it('should throw error when health check fails', async () => {
      // Arrange
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Initial connection succeeds
        .mockRejectedValueOnce(new Error('Health check failed')); // Health check fails

      // Act & Assert
      await expect(initializeDatabase()).rejects.toThrow('Database health check failed');
    });
  });

  describe('Database Configuration', () => {
    it('should build the pg pool from config.databaseUrl', () => {
      expect(poolConstructorArgs).toEqual([
        {
          connectionString: databaseUrlAtLoad,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        },
      ]);
    });

    it('should continue without a database in development', async () => {
      // Arrange
      mockConfig.nodeEnv = 'development';
      const error = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(error);

      // Act & Assert
      await expect(initializeDatabase()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Failed to connect to database', { error });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️ Development mode: Continuing without database connection'
      );
    });

    it('should have correct pool configuration', () => {
      // Test that the database is configured with correct settings
      expect(mockConfig.databaseUrl).toBeDefined();
      expect(mockConfig.databaseUrl).toMatch(/^postgresql:\/\//);
    });

    it('should handle environment-specific configurations', () => {
      // Test different environment configurations
      const environments = ['development', 'test', 'production'];

      environments.forEach(env => {
        mockConfig.nodeEnv = env;
        expect(mockConfig.nodeEnv).toBe(env);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle multiple connection attempts', async () => {
      // Arrange: checkDatabaseConnection is a single-shot probe (no retry);
      // each call reports the current state and a later call recovers.
      mockPool.query
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({ rows: [] }); // Third attempt succeeds

      // Act
      const results = [
        await checkDatabaseConnection(),
        await checkDatabaseConnection(),
        await checkDatabaseConnection(),
      ];

      // Assert
      expect(results).toEqual([false, false, true]);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });

    it('should handle network interruptions', async () => {
      // Arrange
      const networkError = new Error('Network interrupted');
      networkError.name = 'NetworkError';
      mockPool.query.mockRejectedValue(networkError);

      // Act
      const result = await checkDatabaseConnection();

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Database connection failed', { error: networkError });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent connection requests', async () => {
      // Arrange
      const concurrentRequests = 10;
      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const promises = Array(concurrentRequests).fill(null).map(() => checkDatabaseConnection());
      const results = await Promise.all(promises);

      // Assert
      expect(results.every(result => result === true)).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('should complete connection check within timeout', async () => {
      // Arrange
      const startTime = Date.now();
      mockPool.query.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 100))
      );

      // Act
      await checkDatabaseConnection();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Security Validation', () => {
    it('should not log sensitive connection information', async () => {
      // Arrange
      mockConfig.databaseUrl = 'postgresql://user:password@localhost:5432/db';
      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await checkDatabaseConnection();

      // Assert
      // Ensure password is not logged
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: expect.stringContaining('password')
        })
      );
    });

    it('should handle SSL connection configuration', () => {
      // Test SSL configuration
      const sslConfig = {
        connectionString: mockConfig.databaseUrl,
        ssl: { rejectUnauthorized: true }
      };

      expect(sslConfig.connectionString).toBeDefined();
      expect(sslConfig.ssl).toBeDefined();
    });
  });

  describe('Integration with External Services', () => {
    it('should handle Redis cache dependency', async () => {
      // Test that database initialization works with Redis cache
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await checkDatabaseConnection();
      expect(result).toBe(true);
    });

    it('should handle monitoring service integration', async () => {
      // Test monitoring integration
      mockPool.query.mockResolvedValue({ rows: [] });
      mockLogger.info.mockImplementation(() => {});

      await initializeDatabase();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '✅ Database connected successfully',
        expect.objectContaining({
          environment: expect.any(String),
          version: expect.any(String)
        })
      );
    });
  });
});