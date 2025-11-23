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
import { HealthController } from "../controllers/health.controller";
import { MonitoringMiddleware } from "../middleware/monitoring.middleware";

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

// Performance metrics routes - /api/performance/*
router.use("/performance", performanceRoutes);

// Monitoring and health routes - /api/monitoring/*
// Note: These will be initialized in the main app with proper dependencies
function initializeMonitoringRoutesImpl(
  healthController: HealthController,
  monitoringMiddleware: MonitoringMiddleware
): void {
  const monitoringRoutes = createMonitoringRoutes(
    healthController,
    monitoringMiddleware
  );
  router.use("/monitoring", monitoringRoutes);
}

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

export {
  router as apiRoutes,
  initializeMonitoringRoutesImpl as initializeMonitoringRoutes,
};
