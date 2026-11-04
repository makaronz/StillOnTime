import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { emailRoutes } from "./email.routes";
import { scheduleRoutes } from "./schedule.routes";
import { systemRoutes } from "./system.routes";
import { calendarRoutes } from "./calendar.routes";
import { routePlanningRoutes } from "./route-planning.routes";
import smsRoutes from "./sms.routes";
import { createMonitoringRoutes } from "./monitoring.routes";
import enhancedRoutes from "./enhanced.routes";
import { analyticsRoutes } from "./analytics.routes";
import { oauthSettingsRoutes } from "./oauth-settings.routes";
import { systemConfigRoutes } from "./system-config.routes";
import codenetRoutes from "./codenet.routes";
import { notificationsRoutes } from "./notifications.routes";
import { performanceRoutes } from "./performance.routes";

const router = Router();

/**
 * API Routes Configuration
 * All routes are prefixed with /api
 */

// Authentication routes - /api/auth/*
router.use("/auth", authRoutes);

// User management routes - /api/user/*
router.use("/user", userRoutes);

// Email processing routes - /api/email/* and /api/emails/*
router.use("/email", emailRoutes);
router.use("/emails", emailRoutes);

// Schedule management routes - /api/schedule/* and /api/schedules/*
router.use("/schedule", scheduleRoutes);
router.use("/schedules", scheduleRoutes);

// System status routes - /api/system/*
router.use("/system", systemRoutes);

// Calendar management routes - /api/calendar/*
router.use("/calendar", calendarRoutes);

// Route planning routes - /api/route-planning/*
router.use("/route-planning", routePlanningRoutes);

// SMS notification routes - /api/sms/*
router.use("/sms", smsRoutes);

// Enhanced services routes - /api/enhanced/*
router.use("/enhanced", enhancedRoutes);

// Analytics routes - /api/analytics/*
router.use("/analytics", analyticsRoutes);

// OAuth settings routes - /api/oauth/*
router.use("/oauth", oauthSettingsRoutes);

// System configuration routes - /api/config/*
router.use("/config", systemConfigRoutes);

// CodeNet RAG routes - /api/codenet/*
router.use("/codenet", codenetRoutes);

// Notifications routes - /api/notifications/*
router.use("/notifications", notificationsRoutes);

// Performance routes - /api/performance/*
router.use("/performance", performanceRoutes);

// Monitoring and health routes - /api/monitoring/*
// Reuses the controller/service instances built in health.routes.ts so both
// /health/* and /api/monitoring/* report on the same MonitoringService.
// Built on first request rather than at import time: health.routes.ts and the
// monitoring middleware construct services, and loading them eagerly here
// changes module-load order for everything that imports this file (including
// tests that jest.mock those modules after tests/setup.ts has loaded routes).
let monitoringRouter: Router | undefined;
router.use("/monitoring", (req, res, next): void => {
  if (!monitoringRouter) {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { healthController, monitoringService } = require("./health.routes");
    const {
      createMonitoringMiddleware,
    } = require("../middleware/monitoring.middleware");
    /* eslint-enable @typescript-eslint/no-var-requires */
    monitoringRouter = createMonitoringRoutes(
      healthController,
      createMonitoringMiddleware(monitoringService)
    );
  }
  monitoringRouter!(req, res, next);
});

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
      email: "/api/email, /api/emails",
      schedule: "/api/schedule, /api/schedules",
      system: "/api/system",
      calendar: "/api/calendar",
      routePlanning: "/api/route-planning",
      sms: "/api/sms",
      enhanced: "/api/enhanced",
      codenet: "/api/codenet",
      notifications: "/api/notifications",
      performance: "/api/performance",
      monitoring: "/api/monitoring",
    },
  });
});

export { router as apiRoutes };
