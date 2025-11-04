import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Response, NextFunction } from 'express';
import { AppRequest } from '@/types/requests';
import { logger } from '@/utils/logger';

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://stillontime.app',
      'https://www.stillontime.app'
    ];

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

// Rate limiting configuration
const createRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: message || `Too many requests from this IP, please try again later.`,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
      // Use user ID if authenticated, otherwise IP
      return (req as any).user?.userId || req.ip;
    },
    skip: (req: any) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health' || req.path === '/api/ready';
    }
  });
};

// Multiple rate limit tiers
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many API requests, please try again in 15 minutes.'
  ),

  // Strict rate limit for sensitive endpoints
  strict: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    10, // 10 requests per window
    'Too many authentication attempts, please try again in 15 minutes.'
  ),

  // Very strict for email processing
  email: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    50, // 50 emails per hour
    'Email processing limit reached, please try again later.'
  )
};

// Request validation middleware
export const validateRequest = (req: AppRequest, res: Response, next: NextFunction): void => {
  // Validate content-type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        error: 'Invalid Content-Type',
        message: 'Content-Type must be application/json'
      });
      return;
    }
  }

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeRequestBody(req.body);
  }

  next();
};

// Sanitize request body to prevent XSS
const sanitizeRequestBody = (body: any): any => {
  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const sanitized: any = Array.isArray(body) ? [] : {};

  for (const key in body) {
    if (body.hasOwnProperty(key)) {
      const value = body[key];

      if (typeof value === 'string') {
        // Basic XSS sanitization
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeRequestBody(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
};

// Request logging middleware
export const requestLogger = (req: AppRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';
  const userId = (req as any).user?.userId || 'anonymous';

  // Log request
  logger.info('Incoming request', {
    method,
    url,
    ip,
    userAgent,
    userId,
    timestamp: new Date().toISOString()
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    logger.info('Request completed', {
      method,
      url,
      statusCode,
      duration,
      userId,
      timestamp: new Date().toISOString()
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method,
        url,
        duration,
        userId
      });
    }
  });

  next();
};

// API versioning middleware
export const apiVersioning = (req: AppRequest, res: Response, next: NextFunction) => {
  // Handle different types of version input
  let version: string;
  const headerVersion = req.get('API-Version');
  const queryVersion = req.query.v;

  if (typeof headerVersion === 'string') {
    version = headerVersion;
  } else if (typeof queryVersion === 'string') {
    version = queryVersion;
  } else if (Array.isArray(queryVersion) && queryVersion.length > 0 && typeof queryVersion[0] === 'string') {
    version = queryVersion[0];
  } else {
    version = '1';
  }

  // Add version to request object
  (req as any).apiVersion = version;

  // Add version headers
  res.set('API-Version', version);
  res.set('API-Versions-Supported', '1');

  next();
};

// Main API Gateway middleware
export const apiGatewayMiddleware = [
  // Security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: process.env.API_URL ? ["'self'", process.env.API_URL] : ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }),

  // CORS
  cors(corsOptions),

  // Body parsing
  express.json({ limit: '10mb' }),
  express.urlencoded({ extended: true, limit: '10mb' }),

  // Request logging
  requestLogger,

  // API versioning
  apiVersioning,

  // Request validation
  validateRequest,

  // General rate limiting
  rateLimiters.general
];

// Rate limiting middleware for specific routes
export const applyRateLimit = (type: 'general' | 'strict' | 'email') => {
  return rateLimiters[type];
};

// Trust proxy for rate limiting and IP detection
export const trustProxy = () => {
  return express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  });
};