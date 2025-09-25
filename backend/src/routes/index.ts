import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { emailRoutes } from "./email.routes";
import { scheduleRoutes } from "./schedule.routes";
import { calendarRoutes } from "./calendar.routes";
import { routePlanningRoutes } from "./route-planning.routes";

const router = Router();

/**
 * API Routes Configuration
 * All routes are prefixed with /api
 */

// Authentication routes - /api/auth/*
router.use("/auth", authRoutes);

// User management routes - /api/user/*
router.use("/user", userRoutes);

// Email processing routes - /api/email/*
router.use("/email", emailRoutes);

// Schedule management routes - /api/schedule/*
router.use("/schedule", scheduleRoutes);

// Calendar management routes - /api/calendar/*
router.use("/calendar", calendarRoutes);

// Route planning routes - /api/route-planning/*
router.use("/route-planning", routePlanningRoutes);

// API health check
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "api",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    routes: {
      auth: "/api/auth",
      user: "/api/user",
      email: "/api/email",
      schedule: "/api/schedule",
      calendar: "/api/calendar",
      routePlanning: "/api/route-planning",
    },
  });
});

export { router as apiRoutes };
