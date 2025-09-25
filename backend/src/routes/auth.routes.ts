import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import {
  authenticateToken,
  optionalAuth,
  authRateLimit,
  authErrorHandler,
} from "@/middleware/auth.middleware";
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
 * Public authentication routes (no authentication required)
 */

// GET /auth/login - Initiate OAuth flow
router.get(
  "/login",
  authRateLimit(
    securityConfig.rateLimiting.auth.login.max,
    securityConfig.rateLimiting.auth.login.windowMs
  ),
  [
    query("state")
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage("State parameter must be a string with max 255 characters"),
  ],
  handleValidationErrors,
  authController.login.bind(authController)
);

// POST /auth/callback - Handle OAuth callback
router.post(
  "/callback",
  authRateLimit(
    securityConfig.rateLimiting.auth.callback.max,
    securityConfig.rateLimiting.auth.callback.windowMs
  ),
  [
    body("code")
      .optional()
      .isString()
      .notEmpty()
      .withMessage("Authorization code must be a non-empty string"),
    body("state")
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage("State parameter must be a string with max 255 characters"),
    body("error")
      .optional()
      .isString()
      .withMessage("Error parameter must be a string"),
  ],
  handleValidationErrors,
  authController.callback.bind(authController)
);

/**
 * Protected authentication routes (require valid JWT)
 */

// POST /auth/refresh - Refresh JWT token
router.post(
  "/refresh",
  authRateLimit(
    securityConfig.rateLimiting.auth.refresh.max,
    securityConfig.rateLimiting.auth.refresh.windowMs
  ),
  authenticateToken,
  authController.refresh.bind(authController)
);

// POST /auth/logout - Logout and revoke tokens
router.post(
  "/logout",
  authRateLimit(
    securityConfig.rateLimiting.auth.logout.max,
    securityConfig.rateLimiting.auth.logout.windowMs
  ),
  authenticateToken,
  authController.logout.bind(authController)
);

// POST /auth/reauth - Force OAuth re-authentication
router.post(
  "/reauth",
  authRateLimit(
    securityConfig.rateLimiting.auth.reauth.max,
    securityConfig.rateLimiting.auth.reauth.windowMs
  ),
  authenticateToken,
  authController.reauth.bind(authController)
);

/**
 * User information routes
 */

// GET /auth/status - Get authentication status (optional auth)
router.get("/status", optionalAuth, authController.status.bind(authController));

// GET /auth/profile - Get user profile (requires auth)
router.get(
  "/profile",
  authenticateToken,
  authController.profile.bind(authController)
);

/**
 * Health check route for authentication system
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "authentication",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * Apply authentication error handler to all routes
 */
router.use(authErrorHandler);

export { router as authRoutes };
