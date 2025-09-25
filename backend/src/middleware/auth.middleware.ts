import { Request, Response, NextFunction } from "express";
import { services } from "@/services";
import { logger } from "@/utils/logger";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

/**
 * Authentication middleware that verifies JWT tokens
 * and attaches user information to the request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Access token is required",
        code: "MISSING_TOKEN",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    // Verify JWT token
    const decoded = services.oauth2.verifyJWT(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    logger.debug("User authenticated successfully", {
      userId: decoded.userId,
      email: decoded.email,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error("Authentication failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
      userAgent: req.get("User-Agent"),
    });

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
      code: "INVALID_TOKEN",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Optional authentication middleware that doesn't fail if no token is provided
 * but still verifies the token if present
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      try {
        const decoded = services.oauth2.verifyJWT(token);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.warn("Invalid token provided in optional auth", {
          error: error instanceof Error ? error.message : "Unknown error",
          path: req.path,
        });
      }
    }

    next();
  } catch (error) {
    // Should not happen, but just in case
    logger.error("Unexpected error in optional auth middleware", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });
    next();
  }
};

/**
 * Middleware to check if user has valid OAuth tokens
 * This checks the database for valid Google OAuth tokens
 */
export const requireValidOAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        code: "NOT_AUTHENTICATED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    // Check OAuth status
    const oauthStatus = await services.oauth2.getOAuthStatus(req.user.userId);

    if (!oauthStatus.isAuthenticated) {
      res.status(403).json({
        error: "Forbidden",
        message: "Google OAuth authentication required",
        code: "OAUTH_REQUIRED",
        timestamp: new Date().toISOString(),
        path: req.path,
        authUrl: await services.oauth2.getAuthUrl(),
      });
      return;
    }

    if (oauthStatus.needsReauth) {
      res.status(403).json({
        error: "Forbidden",
        message: "Google OAuth re-authentication required",
        code: "OAUTH_REAUTH_REQUIRED",
        timestamp: new Date().toISOString(),
        path: req.path,
        authUrl: await services.oauth2.getAuthUrl(),
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("OAuth validation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.userId,
      path: req.path,
    });

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to validate OAuth status",
      code: "OAUTH_VALIDATION_ERROR",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || "unknown";
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }

    const clientAttempts = attempts.get(clientId);

    if (!clientAttempts) {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      logger.warn("Rate limit exceeded for authentication", {
        clientId,
        attempts: clientAttempts.count,
        path: req.path,
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: `Too many authentication attempts. Try again in ${Math.ceil(
          (clientAttempts.resetTime - now) / 1000
        )} seconds.`,
        code: "RATE_LIMIT_EXCEEDED",
        timestamp: new Date().toISOString(),
        path: req.path,
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000),
      });
      return;
    }

    clientAttempts.count++;
    next();
  };
};

/**
 * Middleware to validate API key for webhook endpoints
 */
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "API key is required",
      code: "MISSING_API_KEY",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  // In a real implementation, you would validate against stored API keys
  // For now, we'll use a simple environment variable
  const validApiKey = process.env.WEBHOOK_API_KEY;

  if (!validApiKey || apiKey !== validApiKey) {
    logger.warn("Invalid API key provided", {
      providedKey: apiKey.substring(0, 8) + "...",
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
      code: "INVALID_API_KEY",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next();
};

/**
 * Error handler specifically for authentication errors
 */
export const authErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error("Authentication error", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  });

  // Check if response was already sent
  if (res.headersSent) {
    return next(error);
  }

  // Handle specific authentication errors
  if (error.name === "JsonWebTokenError") {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid token format",
      code: "MALFORMED_TOKEN",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  if (error.name === "TokenExpiredError") {
    res.status(401).json({
      error: "Unauthorized",
      message: "Token has expired",
      code: "EXPIRED_TOKEN",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  // Generic authentication error
  res.status(500).json({
    error: "Internal Server Error",
    message: "Authentication system error",
    code: "AUTH_SYSTEM_ERROR",
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
