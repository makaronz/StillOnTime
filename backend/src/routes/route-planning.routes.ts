import { Router } from "express";
import { RoutePlanningController } from "@/controllers/route-planning.controller";
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
 * All route planning routes require authentication and valid OAuth
 */
router.use(authenticateToken);
router.use(requireValidOAuth);

// Create route planning controller instance
const routePlanningController = new RoutePlanningController();

/**
 * Route Calculation Routes
 */

// POST /api/route-planning/calculate/:scheduleId - Calculate route plan for schedule
router.post(
  "/calculate/:scheduleId",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  routePlanningController.calculateRoutePlan.bind(routePlanningController)
);

// POST /api/route-planning/alternative-routes - Get alternative routes
router.post(
  "/alternative-routes",
  [
    body("origin")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Origin must be between 1 and 255 characters"),
    body("destination")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Destination must be between 1 and 255 characters"),
    body("departureTime")
      .optional()
      .isISO8601()
      .withMessage("Departure time must be a valid ISO 8601 date"),
  ],
  handleValidationErrors,
  routePlanningController.getAlternativeRoutes.bind(routePlanningController)
);

// GET /api/route-planning/recommendations/:location - Get route recommendations for location
router.get(
  "/recommendations/:location",
  [
    param("location")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Location must be between 1 and 255 characters"),
  ],
  handleValidationErrors,
  routePlanningController.getRouteRecommendations.bind(routePlanningController)
);

/**
 * Time Calculation Routes
 */

// POST /api/route-planning/time-schedule - Calculate time schedule with recommendations
router.post(
  "/time-schedule",
  [
    body("callTime")
      .isISO8601()
      .withMessage("Call time must be a valid ISO 8601 date"),
    body("travelTimeMinutes")
      .isInt({ min: 0, max: 1440 })
      .withMessage("Travel time must be between 0 and 1440 minutes"),
    body("buffers").isObject().withMessage("Buffers must be an object"),
    body("buffers.carChange")
      .isInt({ min: 0, max: 120 })
      .withMessage("Car change buffer must be between 0 and 120 minutes"),
    body("buffers.parking")
      .isInt({ min: 0, max: 60 })
      .withMessage("Parking buffer must be between 0 and 60 minutes"),
    body("buffers.entry")
      .isInt({ min: 0, max: 60 })
      .withMessage("Entry buffer must be between 0 and 60 minutes"),
    body("buffers.traffic")
      .isInt({ min: 0, max: 120 })
      .withMessage("Traffic buffer must be between 0 and 120 minutes"),
    body("buffers.morningRoutine")
      .isInt({ min: 0, max: 180 })
      .withMessage("Morning routine buffer must be between 0 and 180 minutes"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be max 255 characters"),
    body("sceneType")
      .optional()
      .isIn(["INT", "EXT"])
      .withMessage("Scene type must be either INT or EXT"),
    body("weatherConditions")
      .optional()
      .isObject()
      .withMessage("Weather conditions must be an object"),
  ],
  handleValidationErrors,
  routePlanningController.calculateTimeSchedule.bind(routePlanningController)
);

// POST /api/route-planning/buffer-recommendations - Get optimized buffer recommendations
router.post(
  "/buffer-recommendations",
  [
    body("travelTimeMinutes")
      .isInt({ min: 0, max: 1440 })
      .withMessage("Travel time must be between 0 and 1440 minutes"),
    body("sceneType")
      .optional()
      .isIn(["INT", "EXT"])
      .withMessage("Scene type must be either INT or EXT"),
    body("weatherConditions")
      .optional()
      .isObject()
      .withMessage("Weather conditions must be an object"),
    body("timeOfDay")
      .optional()
      .isString()
      .trim()
      .withMessage("Time of day must be a string"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be max 255 characters"),
  ],
  handleValidationErrors,
  routePlanningController.getBufferRecommendations.bind(routePlanningController)
);

/**
 * Address Validation Routes
 */

// POST /api/route-planning/validate-address - Validate address using Google Maps
router.post(
  "/validate-address",
  [
    body("address")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Address must be between 1 and 255 characters"),
  ],
  handleValidationErrors,
  routePlanningController.validateAddress.bind(routePlanningController)
);

/**
 * Health check route for route planning service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "route-planning",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as routePlanningRoutes };
