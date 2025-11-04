import { Response, NextFunction } from "express";
import { AppRequest } from "@/types/requests";
import { services } from "@/services";
import { logger } from "@/utils/logger";

/**
 * Authentication middleware that verifies JWT tokens
 * and attaches user information to the request
 */
export const authenticateToken = async (
  req: any, // Use any to be compatible with Express Request
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
    req["user"] = {
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
  req: any, // Use any to be compatible with Express Request
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
  req: any, // Use any to be compatible with Express Request
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
    const oauthStatus = await services.oauth2.getOAuthStatus(
      req.user.userId
    );

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
 * Enhanced rate limiting middleware for authentication endpoints
 * Uses both IP-based and user-based rate limiting for better security
 */
export const authRateLimit = (
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
) => {
  const ipAttempts = new Map<string, { count: number; resetTime: number }>();
  const userAttempts = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: Response, next: NextFunction): void => {
    // Handle undefined ip safely - Express provides ip as string | undefined
    const clientIp = (req.ip as string) || req.connection?.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";
    const now = Date.now();

    // Create a more unique identifier combining IP and User-Agent
    const clientId = `${clientIp}:${userAgent.substring(0, 50)}`;

    // Clean up expired entries
    for (const [key, value] of ipAttempts.entries()) {
      if (now > value.resetTime) {
        ipAttempts.delete(key);
      }
    }

    for (const [key, value] of userAttempts.entries()) {
      if (now > value.resetTime) {
        userAttempts.delete(key);
      }
    }

    // Check IP-based rate limiting
    const ipClientAttempts = ipAttempts.get(clientId);

    if (!ipClientAttempts) {
      ipAttempts.set(clientId, { count: 1, resetTime: now + windowMs });
    } else if (ipClientAttempts.count >= maxAttempts) {
      logger.warn("IP-based rate limit exceeded for authentication", {
        clientId: clientIp,
        userAgent,
        attempts: ipClientAttempts.count,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: `Too many authentication attempts from this IP. Try again in ${Math.ceil(
          (ipClientAttempts.resetTime - now) / 1000
        )} seconds.`,
        code: "IP_RATE_LIMIT_EXCEEDED",
        timestamp: new Date().toISOString(),
        path: req.path,
        retryAfter: Math.ceil((ipClientAttempts.resetTime - now) / 1000),
      });
      return;
    } else {
      ipClientAttempts.count++;
    }

    // For callback endpoints, also check user-based rate limiting
    if (req.body?.email || req.body?.state) {
      const userIdentifier = req.body.email || req.body.state || "anonymous";
      const userClientAttempts = userAttempts.get(userIdentifier);

      if (!userClientAttempts) {
        userAttempts.set(userIdentifier, {
          count: 1,
          resetTime: now + windowMs,
        });
      } else if (userClientAttempts.count >= maxAttempts) {
        logger.warn("User-based rate limit exceeded for authentication", {
          userIdentifier: userIdentifier.substring(0, 10) + "...",
          clientId: clientIp,
          attempts: userClientAttempts.count,
          path: req.path,
          method: req.method,
        });

        res.status(429).json({
          error: "Too Many Requests",
          message: `Too many authentication attempts for this account. Try again in ${Math.ceil(
            (userClientAttempts.resetTime - now) / 1000
          )} seconds.`,
          code: "USER_RATE_LIMIT_EXCEEDED",
          timestamp: new Date().toISOString(),
          path: req.path,
          retryAfter: Math.ceil((userClientAttempts.resetTime - now) / 1000),
        });
        return;
      } else {
        userClientAttempts.count++;
      }
    }

    next();
  };
};

/**
 * Middleware to validate API key for webhook endpoints
 */
export const validateApiKey = (
  req: any, // Use any to be compatible with Express Request
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
      ip: req.ip as string,
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
  req: any, // Use any to be compatible with Express Request
  res: Response,
  next: NextFunction
): void => {
  logger.error("Authentication error", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userAgent: req.get("User-Agent"),
    ip: req.ip as string,
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

/**
 * Alias for authenticateToken to match expected import name
 */
export const authMiddleware = authenticateToken;
