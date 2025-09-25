/**
 * Tests for HealthController
 * Tests health checks, monitoring endpoints, and APM functionality
 */

import request from "supertest";
import express from "express";
import { HealthController } from "../../src/controllers/health.controller";
import { CacheService } from "../../src/services/cache.service";
import { OAuth2Service } from "../../src/services/oauth2.service";
import { MonitoringService } from "../../src/services/monitoring.service";
import { ErrorHandlerService } from "../../src/services/error-handler.service";

// Mock dependencies
jest.mock("../../src/services/cache.service");
jest.mock("../../src/services/oauth2.service");
jest.mock("../../src/services/monitoring.service");
jest.mock("../../src/services/error-handler.service");
jest.mock("../../src/config/database", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
  },
}));

describe("HealthController", () => {
  let app: express.Application;
  let healthController: HealthController;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockOAuth2Service: jest.Mocked<OAuth2Service>;
  let mockMonitoringService: jest.Mocked<MonitoringService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockOAuth2Service = new OAuth2Service() as jest.Mocked<OAuth2Service>;
    mockMonitoringService = new MonitoringService(
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<MonitoringService>;
    mockErrorHandlerService =
      new ErrorHandlerService() as jest.Mocked<ErrorHandlerService>;

    // Mock cache service methods
    mockCacheService.set = jest.fn().mockResolvedValue(undefined);
    mockCacheService.get = jest.fn().mockResolvedValue("test");
    mockCacheService.delete = jest.fn().mockResolvedValue(undefined);

    // Mock monitoring service methods
    mockMonitoringService.getMonitoringDashboard = jest.fn().mockResolvedValue({
      systemOverview: {
        status: "healthy",
        uptime: 3600,
        totalRequests: 1000,
        errorRate: 1.5,
        averageResponseTime: 150,
      },
      services: [],
      performance: {
        timestamp: new Date(),
        requestCount: 100,
        averageResponseTime: 150,
        errorRate: 1.5,
        throughput: 10,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeConnections: 5,
        queueSize: 0,
      },
      apmMetrics: {
        applicationPerformance: {
          throughput: 100,
          responseTimeP50: 100,
          responseTimeP95: 200,
          responseTimeP99: 300,
          errorRate: 1.5,
          apdex: 0.85,
        },
        businessMetrics: {
          emailsProcessedPerHour: 25,
          scheduleCreationSuccessRate: 95.5,
          calendarEventCreationRate: 98.2,
          notificationDeliveryRate: 92.1,
          oauthTokenRefreshRate: 99.8,
        },
        resourceUtilization: {
          cpuUsagePercent: 45.2,
          memoryUsagePercent: 62.8,
          diskUsagePercent: 35.1,
          networkIOBytes: 1024 * 1024,
          databaseConnectionsActive: 5,
          redisConnectionsActive: 2,
        },
        customMetrics: {},
      },
      alerts: [],
      circuitBreakers: {},
      errorMetrics: {},
      criticalFailures: [],
      customMetrics: [],
    });

    mockMonitoringService.getPerformanceHistory = jest.fn().mockReturnValue([]);
    mockMonitoringService.getAPMMetricsHistory = jest.fn().mockReturnValue([]);
    mockMonitoringService.getServiceHealthHistory = jest
      .fn()
      .mockReturnValue([]);
    mockMonitoringService.getCustomMetrics = jest.fn().mockReturnValue([]);
    mockMonitoringService.getAlertingRules = jest.fn().mockReturnValue([]);
    mockMonitoringService.updateAlertingRule = jest.fn().mockReturnValue(true);
    mockMonitoringService.resolveAlert = jest.fn().mockReturnValue(true);
    mockMonitoringService.recordCustomMetric = jest.fn();

    // Mock error handler service methods
    mockErrorHandlerService.getErrorMetrics = jest.fn().mockReturnValue({});
    mockErrorHandlerService.getCriticalFailures = jest.fn().mockReturnValue([]);

    healthController = new HealthController(
      mockCacheService,
      mockOAuth2Service,
      mockMonitoringService,
      mockErrorHandlerService
    );

    app = express();
    app.use(express.json());

    // Set up routes
    app.get("/health", healthController.getHealth.bind(healthController));
    app.get(
      "/health/detailed",
      healthController.getDetailedHealth.bind(healthController)
    );
    app.get(
      "/health/readiness",
      healthController.getReadiness.bind(healthController)
    );
    app.get(
      "/health/liveness",
      healthController.getLiveness.bind(healthController)
    );
    app.get(
      "/monitoring/dashboard",
      healthController.getMonitoringDashboard.bind(healthController)
    );
    app.get(
      "/monitoring/performance/history",
      healthController.getPerformanceHistory.bind(healthController)
    );
    app.get(
      "/monitoring/apm/history",
      healthController.getAPMMetricsHistory.bind(healthController)
    );
    app.get(
      "/monitoring/services/:serviceName/history",
      healthController.getServiceHealthHistory.bind(healthController)
    );
    app.get(
      "/monitoring/errors/metrics",
      healthController.getErrorMetrics.bind(healthController)
    );
    app.get(
      "/monitoring/circuit-breakers",
      healthController.getCircuitBreakerStatus.bind(healthController)
    );
    app.post(
      "/monitoring/circuit-breakers/reset",
      healthController.resetCircuitBreakers.bind(healthController)
    );
    app.get(
      "/monitoring/metrics/custom",
      healthController.getCustomMetrics.bind(healthController)
    );
    app.post(
      "/monitoring/metrics/custom",
      healthController.recordCustomMetric.bind(healthController)
    );
    app.get(
      "/monitoring/alerts/rules",
      healthController.getAlertingRules.bind(healthController)
    );
    app.put(
      "/monitoring/alerts/rules/:ruleId",
      healthController.updateAlertingRule.bind(healthController)
    );
    app.post(
      "/monitoring/alerts/:alertId/resolve",
      healthController.resolveAlert.bind(healthController)
    );
  });

  describe("Basic Health Checks", () => {
    it("should return healthy status for basic health check", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("version");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("services");
      expect(response.body).toHaveProperty("metrics");
      expect(Array.isArray(response.body.services)).toBe(true);
    });

    it("should return detailed health check with circuit breakers", async () => {
      const response = await request(app).get("/health/detailed").expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("circuitBreakers");
      expect(response.body.services).toBeDefined();
    });

    it("should return readiness probe status", async () => {
      const response = await request(app).get("/health/readiness").expect(200);

      expect(response.body).toHaveProperty("status");
      expect(["ready", "not_ready"]).toContain(response.body.status);
      expect(response.body).toHaveProperty("services");
    });

    it("should return liveness probe status", async () => {
      const response = await request(app).get("/health/liveness").expect(200);

      expect(response.body).toHaveProperty("status", "alive");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("memory");
      expect(response.body.memory).toHaveProperty("rss");
      expect(response.body.memory).toHaveProperty("heapUsed");
      expect(response.body.memory).toHaveProperty("heapTotal");
    });
  });

  describe("Monitoring Dashboard", () => {
    it("should return comprehensive monitoring dashboard", async () => {
      const response = await request(app)
        .get("/monitoring/dashboard")
        .expect(200);

      expect(response.body).toHaveProperty("systemOverview");
      expect(response.body).toHaveProperty("services");
      expect(response.body).toHaveProperty("performance");
      expect(response.body).toHaveProperty("apmMetrics");
      expect(response.body).toHaveProperty("alerts");
      expect(response.body).toHaveProperty("circuitBreakers");
      expect(response.body).toHaveProperty("errorMetrics");
      expect(response.body).toHaveProperty("criticalFailures");
      expect(response.body).toHaveProperty("customMetrics");

      // Verify APM metrics structure
      expect(response.body.apmMetrics).toHaveProperty("applicationPerformance");
      expect(response.body.apmMetrics).toHaveProperty("businessMetrics");
      expect(response.body.apmMetrics).toHaveProperty("resourceUtilization");
      expect(response.body.apmMetrics).toHaveProperty("customMetrics");

      // Verify business metrics
      expect(response.body.apmMetrics.businessMetrics).toHaveProperty(
        "emailsProcessedPerHour"
      );
      expect(response.body.apmMetrics.businessMetrics).toHaveProperty(
        "scheduleCreationSuccessRate"
      );
      expect(response.body.apmMetrics.businessMetrics).toHaveProperty(
        "calendarEventCreationRate"
      );
      expect(response.body.apmMetrics.businessMetrics).toHaveProperty(
        "notificationDeliveryRate"
      );
      expect(response.body.apmMetrics.businessMetrics).toHaveProperty(
        "oauthTokenRefreshRate"
      );
    });

    it("should handle monitoring dashboard errors gracefully", async () => {
      mockMonitoringService.getMonitoringDashboard.mockRejectedValue(
        new Error("Dashboard error")
      );

      const response = await request(app)
        .get("/monitoring/dashboard")
        .expect(500);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(
        "Failed to retrieve monitoring dashboard"
      );
    });
  });

  describe("Performance History", () => {
    it("should return performance history with default time range", async () => {
      const mockHistory = [
        {
          timestamp: new Date(),
          requestCount: 100,
          averageResponseTime: 150,
          errorRate: 1.5,
          throughput: 10,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: 5,
          queueSize: 0,
        },
      ];

      mockMonitoringService.getPerformanceHistory.mockReturnValue(mockHistory);

      const response = await request(app)
        .get("/monitoring/performance/history")
        .expect(200);

      expect(response.body).toHaveProperty("timeRange", "24 hours");
      expect(response.body).toHaveProperty("dataPoints", 1);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(mockMonitoringService.getPerformanceHistory).toHaveBeenCalledWith(
        24
      );
    });

    it("should return performance history with custom time range", async () => {
      const response = await request(app)
        .get("/monitoring/performance/history?hours=12")
        .expect(200);

      expect(response.body).toHaveProperty("timeRange", "12 hours");
      expect(mockMonitoringService.getPerformanceHistory).toHaveBeenCalledWith(
        12
      );
    });
  });

  describe("APM Metrics History", () => {
    it("should return APM metrics history", async () => {
      const mockAPMHistory = [
        {
          applicationPerformance: {
            throughput: 100,
            responseTimeP50: 100,
            responseTimeP95: 200,
            responseTimeP99: 300,
            errorRate: 1.5,
            apdex: 0.85,
          },
          businessMetrics: {
            emailsProcessedPerHour: 25,
            scheduleCreationSuccessRate: 95.5,
            calendarEventCreationRate: 98.2,
            notificationDeliveryRate: 92.1,
            oauthTokenRefreshRate: 99.8,
          },
          resourceUtilization: {
            cpuUsagePercent: 45.2,
            memoryUsagePercent: 62.8,
            diskUsagePercent: 35.1,
            networkIOBytes: 1024 * 1024,
            databaseConnectionsActive: 5,
            redisConnectionsActive: 2,
          },
          customMetrics: {},
        },
      ];

      mockMonitoringService.getAPMMetricsHistory.mockReturnValue(
        mockAPMHistory
      );

      const response = await request(app)
        .get("/monitoring/apm/history")
        .expect(200);

      expect(response.body).toHaveProperty("timeRange", "24 hours");
      expect(response.body).toHaveProperty("dataPoints", 1);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("summary");
      expect(response.body.summary).toHaveProperty("averageApdex");
      expect(response.body.summary).toHaveProperty("averageErrorRate");
      expect(response.body.summary).toHaveProperty("averageP99ResponseTime");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should calculate APM summary correctly", async () => {
      const mockAPMHistory = [
        {
          applicationPerformance: {
            apdex: 0.8,
            errorRate: 2.0,
            responseTimeP99: 200,
          },
        },
        {
          applicationPerformance: {
            apdex: 0.9,
            errorRate: 1.0,
            responseTimeP99: 150,
          },
        },
      ];

      mockMonitoringService.getAPMMetricsHistory.mockReturnValue(
        mockAPMHistory as any
      );

      const response = await request(app)
        .get("/monitoring/apm/history")
        .expect(200);

      expect(response.body.summary.averageApdex).toBe(0.85); // (0.8 + 0.9) / 2
      expect(response.body.summary.averageErrorRate).toBe(1.5); // (2.0 + 1.0) / 2
      expect(response.body.summary.averageP99ResponseTime).toBe(175); // (200 + 150) / 2
    });
  });

  describe("Service Health History", () => {
    it("should return service health history", async () => {
      const serviceName = "database";
      const mockServiceHistory = [
        {
          name: serviceName,
          status: "healthy",
          responseTime: 50,
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          successCount: 100,
          availability: 100,
        },
      ];

      mockMonitoringService.getServiceHealthHistory.mockReturnValue(
        mockServiceHistory as any
      );

      const response = await request(app)
        .get(`/monitoring/services/${serviceName}/history`)
        .expect(200);

      expect(response.body).toHaveProperty("serviceName", serviceName);
      expect(response.body).toHaveProperty("timeRange", "24 hours");
      expect(response.body).toHaveProperty("dataPoints", 1);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(
        mockMonitoringService.getServiceHealthHistory
      ).toHaveBeenCalledWith(serviceName, 24);
    });

    it("should require service name parameter", async () => {
      const response = await request(app)
        .get("/monitoring/services//history")
        .expect(404); // Express will return 404 for empty parameter

      // This tests the route parameter validation
    });
  });

  describe("Custom Metrics", () => {
    it("should return custom metrics", async () => {
      const mockCustomMetrics = [
        {
          name: "test_metric",
          value: 100,
          unit: "count",
          timestamp: new Date(),
          tags: { environment: "test" },
          description: "Test metric",
        },
      ];

      mockMonitoringService.getCustomMetrics.mockReturnValue(mockCustomMetrics);

      const response = await request(app)
        .get("/monitoring/metrics/custom")
        .expect(200);

      expect(response.body).toHaveProperty("metrics");
      expect(response.body).toHaveProperty("count", 1);
      expect(Array.isArray(response.body.metrics)).toBe(true);
      expect(response.body.metrics[0]).toMatchObject({
        name: "test_metric",
        value: 100,
        unit: "count",
      });
    });

    it("should record custom metric", async () => {
      const metricData = {
        name: "test_custom_metric",
        value: 250,
        unit: "milliseconds",
        tags: { operation: "test" },
        description: "Test custom metric",
      };

      const response = await request(app)
        .post("/monitoring/metrics/custom")
        .send(metricData)
        .expect(201);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain(
        "Custom metric recorded successfully"
      );
      expect(response.body).toHaveProperty("metric");
      expect(response.body.metric).toMatchObject(metricData);

      expect(mockMonitoringService.recordCustomMetric).toHaveBeenCalledWith(
        metricData.name,
        metricData.value,
        metricData.unit,
        metricData.tags,
        metricData.description
      );
    });

    it("should validate required fields for custom metric recording", async () => {
      const response = await request(app)
        .post("/monitoring/metrics/custom")
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Name and value are required");
    });

    it("should handle custom metric recording with minimal data", async () => {
      const response = await request(app)
        .post("/monitoring/metrics/custom")
        .send({
          name: "minimal_metric",
          value: 42,
        })
        .expect(201);

      expect(mockMonitoringService.recordCustomMetric).toHaveBeenCalledWith(
        "minimal_metric",
        42,
        "count", // default unit
        {}, // default tags
        "" // default description
      );
    });
  });

  describe("Alerting Rules Management", () => {
    it("should return alerting rules", async () => {
      const mockRules = [
        {
          id: "test_rule",
          name: "Test Rule",
          description: "A test alerting rule",
          condition: "test_metric > threshold",
          threshold: 100,
          severity: "medium",
          enabled: true,
          cooldownPeriod: 300,
          notificationChannels: ["email"],
          metadata: { category: "test" },
        },
      ];

      mockMonitoringService.getAlertingRules.mockReturnValue(mockRules as any);

      const response = await request(app)
        .get("/monitoring/alerts/rules")
        .expect(200);

      expect(response.body).toHaveProperty("rules");
      expect(response.body).toHaveProperty("summary");
      expect(response.body.summary).toHaveProperty("total", 1);
      expect(response.body.summary).toHaveProperty("enabled", 1);
      expect(response.body.summary).toHaveProperty("disabled", 0);
      expect(response.body.summary).toHaveProperty("bySeverity");
      expect(response.body.summary.bySeverity).toHaveProperty("medium", 1);
    });

    it("should update alerting rule", async () => {
      const ruleId = "test_rule";
      const updates = {
        threshold: 200,
        enabled: false,
      };

      const response = await request(app)
        .put(`/monitoring/alerts/rules/${ruleId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain(
        `Alerting rule updated: ${ruleId}`
      );
      expect(response.body).toHaveProperty("ruleId", ruleId);
      expect(response.body).toHaveProperty("updates");
      expect(response.body.updates).toEqual(["threshold", "enabled"]);

      expect(mockMonitoringService.updateAlertingRule).toHaveBeenCalledWith(
        ruleId,
        updates
      );
    });

    it("should handle non-existent alerting rule update", async () => {
      const ruleId = "non_existent_rule";
      mockMonitoringService.updateAlertingRule.mockReturnValue(false);

      const response = await request(app)
        .put(`/monitoring/alerts/rules/${ruleId}`)
        .send({ threshold: 100 })
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(`Alerting rule not found: ${ruleId}`);
    });

    it("should require rule ID for alerting rule update", async () => {
      const response = await request(app)
        .put("/monitoring/alerts/rules/")
        .send({ threshold: 100 })
        .expect(404); // Express will return 404 for missing parameter
    });
  });

  describe("Alert Resolution", () => {
    it("should resolve alert", async () => {
      const alertId = "test_alert_123";

      const response = await request(app)
        .post(`/monitoring/alerts/${alertId}/resolve`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain(`Alert resolved: ${alertId}`);
      expect(response.body).toHaveProperty("alertId", alertId);
      expect(response.body).toHaveProperty("resolvedAt");

      expect(mockMonitoringService.resolveAlert).toHaveBeenCalledWith(alertId);
    });

    it("should handle non-existent alert resolution", async () => {
      const alertId = "non_existent_alert";
      mockMonitoringService.resolveAlert.mockReturnValue(false);

      const response = await request(app)
        .post(`/monitoring/alerts/${alertId}/resolve`)
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(`Alert not found: ${alertId}`);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors in health check", async () => {
      // Mock database error
      const { prisma } = require("../../src/config/database");
      prisma.$queryRaw.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await request(app).get("/health").expect(200); // Should still return 200 but with unhealthy status

      expect(response.body.services).toBeDefined();
      // The database service should be marked as unhealthy
    });

    it("should handle cache service errors in health check", async () => {
      mockCacheService.set.mockRejectedValue(
        new Error("Cache connection failed")
      );

      const response = await request(app).get("/health").expect(200);

      expect(response.body.services).toBeDefined();
    });

    it("should handle monitoring service errors gracefully", async () => {
      mockMonitoringService.getPerformanceHistory.mockImplementation(() => {
        throw new Error("Monitoring service error");
      });

      const response = await request(app)
        .get("/monitoring/performance/history")
        .expect(500);

      expect(response.body).toHaveProperty("error");
    });
  });
});
