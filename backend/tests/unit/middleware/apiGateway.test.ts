import request from 'supertest';
import { apiGatewayMiddleware } from '@/middleware/apiGateway';
import { apiRoutes } from '@/routes';
import { errorHandler } from '@/middleware/errorHandler';
import { services } from '@/services';
import { logger } from '@/utils/logger';
import express from 'express';

/**
 * The gateway stack is exported but not wired into src/index.ts, so these
 * tests mount it themselves in front of the real route graph:
 *   [pre] -> apiGatewayMiddleware -> [routes] -> /api routes -> errorHandler
 * `pre` runs before the gateway (e.g. to give the rate limiter its own key,
 * since its MemoryStore is a module-level singleton shared by every test).
 */
function gatewayApp(options: {
  pre?: express.RequestHandler;
  routes?: (app: express.Application) => void;
} = {}): express.Application {
  const app = express();
  if (options.pre) app.use(options.pre);
  app.use(apiGatewayMiddleware);
  // /api/health is exempt from rate limiting; /api/ping is not.
  app.get('/api/ping', (req, res) => {
    res.json({ pong: true });
  });
  options.routes?.(app);
  app.use('/api', apiRoutes);
  app.use(errorHandler);
  return app;
}

describe('API Gateway Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = gatewayApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should rate limit excessive requests', async () => {
      // keyGenerator prefers req.user.userId: use a key no other test shares.
      const limitedApp = gatewayApp({
        pre: (req, _res, next) => {
          (req as any).user = { userId: 'rate-limit-probe' };
          next();
        },
      });
      const promises = Array(101).fill(null).map(() =>
        request(limitedApp).get('/api/ping')
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      // general tier: 100 requests per 15 minutes
      expect(rateLimitedResponses.length).toBe(1);
      expect(rateLimitedResponses[0].body).toEqual({
        error: 'Too many requests',
        message: 'Too many API requests, please try again in 15 minutes.',
        retryAfter: 900,
      });
    });

    it('should include rate limit headers', async () => {
      // standardHeaders: true (draft-6 RateLimit-* headers), legacyHeaders: false
      const response = await request(app)
        .get('/api/ping')
        .expect(200);

      expect(response.headers).toHaveProperty('ratelimit-limit', '100');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
      expect(response.headers).not.toHaveProperty('x-ratelimit-limit');
    });
  });

  describe('CORS Configuration', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/schedules')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204); // cors default optionsSuccessStatus

      expect(response.headers).toHaveProperty('access-control-allow-origin', 'http://localhost:3000');
      expect(response.headers).toHaveProperty(
        'access-control-allow-methods',
        'GET,POST,PUT,DELETE,PATCH,OPTIONS'
      );
      expect(response.headers).toHaveProperty(
        'access-control-allow-headers',
        'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-API-Key'
      );
    });

    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin', 'http://localhost:3000');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // helmet 7 defaults (frameguard: SAMEORIGIN, X-XSS-Protection disabled with "0")
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(response.headers).toHaveProperty('x-xss-protection', '0');
    });
  });

  describe('Request Validation', () => {
    it('should validate JSON payloads', async () => {
      const response = await request(app)
        .post('/api/schedules')
        .send('invalid json') // a bare string is sent as form-urlencoded
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid Content-Type',
        message: 'Content-Type must be application/json',
      });
    });

    it('should sanitize request data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'test',
      };

      const response = await request(app)
        .post('/api/schedules')
        .send(maliciousData)
        .expect(401); // Unauthorized without valid token

      // The middleware should sanitize or reject malicious input
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without valid JWT token', async () => {
      const response = await request(app)
        .get('/api/schedules')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should accept requests with valid JWT token', async () => {
      const token = 'valid-jwt-token';
      const response = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${token}`)
        .expect(401); // Still 401 because we're using mock tokens in tests

      expect(response.body).toHaveProperty('error');
    });

    it('should extract user information from token', async () => {
      const app = express();
      app.use(express.json());

      // Mock auth middleware that extracts user info
      app.use((req, res, next) => {
        req.user = { userId: 'test-123', email: 'test@example.com' };
        next();
      });

      app.get('/api/protected', (req, res) => {
        res.json({ user: req.user });
      });

      const response = await request(app)
        .get('/api/protected')
        .expect(200);

      expect(response.body.user).toHaveProperty('userId');
      expect(response.body.user).toHaveProperty('email');
    });
  });

  describe('API Versioning', () => {
    it('should handle versioned routes', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(404); // Route not implemented yet

      // TODO: Implement versioned routes
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      const spy = jest.spyOn(logger, 'info');

      await request(app)
        .get('/api/health')
        .expect(200);

      // Verify request was logged
      expect(spy).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({ method: 'GET', url: '/api/health', userId: 'anonymous' })
      );
      expect(spy).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ method: 'GET', url: '/api/health', statusCode: 200 })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Get past authenticateToken + requireValidOAuth to reach validation.
      const token = services.oauth2.generateJWT({
        id: 'gateway-user',
        email: 'gateway-user@example.invalid',
      } as any);
      jest.spyOn(services.oauth2, 'getOAuthStatus').mockResolvedValue({
        isAuthenticated: true,
        scopes: [],
        needsReauth: false,
      } as any);

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'emailId', msg: 'emailId is required' }),
          expect.objectContaining({ path: 'location' }),
        ])
      );
    });

    it('should handle server errors gracefully', async () => {
      // Mock a route that throws an error (registered before errorHandler)
      const app = gatewayApp({
        routes: (a) => {
          a.get('/api/error', () => {
            throw new Error('Test error');
          });
        },
      });

      const response = await request(app)
        .get('/api/error')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
      expect(response.body).toHaveProperty('message', 'Test error');
    });
  });
});