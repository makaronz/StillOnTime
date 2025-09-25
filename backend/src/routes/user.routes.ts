import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { authenticateToken } from "@/middleware/auth.middleware";
import { body, validationResult } from "express-validator";
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
 * All user routes require authentication
 */
router.use(authenticateToken);

/**
 * User Profile Routes
 */

// GET /api/user/profile - Get user profile with statistics
router.get("/profile", userController.getProfile.bind(userController));

// PUT /api/user/profile - Update user profile
router.put(
  "/profile",
  [
    body("name")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be a string between 1 and 100 characters"),
  ],
  handleValidationErrors,
  userController.updateProfile.bind(userController)
);

/**
 * User Configuration Routes
 */

// GET /api/user/config - Get user configuration
router.get("/config", userController.getConfiguration.bind(userController));

// PUT /api/user/config - Update full user configuration
router.put(
  "/config",
  [
    body("homeAddress")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Home address must be between 5 and 255 characters"),
    body("panavisionAddress")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Panavision address must be between 5 and 255 characters"),
    body("bufferCarChange")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Car change buffer must be between 0 and 120 minutes"),
    body("bufferParking")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Parking buffer must be between 0 and 120 minutes"),
    body("bufferEntry")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Entry buffer must be between 0 and 120 minutes"),
    body("bufferTraffic")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Traffic buffer must be between 0 and 120 minutes"),
    body("bufferMorningRoutine")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Morning routine buffer must be between 0 and 120 minutes"),
    body("notificationEmail")
      .optional()
      .isBoolean()
      .withMessage("Email notification preference must be a boolean"),
    body("notificationSMS")
      .optional()
      .isBoolean()
      .withMessage("SMS notification preference must be a boolean"),
    body("notificationPush")
      .optional()
      .isBoolean()
      .withMessage("Push notification preference must be a boolean"),
  ],
  handleValidationErrors,
  userController.updateConfiguration.bind(userController)
);

// PUT /api/user/config/addresses - Update user addresses
router.put(
  "/config/addresses",
  [
    body("homeAddress")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Home address must be between 5 and 255 characters"),
    body("panavisionAddress")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Panavision address must be between 5 and 255 characters"),
  ],
  handleValidationErrors,
  userController.updateAddresses.bind(userController)
);

// PUT /api/user/config/buffers - Update time buffers
router.put(
  "/config/buffers",
  [
    body("bufferCarChange")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Car change buffer must be between 0 and 120 minutes"),
    body("bufferParking")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Parking buffer must be between 0 and 120 minutes"),
    body("bufferEntry")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Entry buffer must be between 0 and 120 minutes"),
    body("bufferTraffic")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Traffic buffer must be between 0 and 120 minutes"),
    body("bufferMorningRoutine")
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage("Morning routine buffer must be between 0 and 120 minutes"),
  ],
  handleValidationErrors,
  userController.updateBuffers.bind(userController)
);

// PUT /api/user/config/notifications - Update notification preferences
router.put(
  "/config/notifications",
  [
    body("notificationEmail")
      .optional()
      .isBoolean()
      .withMessage("Email notification preference must be a boolean"),
    body("notificationSMS")
      .optional()
      .isBoolean()
      .withMessage("SMS notification preference must be a boolean"),
    body("notificationPush")
      .optional()
      .isBoolean()
      .withMessage("Push notification preference must be a boolean"),
  ],
  handleValidationErrors,
  userController.updateNotificationPreferences.bind(userController)
);

// POST /api/user/config/reset - Reset configuration to defaults
router.post(
  "/config/reset",
  userController.resetConfiguration.bind(userController)
);

/**
 * Account Management Routes
 */

// DELETE /api/user/account - Delete user account
router.delete(
  "/account",
  [
    body("confirmEmail")
      .isEmail()
      .withMessage("Valid email confirmation is required"),
  ],
  handleValidationErrors,
  userController.deleteAccount.bind(userController)
);

/**
 * Health check route for user service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "user-management",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as userRoutes };
