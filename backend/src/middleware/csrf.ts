import { Request, Response, NextFunction } from "express";
import csrf from "csurf";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    key: "_csrf",
  },
});

/**
 * CSRF Error Handler
 * Handles CSRF token validation errors
 */
export const csrfErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if ((err as any).code === "EBADCSRFTOKEN") {
    logger.warn("CSRF token validation failed", {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(403).json({
      error: "Forbidden",
      message: "Invalid CSRF token. Please refresh the page and try again.",
      code: "CSRF_TOKEN_INVALID",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next(err);
};

/**
 * Middleware to skip CSRF protection for specific routes
 */
export const skipCsrfForRoutes = (
  excludedPaths: string[]
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF for excluded paths
    if (excludedPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Apply CSRF protection
    csrfProtection(req, res, next);
  };
};

/**
 * Middleware to set CSRF token in response cookie
 * Frontend can read this token from XSRF-TOKEN cookie
 */
export const setCsrfTokenCookie = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.csrfToken) {
    try {
      const token = req.csrfToken();
      res.cookie("XSRF-TOKEN", token, {
        httpOnly: false, // Frontend needs to read this
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        maxAge: 3600000, // 1 hour
      });
    } catch (error) {
      logger.error("Failed to set CSRF token cookie", { error });
    }
  }
  next();
};

/**
 * Route handler to provide CSRF token to frontend
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  try {
    const token = req.csrfToken();
    res.json({
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
    });
  } catch (error) {
    logger.error("Failed to generate CSRF token", { error });
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate CSRF token",
      code: "CSRF_TOKEN_GENERATION_FAILED",
    });
  }
};

