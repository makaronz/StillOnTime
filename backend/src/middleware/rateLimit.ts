import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'redis';
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';

// Initialize Redis client for rate limiting
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused', { error: options.error });
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis retry attempts exhausted');
      return undefined;
    }
    // Retry after min(options.attempt * 100, 3000) milliseconds
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limit error', { error: err });
});

redisClient.on('connect', () => {
  logger.info('Redis rate limiter connected');
});

// Create Redis store for rate limiting
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args) as Promise<any>,
    prefix: `rl:${prefix}:`,
  });
};

// Rate limiter configurations
export const rateLimitConfigs = {
  // General API rate limiting
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 900 // 15 minutes
    },
    store: createRedisStore('general'),
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return (req as any).user?.userId || req.ip;
    }
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: 'Too many authentication attempts',
      message: 'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.',
      retryAfter: 900
    },
    store: createRedisStore('auth'),
    keyGenerator: (req: Request) => {
      const email = req.body?.email || req.ip;
      return `auth:${email}`;
    },
    skipSuccessfulRequests: true
  },

  // Email processing
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 emails per hour
    message: {
      error: 'Email processing limit exceeded',
      message: 'You have reached the hourly email processing limit. Please try again later.',
      retryAfter: 3600
    },
    store: createRedisStore('email'),
    keyGenerator: (req: Request) => {
      return (req as any).user?.userId || req.ip;
    }
  },

  // File uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: {
      error: 'Upload limit exceeded',
      message: 'You have reached the hourly upload limit. Please try again later.',
      retryAfter: 3600
    },
    store: createRedisStore('upload'),
    keyGenerator: (req: Request) => {
      return (req as any).user?.userId || req.ip;
    }
  },

  // API search endpoints
  search: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    message: {
      error: 'Search limit exceeded',
      message: 'Too many search requests. Please wait a moment before searching again.',
      retryAfter: 60
    },
    store: createRedisStore('search'),
    keyGenerator: (req: Request) => {
      return (req as any).user?.userId || req.ip;
    }
  }
};

// Create rate limiters
export const rateLimiters = {
  general: rateLimit(rateLimitConfigs.general),
  auth: rateLimit(rateLimitConfigs.auth),
  email: rateLimit(rateLimitConfigs.email),
  upload: rateLimit(rateLimitConfigs.upload),
  search: rateLimit(rateLimitConfigs.search)
};

// Custom rate limiting middleware with enhanced features
export const createRateLimitMiddleware = (config: typeof rateLimitConfigs.general) => {
  const limiter = rateLimit({
    ...config,
    handler: (req: Request, res: Response) => {
      const retryAfter = config.message.retryAfter;

      // Log rate limit violation
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: (req as any).user?.userId,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      // Set rate limit headers
      res.set({
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': config.max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString()
      });

      res.status(429).json(config.message);
    },
    onLimitReached: (req: Request, res: Response) => {
      logger.error('Rate limit reached', {
        ip: req.ip,
        userId: (req as any).user?.userId,
        path: req.path,
        method: req.method
      });
    }
  });

  return limiter;
};

// Dynamic rate limiting based on user tier
export const dynamicRateLimit = async (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;

  // Default limits for anonymous users
  let windowMs = 15 * 60 * 1000; // 15 minutes
  let max = 100;

  if (user) {
    // TODO: Fetch user tier from database
    // const userTier = await getUserTier(user.userId);
    const userTier = 'premium'; // Mock tier

    switch (userTier) {
      case 'free':
        windowMs = 15 * 60 * 1000;
        max = 50;
        break;
      case 'premium':
        windowMs = 15 * 60 * 1000;
        max = 500;
        break;
      case 'enterprise':
        windowMs = 15 * 60 * 1000;
        max = 2000;
        break;
    }
  }

  const limiter = createRateLimitMiddleware({
    windowMs,
    max,
    message: {
      error: 'Rate limit exceeded',
      message: `Rate limit: ${max} requests per ${Math.ceil(windowMs / 60000)} minutes.`,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    store: createRedisStore('dynamic'),
    keyGenerator: (req: Request) => {
      return (req as any).user?.userId || req.ip;
    }
  });

  return limiter(req, res, next);
};

// Reset rate limit for a user (admin function)
export const resetUserRateLimit = async (userId: string) => {
  const keys = await redisClient.keys(`rl:*:${userId}`);
  if (keys.length > 0) {
    await redisClient.del(keys);
    logger.info('Rate limit reset for user', { userId, keysDeleted: keys.length });
  }
};

// Get rate limit status for a user
export const getUserRateLimitStatus = async (userId: string) => {
  const patterns = ['general', 'auth', 'email', 'upload', 'search'];
  const status: any = {};

  for (const pattern of patterns) {
    const key = `rl:${pattern}:${userId}`;
    const remaining = await redisClient.get(key);
    status[pattern] = {
      key,
      remaining: remaining ? parseInt(remaining) : null
    };
  }

  return status;
};