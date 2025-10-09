import { Router } from "express";
import { systemController } from "@/controllers/system.controller";
import { authenticateToken } from "@/middleware/auth.middleware";
import { param, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

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
 * All system routes require authentication
 */
router.use(authenticateToken);

/**
 * System Status Routes
 */

// GET /api/system/status - Get system status
router.get(
  "/status",
  systemController.getStatus.bind(systemController)
);

// GET /api/system/connections - Get API connection status
router.get(
  "/connections",
  systemController.getConnections.bind(systemController)
);

// POST /api/system/test-connection/:service - Test API connection
router.post(
  "/test-connection/:service",
  [
    param("service")
      .isString()
      .trim()
      .isIn(["gmail", "calendar", "maps", "weather"])
      .withMessage("Service must be one of: gmail, calendar, maps, weather"),
  ],
  handleValidationErrors,
  systemController.testConnection.bind(systemController)
);

/**
 * Health check route for system service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "system-monitoring",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as systemRoutes };
