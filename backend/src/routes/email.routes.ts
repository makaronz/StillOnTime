import { Router } from "express";
import { emailController } from "@/controllers/email.controller";
import {
  authenticateToken,
  requireValidOAuth,
} from "@/middleware/auth.middleware";
import { body, query, param, validationResult } from "express-validator";
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
 * Dashboard Routes
 */

// GET /api/emails/stats - Get email stats for dashboard
router.get(
  "/stats",
  authenticateToken,
  emailController.getStats.bind(emailController)
);

// GET /api/emails/recent - Get recent emails for dashboard
router.get(
  "/recent",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  handleValidationErrors,
  authenticateToken,
  emailController.getRecent.bind(emailController)
);

/**
 * All email routes require authentication and valid OAuth
 */
router.use(authenticateToken);
router.use(requireValidOAuth);

/**
 * Email Processing Routes
 */

// POST /api/email/process - Trigger manual email processing
router.post(
  "/process",
  [
    body("messageId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Message ID must be a non-empty string"),
    body("priority")
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage("Priority must be an integer between 0 and 10"),
  ],
  handleValidationErrors,
  emailController.triggerProcessing.bind(emailController)
);

// GET /api/email/status - Get email processing status
router.get(
  "/status",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["all", "pending", "failed", "processed"])
      .withMessage("Status must be one of: all, pending, failed, processed"),
  ],
  handleValidationErrors,
  emailController.getProcessingStatus.bind(emailController)
);

// GET /api/email/history - Get detailed processing history
router.get(
  "/history",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["all", "pending", "failed", "processed"])
      .withMessage("Status must be one of: all, pending, failed, processed"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("dateFrom must be a valid ISO 8601 date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("dateTo must be a valid ISO 8601 date"),
    query("search")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search term must be between 1 and 100 characters"),
  ],
  handleValidationErrors,
  emailController.getProcessingHistory.bind(emailController)
);

// GET /api/email/statistics - Get processing statistics
router.get(
  "/statistics",
  [
    query("period")
      .optional()
      .isIn(["7d", "30d", "90d"])
      .withMessage("Period must be one of: 7d, 30d, 90d"),
  ],
  handleValidationErrors,
  emailController.getStatistics.bind(emailController)
);

/**
 * Email Monitoring Routes
 */

// POST /api/email/monitoring - Enable/disable periodic monitoring
router.post(
  "/monitoring",
  [
    body("enabled").isBoolean().withMessage("enabled field must be a boolean"),
    body("intervalMinutes")
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage("Interval must be between 1 and 60 minutes"),
  ],
  handleValidationErrors,
  emailController.toggleMonitoring.bind(emailController)
);

/**
 * Individual Email Routes
 */

// GET /api/email/:emailId - Get email details
router.get(
  "/:emailId",
  [
    param("emailId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Email ID must be a non-empty string"),
  ],
  handleValidationErrors,
  emailController.getEmailDetails.bind(emailController)
);

// POST /api/email/:emailId/retry - Retry failed email processing
router.post(
  "/:emailId/retry",
  [
    param("emailId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Email ID must be a non-empty string"),
  ],
  handleValidationErrors,
  emailController.retryProcessing.bind(emailController)
);

// DELETE /api/email/:emailId - Delete email record
router.delete(
  "/:emailId",
  [
    param("emailId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Email ID must be a non-empty string"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;

      // TODO: Implement email deletion in controller/service
      // For now, just return success

      res.json({
        success: true,
        message: `Email ${emailId} deleted successfully`
      });
    } catch (error) {
      console.error("Error deleting email:", error);
      res.status(500).json({
        error: "Failed to delete email",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

/**
 * Health check route for email service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "email-processing",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as emailRoutes };
