import { Router } from "express";
import { scheduleController } from "@/controllers/schedule";
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

// GET /api/schedules/upcoming - Get upcoming schedules for dashboard
router.get(
  "/upcoming",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  handleValidationErrors,
  authenticateToken,
  scheduleController.getUpcoming.bind(scheduleController)
);

/**
 * All schedule routes require authentication and valid OAuth
 */
router.use(authenticateToken);
router.use(requireValidOAuth);

/**
 * Schedule CRUD Routes
 */

// GET /api/schedule - Get schedules with filtering and pagination
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("type")
      .optional()
      .isIn(["all", "upcoming", "past"])
      .withMessage("Type must be one of: all, upcoming, past"),
    query("location")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Location must be between 1 and 255 characters"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("dateFrom must be a valid ISO 8601 date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("dateTo must be a valid ISO 8601 date"),
    query("sceneType")
      .optional()
      .isIn(["all", "INT", "EXT"])
      .withMessage("Scene type must be one of: all, INT, EXT"),
  ],
  handleValidationErrors,
  scheduleController.getSchedules.bind(scheduleController)
);

// GET /api/schedule/statistics - Get schedule statistics
router.get(
  "/statistics",
  scheduleController.getStatistics.bind(scheduleController)
);

// GET /api/schedule/weather/warnings - Get weather warnings
router.get(
  "/weather/warnings",
  scheduleController.getWeatherWarnings.bind(scheduleController)
);

// GET /api/schedule/weather/forecast - Get weather forecast for location and date
router.get(
  "/weather/forecast",
  [
    query("location")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Location must be between 1 and 255 characters"),
    query("date").isISO8601().withMessage("Date must be a valid ISO 8601 date"),
  ],
  handleValidationErrors,
  scheduleController.getWeatherForecast.bind(scheduleController)
);

// POST /api/schedule - Create new schedule
router.post(
  "/",
  [
    body("shootingDate")
      .isISO8601()
      .withMessage("Shooting date must be a valid ISO 8601 date"),
    body("callTime")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Call time must be in HH:MM format"),
    body("location")
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Location must be between 1 and 255 characters"),
    body("baseLocation")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Base location must be max 255 characters"),
    body("sceneType")
      .optional()
      .isIn(["INT", "EXT"])
      .withMessage("Scene type must be either INT or EXT"),
    body("scenes").optional().isArray().withMessage("Scenes must be an array"),
    body("safetyNotes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Safety notes must be max 1000 characters"),
    body("equipment")
      .optional()
      .isArray()
      .withMessage("Equipment must be an array"),
    body("contacts")
      .optional()
      .isArray()
      .withMessage("Contacts must be an array"),
    body("notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be max 1000 characters"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      // TODO: Implement schedule creation in controller
      const newSchedule = {
        id: `schedule_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        data: newSchedule,
        message: "Schedule created successfully"
      });
    } catch (error) {
      console.error("Error creating schedule:", error);
      res.status(500).json({
        error: "Failed to create schedule",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// GET /api/schedule/:scheduleId - Get schedule by ID
router.get(
  "/:scheduleId",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.getScheduleById.bind(scheduleController)
);

// PUT /api/schedule/:scheduleId - Update schedule
router.put(
  "/:scheduleId",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
    body("shootingDate")
      .optional()
      .isISO8601()
      .withMessage("Shooting date must be a valid ISO 8601 date"),
    body("callTime")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Call time must be in HH:MM format"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Location must be between 1 and 255 characters"),
    body("baseLocation")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Base location must be max 255 characters"),
    body("sceneType")
      .optional()
      .isIn(["INT", "EXT"])
      .withMessage("Scene type must be either INT or EXT"),
    body("scenes").optional().isArray().withMessage("Scenes must be an array"),
    body("safetyNotes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Safety notes must be max 1000 characters"),
    body("equipment")
      .optional()
      .isArray()
      .withMessage("Equipment must be an array"),
    body("contacts")
      .optional()
      .isArray()
      .withMessage("Contacts must be an array"),
    body("notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be max 1000 characters"),
  ],
  handleValidationErrors,
  scheduleController.updateSchedule.bind(scheduleController)
);

// DELETE /api/schedule/:scheduleId - Delete schedule
router.delete(
  "/:scheduleId",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.deleteSchedule.bind(scheduleController)
);

/**
 * Route Plan Routes
 */

// GET /api/schedule/:scheduleId/route - Get route plan for schedule
router.get(
  "/:scheduleId/route",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.getRoutePlan.bind(scheduleController)
);

// PUT /api/schedule/:scheduleId/route - Update route plan for schedule
router.put(
  "/:scheduleId/route",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
    body("wakeUpTime")
      .optional()
      .isISO8601()
      .withMessage("Wake up time must be a valid ISO 8601 date"),
    body("departureTime")
      .optional()
      .isISO8601()
      .withMessage("Departure time must be a valid ISO 8601 date"),
    body("arrivalTime")
      .optional()
      .isISO8601()
      .withMessage("Arrival time must be a valid ISO 8601 date"),
    body("totalTravelMinutes")
      .optional()
      .isInt({ min: 0, max: 1440 })
      .withMessage("Total travel minutes must be between 0 and 1440"),
    body("routeSegments")
      .optional()
      .isArray()
      .withMessage("Route segments must be an array"),
    body("buffers")
      .optional()
      .isObject()
      .withMessage("Buffers must be an object"),
  ],
  handleValidationErrors,
  scheduleController.updateRoutePlan.bind(scheduleController)
);

// POST /api/schedule/:scheduleId/route/recalculate - Trigger route recalculation
router.post(
  "/:scheduleId/route/recalculate",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.recalculateRoute.bind(scheduleController)
);

/**
 * Weather Data Routes
 */

// GET /api/schedule/:scheduleId/weather - Get weather data for schedule
router.get(
  "/:scheduleId/weather",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.getWeatherData.bind(scheduleController)
);

// POST /api/schedule/:scheduleId/weather/update - Trigger weather update
router.post(
  "/:scheduleId/weather/update",
  [
    param("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  scheduleController.updateWeatherData.bind(scheduleController)
);

/**
 * Health check route for schedule service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "schedule-management",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as scheduleRoutes };
