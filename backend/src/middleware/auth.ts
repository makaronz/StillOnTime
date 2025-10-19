import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from '@/config/database';
import { userRepository } from '@/repositories/user.repository';
import { scheduleDataRepository } from '@/repositories/schedule-data.repository';
import { processedEmailRepository } from '@/repositories/processed-email.repository';
import { routePlanRepository } from '@/repositories/route-plan.repository';
import { logger } from '@/utils/logger';
import { applyRateLimit } from './rateLimit';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        name?: string;
        role?: string;
        tier?: string;
      };
    }
  }
}

// JWT token interface
interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

// Verify JWT token
export const verifyToken = (token: string): Promise<JWTPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
};

// Generate JWT token
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'stillontime-api',
    audience: 'stillontime-client'
  });
};

// Generate refresh token
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
};

// Authentication middleware
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid authorization header provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = await verifyToken(token);

    // Fetch user from database to ensure they still exist and get latest info
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    // Add user to request object
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      role: 'user', // Default role, can be extended
      tier: 'free' // Default tier, can be extended
    };

    // Log successful authentication
    logger.info('User authenticated', {
      userId: user.id,
      email: user.email,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Invalid authentication token.',
        code: 'INVALID_TOKEN'
      });
    }

    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate user'
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await verifyToken(token);

      const user = await userRepository.findById(decoded.userId);

      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          name: user.name || undefined,
          role: 'user',
          tier: 'free'
        };
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

// Role-based authorization
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Tier-based authorization
export const requireTier = (tiers: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const allowedTiers = Array.isArray(tiers) ? tiers : [tiers];
    const userTier = req.user.tier || 'free';

    if (!allowedTiers.includes(userTier)) {
      return res.status(403).json({
        error: 'Upgrade required',
        message: `This feature requires a ${allowedTiers.join(' or ')} plan`,
        requiredTier: allowedTiers[0],
        currentTier: userTier
      });
    }

    next();
  };
};

// Resource owner verification
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const resourceId = req.params[resourceIdParam];
      const resourceType = req.baseUrl.split('/').pop();

      // Check ownership based on resource type
      let isOwner = false;

      switch (resourceType) {
        case 'schedules':
          const schedule = await scheduleDataRepository.findById(resourceId);
          isOwner = !!schedule && schedule.userId === req.user!.userId;
          break;

        case 'emails':
          const email = await processedEmailRepository.findById(resourceId);
          isOwner = !!email && email.userId === req.user!.userId;
          break;

        case 'routes':
          const route = await routePlanRepository.findById(resourceId);
          isOwner = !!route && route.userId === req.user!.userId;
          break;

        default:
          return res.status(400).json({
            error: 'Invalid resource type',
            message: 'Cannot verify ownership for this resource type'
          });
      }

      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership verification error', {
        error: error.message,
        resourceId: req.params[resourceIdParam],
        userId: req.user?.userId
      });

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Unable to verify resource ownership'
      });
    }
  };
};

// API key authentication (for service-to-service communication)
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.get('X-API-Key');

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    // TODO: Implement API key validation
    // const validKey = await validateApiKey(apiKey);
    const validKey = false; // Mock validation

    if (!validKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    // Add service context to request
    (req as any).service = true;

    next();
  } catch (error) {
    logger.error('API key authentication error', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to authenticate with API key'
    });
  }
};

// Refresh token middleware
export const refreshTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Invalid refresh token'
      });
    }

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    // Generate new access token
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined
    });

    res.json({
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Refresh token has expired. Please log in again.'
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      message: 'Invalid refresh token'
    });
  }
};