import { Router } from "express";
import { secureAuthController } from "@/controllers/secure-auth.controller";
import {
  secureAuth,
  optionalSecureAuth,
  secureAuthWithCSRF,
  validateRefreshToken,
  ensureAuthConsistency,
} from "@/middleware/secure-auth.middleware";
import {
  validateCsrfToken,
  csrfErrorHandler,
  getCsrfToken,
} from "@/middleware/csrf.middleware";
import { body, query, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { securityConfig } from "@/config/security";

const router = Router();

/**
 * Validation middleware for request validation
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "Bad Request",
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      timestamp: new Date().toISOString(),
      path: req.path,
      details: errors.array(),
    });
    return;
  }
  next();
};

/**
 * Apply authentication consistency check to all routes
 */
router.use(ensureAuthConsistency);

/**
 * Public authentication routes (no authentication required)
 */

// GET /auth/secure/login - Initiate OAuth flow with secure cookies
router.get(
  "/login",
  secureAuthController.login.bind(secureAuthController)
);

// GET /auth/secure/csrf-token - Get CSRF token
router.get(
  "/csrf-token",
  secureAuthController.getCSRFToken.bind(secureAuthController)
);

// POST /auth/secure/callback - Handle OAuth callback with secure cookies
router.post(
  "/callback",
  [
    body("code")
      .notEmpty()
      .withMessage("Authorization code is required"),
    body("state")
      .notEmpty()
      .withMessage("State parameter is required"),
    body("error")
      .optional()
      .isString()
      .withMessage("Error parameter must be a string"),
  ],
  handleValidationErrors,
  secureAuthController.callback.bind(secureAuthController)
);

/**
 * Protected authentication routes (require valid JWT from secure cookies)
 */

// POST /auth/secure/refresh - Refresh JWT token
router.post(
  "/refresh",
  validateRefreshToken,
  secureAuthController.refresh.bind(secureAuthController)
);

// POST /auth/secure/logout - Logout and revoke tokens
router.post(
  "/logout",
  secureAuth,
  validateCsrfToken,
  secureAuthController.logout.bind(secureAuthController)
);

// POST /auth/secure/reauth - Force OAuth re-authentication
router.post(
  "/reauth",
  secureAuth,
  secureAuthController.reauth.bind(secureAuthController)
);

/**
 * User information routes with secure authentication
 */

// GET /auth/secure/status - Get authentication status (optional auth)
router.get(
  "/status",
  optionalSecureAuth,
  secureAuthController.status.bind(secureAuthController)
);

// GET /auth/secure/profile - Get user profile (requires auth)
router.get(
  "/profile",
  secureAuth,
  secureAuthController.profile.bind(secureAuthController)
);

/**
 * Enhanced security routes with CSRF protection
 */

// POST /auth/secure/csrf-protected - Example of CSRF-protected route
router.post(
  "/csrf-protected",
  secureAuthWithCSRF,
  (req: Request, res: Response): void => {
    res.json({
      success: true,
      message: "CSRF-protected route accessed successfully",
      user: (req as any).user,
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * Health check route for secure authentication system
 */
router.get("/health", (req: Request, res: Response): void => {
  const secureCookies = Object.keys(req.cookies || {}).filter(key =>
    key.startsWith("stillontime_") || key === "auth_status"
  );

  res.json({
    status: "healthy",
    service: "secure-authentication",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    security: {
      secureCookiesPresent: secureCookies.length > 0,
      secureCookieTypes: secureCookies,
      csrfProtection: true,
      httpOnlyCookies: true,
    },
  });
});

/**
 * Apply CSRF error handler to all routes
 */
router.use(csrfErrorHandler);

export { router as secureAuthRoutes };