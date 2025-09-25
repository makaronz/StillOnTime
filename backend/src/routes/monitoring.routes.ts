/**
 * Monitoring and health check routes
 * Provides endpoints for system monitoring, alerting, and health checks
 */

import { Router } from "express";
import { HealthController } from "../controllers/health.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { MonitoringMiddleware } from "../middleware/monitoring.middleware";

export function createMonitoringRoutes(
  healthController: HealthController,
  monitoringMiddleware: MonitoringMiddleware
): Router {
  const router = Router();

  // Public health check endpoints (no auth required)
  router.get("/health", healthController.getHealth.bind(healthController));
  router.get(
    "/health/detailed",
    healthController.getDetailedHealth.bind(healthController)
  );
  router.get(
    "/health/readiness",
    healthController.getReadiness.bind(healthController)
  );
  router.get(
    "/health/liveness",
    healthController.getLiveness.bind(healthController)
  );

  // Protected monitoring endpoints (require authentication)
  router.use(authMiddleware);

  // Monitoring dashboard and metrics
  router.get(
    "/dashboard",
    monitoringMiddleware.trackOperation("monitoring_dashboard"),
    healthController.getMonitoringDashboard.bind(healthController)
  );

  router.get(
    "/performance/history",
    monitoringMiddleware.trackOperation("performance_history"),
    healthController.getPerformanceHistory.bind(healthController)
  );

  router.get(
    "/services/:serviceName/history",
    monitoringMiddleware.trackOperation("service_health_history"),
    healthController.getServiceHealthHistory.bind(healthController)
  );

  // APM metrics and performance monitoring
  router.get(
    "/apm/history",
    monitoringMiddleware.trackOperation("apm_metrics_history"),
    healthController.getAPMMetricsHistory.bind(healthController)
  );

  // Custom metrics management
  router.get(
    "/metrics/custom",
    monitoringMiddleware.trackOperation("custom_metrics_get"),
    healthController.getCustomMetrics.bind(healthController)
  );

  router.post(
    "/metrics/custom",
    monitoringMiddleware.trackOperation("custom_metrics_record"),
    healthController.recordCustomMetric.bind(healthController)
  );

  // Error metrics and statistics
  router.get(
    "/errors/metrics",
    monitoringMiddleware.trackOperation("error_metrics"),
    healthController.getErrorMetrics.bind(healthController)
  );

  // Circuit breaker management
  router.get(
    "/circuit-breakers",
    monitoringMiddleware.trackOperation("circuit_breaker_status"),
    healthController.getCircuitBreakerStatus.bind(healthController)
  );

  router.post(
    "/circuit-breakers/reset",
    monitoringMiddleware.trackOperation("circuit_breaker_reset"),
    healthController.resetCircuitBreakers.bind(healthController)
  );

  // Alerting rules management
  router.get(
    "/alerts/rules",
    monitoringMiddleware.trackOperation("alerting_rules_get"),
    healthController.getAlertingRules.bind(healthController)
  );

  router.put(
    "/alerts/rules/:ruleId",
    monitoringMiddleware.trackOperation("alerting_rules_update"),
    healthController.updateAlertingRule.bind(healthController)
  );

  router.post(
    "/alerts/:alertId/resolve",
    monitoringMiddleware.trackOperation("alert_resolve"),
    healthController.resolveAlert.bind(healthController)
  );

  // Development/testing endpoints (only in non-production)
  if (process.env.NODE_ENV !== "production") {
    router.post(
      "/test/alert",
      monitoringMiddleware.trackOperation("test_alert"),
      healthController.triggerTestAlert.bind(healthController)
    );
  }

  return router;
}
