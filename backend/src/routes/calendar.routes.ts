import { Router } from "express";
import { calendarController } from "@/controllers/calendar.controller";
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
 * All calendar routes require authentication and valid OAuth
 */
router.use(authenticateToken);
router.use(requireValidOAuth);

/**
 * Calendar Event Routes
 */

// GET /api/calendar/events - Get calendar events
router.get(
  "/events",
  [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date"),
    query("maxResults")
      .optional()
      .isInt({ min: 1, max: 250 })
      .withMessage("Max results must be between 1 and 250"),
  ],
  handleValidationErrors,
  calendarController.getCalendarEvents.bind(calendarController)
);

// POST /api/calendar/events - Create calendar event for schedule
router.post(
  "/events",
  [
    body("scheduleId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  calendarController.createCalendarEvent.bind(calendarController)
);

// PUT /api/calendar/events/:eventId - Update calendar event
router.put(
  "/events/:eventId",
  [
    param("eventId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Event ID must be a non-empty string"),
    body("title")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Title must be between 1 and 255 characters"),
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 8192 })
      .withMessage("Description must be max 8192 characters"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be max 255 characters"),
    body("startTime")
      .optional()
      .isISO8601()
      .withMessage("Start time must be a valid ISO 8601 date"),
    body("endTime")
      .optional()
      .isISO8601()
      .withMessage("End time must be a valid ISO 8601 date"),
  ],
  handleValidationErrors,
  calendarController.updateCalendarEvent.bind(calendarController)
);

// DELETE /api/calendar/events/:eventId - Delete calendar event
router.delete(
  "/events/:eventId",
  [
    param("eventId")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Event ID must be a non-empty string"),
  ],
  handleValidationErrors,
  calendarController.deleteCalendarEvent.bind(calendarController)
);

/**
 * Calendar Sync Routes
 */

// GET /api/calendar/sync/status - Get calendar sync status
router.get(
  "/sync/status",
  calendarController.getSyncStatus.bind(calendarController)
);

// POST /api/calendar/sync - Sync calendar events for schedules
router.post(
  "/sync",
  [
    body("scheduleIds")
      .isArray({ min: 1 })
      .withMessage("Schedule IDs must be a non-empty array"),
    body("scheduleIds.*")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Each schedule ID must be a non-empty string"),
  ],
  handleValidationErrors,
  calendarController.syncCalendarEvents.bind(calendarController)
);

/**
 * Calendar Settings Routes
 */

// GET /api/calendar/settings - Get calendar settings
router.get(
  "/settings",
  calendarController.getCalendarSettings.bind(calendarController)
);

/**
 * Health check route for calendar service
 */
router.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "calendar-management",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { router as calendarRoutes };
