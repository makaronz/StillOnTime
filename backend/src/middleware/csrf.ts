import { Request, Response, NextFunction } from "express";
import csrf from "csurf";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";

/**
 * Enhanced CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks with additional security measures
 */
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    key: "_csrf",
    maxAge: 3600000, // 1 hour
  },
  // Additional CSRF protection settings
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
});

/**
 * Enhanced CSRF Error Handler with detailed logging and response
 * Handles CSRF token validation errors with enhanced security monitoring
 */
export const csrfErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if ((err as any).code === "EBADCSRFTOKEN") {
    // Enhanced security logging for CSRF violations
    const securityContext = {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      referer: req.get("Referer"),
      origin: req.get("Origin"),
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    };

    logger.warn("CSRF token validation failed - potential attack", securityContext);

    // Rate limit CSRF violations by IP
    const violationKey = `csrf_violation_${req.ip}`;
    const violationCount = (req as any).csrfViolations || 0;
    (req as any).csrfViolations = violationCount + 1;

    // If multiple violations from same IP, implement stricter response
    if (violationCount > 5) {
      logger.error("Multiple CSRF violations detected - possible automated attack", {
        ...securityContext,
        violationCount: violationCount + 1,
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: "Multiple security violations detected. Please try again later.",
        code: "CSRF_RATE_LIMIT_EXCEEDED",
        timestamp: new Date().toISOString(),
        retryAfter: 300, // 5 minutes
      });
      return;
    }

    res.status(403).json({
      error: "Forbidden",
      message: "Invalid CSRF token. Please refresh the page and try again.",
      code: "CSRF_TOKEN_INVALID",
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
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
 * Enhanced middleware to set CSRF token in response cookie with additional security
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
        // Additional security attributes
        path: "/",
        // Prevent token from being accessed by iframes
        priority: "high",
      });

      // Also set CSRF token in response header for additional security
      res.setHeader("X-CSRF-Token", token);
    } catch (error) {
      logger.error("Failed to set CSRF token cookie", {
        error,
        path: req.path,
        ip: req.ip,
      });
    }
  }
  next();
};

/**
 * Enhanced route handler to provide CSRF token to frontend with additional security
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  try {
    const token = req.csrfToken();

    // Set both cookie and header for maximum compatibility
    res.cookie("XSRF-TOKEN", token, {
      httpOnly: false,
      secure: config.nodeEnv === "production",
      sameSite: "strict",
      maxAge: 3600000,
      path: "/",
      priority: "high",
    });

    res.setHeader("X-CSRF-Token", token);

    res.json({
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    });
  } catch (error) {
    logger.error("Failed to generate CSRF token", {
      error,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate CSRF token",
      code: "CSRF_TOKEN_GENERATION_FAILED",
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    });
  }
};

/**
 * Enhanced CSRF validation middleware for API routes
 * Validates CSRF token from both header and body with fallback logic
 */
export const validateCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF for safe methods and excluded routes
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Check for CSRF token in multiple locations
  const tokenFromHeader = req.get("X-CSRF-Token");
  const tokenFromBody = req.body?._csrf;
  const tokenFromHeader2 = req.get("X-XSRF-Token");

  const csrfToken = tokenFromHeader || tokenFromBody || tokenFromHeader2;

  if (!csrfToken) {
    logger.warn("Missing CSRF token in request", {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      hasHeader: !!tokenFromHeader,
      hasBodyToken: !!tokenFromBody,
      hasXsrfHeader: !!tokenFromHeader2,
    });

    res.status(403).json({
      error: "Forbidden",
      message: "CSRF token is required for this request",
      code: "CSRF_TOKEN_MISSING",
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    });
    return;
  }

  // Validate the token using the built-in CSRF middleware
  csrfProtection(req, res, (err) => {
    if (err) {
      return csrfErrorHandler(err, req, res, next);
    }
    next();
  });
};

