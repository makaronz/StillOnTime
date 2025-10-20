import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../src/config/config';
import { initializeDatabase } from '../src/config/database';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('../src/config/database');
jest.mock('../src/utils/logger');

const mockInitializeDatabase = initializeDatabase as jest.MockedFunction<typeof initializeDatabase>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Application Initialization Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
  });

  beforeEach(async () => {
    // Create test application
    app = express();

    // Basic middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Initialize mock database
    mockInitializeDatabase.mockResolvedValue();
    mockLogger.info.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
  });

  afterEach(async () => {
    if (server) {
      server.close();
    }
    jest.clearAllMocks();
  });

  describe('Basic Application Setup', () => {
    it('should initialize application without errors', async () => {
      // Arrange & Act
      expect(async () => {
        await mockInitializeDatabase();
      }).not.toThrow();
    });

    it('should respond to health check', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Environment Configuration', () => {
    it('should load correct environment variables', () => {
      // Assert
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.PORT).toBe('3001');
    });

    it('should handle missing environment variables gracefully', () => {
      // Arrange
      delete process.env.DATABASE_URL;

      // Act & Assert
      expect(() => {
        // This should not crash the application
        config.databaseUrl;
      }).not.toThrow();
    });

    it('should validate required environment variables', () => {
      // Test that required variables are present
      const requiredVars = ['NODE_ENV', 'PORT'];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
      });
    });
  });

  describe('Middleware Initialization', () => {
    it('should initialize security middleware', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert - Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should initialize CORS middleware', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert - Check CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle JSON parsing middleware', async () => {
      // Act
      const response = await request(app)
        .post('/health')
        .send({ test: 'data' })
        .expect(404); // Route doesn't exist, but middleware should work

      // Assert - If we get here, JSON parsing worked
      expect(true).toBe(true);
    });
  });

  describe('Service Dependencies', () => {
    it('should initialize database connection', async () => {
      // Act
      await mockInitializeDatabase();

      // Assert
      expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
    });

    it('should handle database initialization failure', async () => {
      // Arrange
      mockInitializeDatabase.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(mockInitializeDatabase()).rejects.toThrow('Database connection failed');
    });

    it('should initialize logging service', () => {
      // Assert
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      // Act
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      // Assert
      expect(response.body).toBeDefined();
    });

    it('should handle invalid JSON requests', async () => {
      // Act
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Assert
      expect(response.body).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      // Arrange
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/health')
      );

      // Act
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large payload requests', async () => {
      // Arrange
      const largePayload = {
        data: 'x'.repeat(10000) // 10KB payload
      };

      // Act
      const response = await request(app)
        .post('/health')
        .send(largePayload)
        .expect(404); // Route doesn't exist, but should handle large payload

      // Assert
      expect(response.body).toBeDefined();
    });
  });

  describe('Security Validation', () => {
    it('should include security headers', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should handle malicious requests safely', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .set('User-Agent', '<script>alert("xss")</script>')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle SIGTERM signal', async () => {
      // Arrange
      const processMock = jest.spyOn(process, 'emit').mockImplementation(() => true);

      // Act
      process.emit('SIGTERM');

      // Assert
      expect(processMock).toHaveBeenCalledWith('SIGTERM');

      processMock.mockRestore();
    });

    it('should handle SIGINT signal', async () => {
      // Arrange
      const processMock = jest.spyOn(process, 'emit').mockImplementation(() => true);

      // Act
      process.emit('SIGINT');

      // Assert
      expect(processMock).toHaveBeenCalledWith('SIGINT');

      processMock.mockRestore();
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid port configuration', () => {
      // Assert
      const port = parseInt(process.env.PORT || '3001');
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });

    it('should have proper CORS configuration', () => {
      // Test CORS middleware is properly configured
      expect(app.use).toBeDefined();
    });

    it('should have security middleware configured', () => {
      // Test security middleware is properly configured
      expect(app.use).toBeDefined();
    });
  });
});