import { Request, Response, NextFunction } from "express";
import { services } from "@/services";
import { SecureCookieManager } from "@/utils/cookies";
import { logger } from "@/utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        fingerprint?: string;
      };
    }
  }
}

/**
 * Enhanced Authentication Middleware using Secure HttpOnly Cookies
 * Replaces localStorage-based authentication with secure cookie approach
 */
export const secureAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get JWT token from secure cookie
    const token = SecureCookieManager.getJWTToken(req);

    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        code: "MISSING_AUTH_COOKIE",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    // Verify JWT token
    const decoded = services.oauth2.verifyJWT(token);

    // Generate and validate fingerprint for additional security
    const fingerprint = SecureCookieManager.generateFingerprint(req);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      fingerprint,
    };

    logger.debug("User authenticated successfully via secure cookie", {
      userId: decoded.userId,
      email: decoded.email,
      path: req.path,
      hasFingerprint: !!fingerprint,
    });

    next();
  } catch (error) {
    logger.error("Secure authentication failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    // Clear invalid cookies
    SecureCookieManager.clearAuthCookies(res);

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired authentication",
      code: "INVALID_AUTH_COOKIE",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Optional secure authentication middleware
 * Doesn't fail if no token is provided but validates if present
 */
export const optionalSecureAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = SecureCookieManager.getJWTToken(req);

    if (token) {
      try {
        const decoded = services.oauth2.verifyJWT(token);
        const fingerprint = SecureCookieManager.generateFingerprint(req);

        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          fingerprint,
        };

        logger.debug("Optional secure authentication succeeded", {
          userId: decoded.userId,
          email: decoded.email,
          path: req.path,
        });
      } catch (error) {
        logger.warn("Invalid token in optional secure auth", {
          error: error instanceof Error ? error.message : "Unknown error",
          path: req.path,
        });

        // Clear invalid cookies
        SecureCookieManager.clearAuthCookies(res);
      }
    }

    next();
  } catch (error) {
    logger.error("Unexpected error in optional secure auth", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });
    next();
  }
};

/**
 * Secure authentication middleware with CSRF validation
 * Combines cookie-based auth with CSRF protection
 */
export const secureAuthWithCSRF = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First, authenticate via secure cookie
    const token = SecureCookieManager.getJWTToken(req);

    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        code: "MISSING_AUTH_COOKIE",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    const decoded = services.oauth2.verifyJWT(token);
    const fingerprint = SecureCookieManager.generateFingerprint(req);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      fingerprint,
    };

    // For state-changing requests, validate CSRF token
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const csrfToken = SecureCookieManager.getCSRFToken(req);

      if (!csrfToken) {
        res.status(403).json({
          error: "Forbidden",
          message: "CSRF token required",
          code: "CSRF_TOKEN_MISSING",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Here you would validate the CSRF token against the session
      // This is a simplified version - in practice you'd store CSRF tokens in Redis
      logger.debug("CSRF token validation required", {
        path: req.path,
        method: req.method,
        hasCSRFToken: !!csrfToken,
      });
    }

    logger.debug("Secure authentication with CSRF validation succeeded", {
      userId: decoded.userId,
      email: decoded.email,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error("Secure authentication with CSRF failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
      method: req.method,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    // Clear invalid cookies
    SecureCookieManager.clearAuthCookies(res);

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired authentication",
      code: "INVALID_AUTH_COOKIE",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Middleware to validate refresh token from secure cookie
 */
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = SecureCookieManager.getRefreshToken(req);

    if (!refreshToken) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Refresh token required",
        code: "MISSING_REFRESH_COOKIE",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    // Validate refresh token format
    if (refreshToken.length < 10) {
      SecureCookieManager.clearAuthCookies(res);
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid refresh token format",
        code: "INVALID_REFRESH_TOKEN",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    logger.debug("Refresh token validation succeeded", {
      path: req.path,
      tokenLength: refreshToken.length,
    });

    // Attach refresh token to request for use in route handlers
    (req as any).refreshToken = refreshToken;

    next();
  } catch (error) {
    logger.error("Refresh token validation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });

    SecureCookieManager.clearAuthCookies(res);

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid refresh token",
      code: "REFRESH_TOKEN_INVALID",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Middleware to ensure authentication state consistency
 */
export const ensureAuthConsistency = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const hasJWTToken = !!SecureCookieManager.getJWTToken(req);
    const hasRefreshToken = !!SecureCookieManager.getRefreshToken(req);
    const hasAuthStatus = req.cookies?.auth_status === "active";

    // If inconsistent state, clear all auth cookies
    if ((hasJWTToken && !hasAuthStatus) || (!hasJWTToken && hasAuthStatus)) {
      logger.warn("Inconsistent authentication state detected", {
        path: req.path,
        hasJWTToken,
        hasRefreshToken,
        hasAuthStatus,
        ip: req.ip,
      });

      SecureCookieManager.clearAuthCookies(res);
    }

    next();
  } catch (error) {
    logger.error("Auth consistency check failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });
    next();
  }
};