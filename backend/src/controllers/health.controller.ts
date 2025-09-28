/**
 * Health check controller for monitoring system status
 * Provides detailed service status and health metrics
 */

import { Request, Response } from "express";
import { logger, structuredLogger } from "../utils/logger";
import { CircuitBreakerRegistry } from "../utils/circuit-breaker";
import { CacheService } from "../services/cache.service";
import { prisma } from "../config/database";
import { OAuth2Service } from "../services/oauth2.service";
import { MonitoringService } from "../services/monitoring.service";
import { ErrorHandlerService } from "../services/error-handler.service";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceHealthStatus[];
  metrics: SystemMetrics;
  circuitBreakers?: Record<string, any>;
}

export interface ServiceHealthStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    connections: number;
    activeQueries: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
  };
}

export class HealthController {
  private cacheService: CacheService;
  private oauth2Service: OAuth2Service;
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private monitoringService: MonitoringService;
  private errorHandlerService: ErrorHandlerService;

  constructor(
    cacheService: CacheService,
    oauth2Service: OAuth2Service,
    monitoringService: MonitoringService,
    errorHandlerService: ErrorHandlerService
  ) {
    this.cacheService = cacheService;
    this.oauth2Service = oauth2Service;
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.monitoringService = monitoringService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Basic health check endpoint
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const healthStatus = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      structuredLogger.http("Health check completed", {
        status: healthStatus.status,
        responseTime,
        services: healthStatus.services.length,
      });

      const statusCode = this.getStatusCode(healthStatus.status);
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      structuredLogger.error("Health check failed", {
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        responseTime,
      });
    }
  }

  /**
   * Detailed health check with all services
   */
  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const healthStatus = await this.performDetailedHealthCheck();
      const responseTime = Date.now() - startTime;

      structuredLogger.http("Detailed health check completed", {
        status: healthStatus.status,
        responseTime,
        services: healthStatus.services.length,
        circuitBreakers: Object.keys(healthStatus.circuitBreakers || {}).length,
      });

      const statusCode = this.getStatusCode(healthStatus.status);
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      structuredLogger.error("Detailed health check failed", {
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Detailed health check failed",
        responseTime,
      });
    }
  }

  /**
   * Readiness probe for Kubernetes
   */
  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const criticalServices = await this.checkCriticalServices();
      const allHealthy = criticalServices.every(
        (service) => service.status === "healthy"
      );

      if (allHealthy) {
        res.status(200).json({
          status: "ready",
          timestamp: new Date().toISOString(),
          services: criticalServices,
        });
      } else {
        res.status(503).json({
          status: "not_ready",
          timestamp: new Date().toISOString(),
          services: criticalServices,
        });
      }
    } catch (error) {
      structuredLogger.error("Readiness check failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Liveness probe for Kubernetes
   */
  async getLiveness(req: Request, res: Response): Promise<void> {
    try {
      // Basic liveness check - just verify the application is running
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      res.status(200).json({
        status: "alive",
        timestamp: new Date().toISOString(),
        uptime,
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
        },
      });
    } catch (error) {
      structuredLogger.error("Liveness check failed", { error: error instanceof Error ? error.message : String(error) });

      res.status(503).json({
        status: "dead",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Private helper methods

  private async performHealthCheck(): Promise<HealthStatus> {
    const services = await this.checkCriticalServices();
    const metrics = await this.getSystemMetrics();

    const overallStatus = this.determineOverallStatus(services);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      services,
      metrics,
    };
  }

  private async performDetailedHealthCheck(): Promise<HealthStatus> {
    const services = await this.checkAllServices();
    const metrics = await this.getSystemMetrics();
    const circuitBreakers = this.circuitBreakerRegistry.getAllStats();

    const overallStatus = this.determineOverallStatus(services);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      services,
      metrics,
      circuitBreakers,
    };
  }

  private async checkCriticalServices(): Promise<ServiceHealthStatus[]> {
    const services: ServiceHealthStatus[] = [];

    // Database check
    services.push(await this.checkDatabase());

    // Cache check
    services.push(await this.checkCache());

    return services;
  }

  private async checkAllServices(): Promise<ServiceHealthStatus[]> {
    const services: ServiceHealthStatus[] = [];

    // Critical services
    services.push(await this.checkDatabase());
    services.push(await this.checkCache());

    // External services
    services.push(await this.checkGoogleAPIs());
    services.push(await this.checkWeatherAPI());

    return services;
  }

  private async checkDatabase(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        name: "database",
        status: responseTime < 1000 ? "healthy" : "degraded",
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          type: "postgresql",
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "database",
        status: "unhealthy",
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        details: {
          type: "postgresql",
          connectionFailed: true,
        },
      };
    }
  }

  private async checkCache(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const testKey = "health_check_test";
      const testValue = Date.now().toString();

      await this.cacheService.set(testKey, testValue, { ttl: 10 });
      const retrievedValue = await this.cacheService.get(testKey);
      await this.cacheService.delete(testKey);

      const responseTime = Date.now() - startTime;
      const isHealthy = retrievedValue === testValue;

      return {
        name: "cache",
        status: isHealthy && responseTime < 500 ? "healthy" : "degraded",
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          type: "redis",
          testPassed: isHealthy,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "cache",
        status: "unhealthy",
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        details: {
          type: "redis",
          connectionFailed: true,
        },
      };
    }
  }

  private async checkGoogleAPIs(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // This is a simplified check - in practice, you might want to test actual API calls
      const circuitBreaker = this.circuitBreakerRegistry.get("google_apis");
      const responseTime = Date.now() - startTime;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      let details: Record<string, any> = {};

      if (circuitBreaker) {
        const stats = circuitBreaker.getStats();
        details = { circuitBreakerState: stats.state, ...stats };

        if (stats.state === "OPEN") {
          status = "unhealthy";
        } else if (stats.state === "HALF_OPEN") {
          status = "degraded";
        }
      }

      return {
        name: "google_apis",
        status,
        responseTime,
        lastCheck: new Date().toISOString(),
        details,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "google_apis",
        status: "unhealthy",
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkWeatherAPI(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const circuitBreaker = this.circuitBreakerRegistry.get("weather_api");
      const responseTime = Date.now() - startTime;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      let details: Record<string, any> = {};

      if (circuitBreaker) {
        const stats = circuitBreaker.getStats();
        details = { circuitBreakerState: stats.state, ...stats };

        if (stats.state === "OPEN") {
          status = "unhealthy";
        } else if (stats.state === "HALF_OPEN") {
          status = "degraded";
        }
      }

      return {
        name: "weather_api",
        status,
        responseTime,
        lastCheck: new Date().toISOString(),
        details,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "weather_api",
        status: "unhealthy",
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
      database: {
        connections: 0, // Would need to implement connection pool monitoring
        activeQueries: 0, // Would need to implement query monitoring
      },
      cache: {
        hitRate: 0, // Would need to implement cache hit rate tracking
        memoryUsage: 0, // Would need to implement cache memory usage tracking
      },
    };
  }

  private determineOverallStatus(
    services: ServiceHealthStatus[]
  ): "healthy" | "degraded" | "unhealthy" {
    const unhealthyServices = services.filter((s) => s.status === "unhealthy");
    const degradedServices = services.filter((s) => s.status === "degraded");

    if (unhealthyServices.length > 0) {
      return "unhealthy";
    }

    if (degradedServices.length > 0) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Get comprehensive monitoring dashboard
   */
  async getMonitoringDashboard(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const dashboard = await this.monitoringService.getMonitoringDashboard();
      const responseTime = Date.now() - startTime;

      structuredLogger.http("Monitoring dashboard requested", {
        responseTime,
        systemStatus: dashboard.systemOverview.status,
        activeAlerts: dashboard.alerts.length,
        criticalFailures: dashboard.criticalFailures.length,
      });

      res.status(200).json(dashboard);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      structuredLogger.error("Monitoring dashboard request failed", {
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve monitoring dashboard",
        timestamp: new Date().toISOString(),
        responseTime,
      });
    }
  }

  /**
   * Get performance metrics history
   */
  async getPerformanceHistory(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const history = this.monitoringService.getPerformanceHistory(hours);

      structuredLogger.http("Performance history requested", {
        hours,
        dataPoints: history.length,
      });

      res.status(200).json({
        timeRange: `${hours} hours`,
        dataPoints: history.length,
        data: history,
      });
    } catch (error) {
      structuredLogger.error("Performance history request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve performance history",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get service health history
   */
  async getServiceHealthHistory(req: Request, res: Response): Promise<void> {
    try {
      const serviceName = req.params.serviceName;
      const hours = parseInt(req.query.hours as string) || 24;

      if (!serviceName) {
        res.status(400).json({
          error: "Service name is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const history = this.monitoringService.getServiceHealthHistory(
        serviceName,
        hours
      );

      structuredLogger.http("Service health history requested", {
        serviceName,
        hours,
        dataPoints: history.length,
      });

      res.status(200).json({
        serviceName,
        timeRange: `${hours} hours`,
        dataPoints: history.length,
        data: history,
      });
    } catch (error) {
      structuredLogger.error("Service health history request failed", {
        serviceName: req.params.serviceName,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve service health history",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get error metrics and statistics
   */
  async getErrorMetrics(req: Request, res: Response): Promise<void> {
    try {
      const errorMetrics = this.errorHandlerService.getErrorMetrics();
      const criticalFailures = this.errorHandlerService.getCriticalFailures();

      structuredLogger.http("Error metrics requested", {
        errorTypes: Object.keys(errorMetrics).length,
        criticalFailures: criticalFailures.length,
      });

      res.status(200).json({
        errorMetrics,
        criticalFailures,
        summary: {
          totalErrorTypes: Object.keys(errorMetrics).length,
          totalCriticalFailures: criticalFailures.length,
          recentCriticalFailures: criticalFailures.filter(
            (f) => f.failureTime > new Date(Date.now() - 3600000) // Last hour
          ).length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Error metrics request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve error metrics",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get circuit breaker status for all services
   */
  async getCircuitBreakerStatus(req: Request, res: Response): Promise<void> {
    try {
      const circuitBreakers = this.circuitBreakerRegistry.getAllStats();

      structuredLogger.http("Circuit breaker status requested", {
        circuitBreakerCount: Object.keys(circuitBreakers).length,
        openBreakers: Object.values(circuitBreakers).filter(
          (cb) => cb.state === "OPEN"
        ).length,
      });

      res.status(200).json({
        circuitBreakers,
        summary: {
          total: Object.keys(circuitBreakers).length,
          open: Object.values(circuitBreakers).filter(
            (cb) => cb.state === "OPEN"
          ).length,
          halfOpen: Object.values(circuitBreakers).filter(
            (cb) => cb.state === "HALF_OPEN"
          ).length,
          closed: Object.values(circuitBreakers).filter(
            (cb) => cb.state === "CLOSED"
          ).length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Circuit breaker status request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve circuit breaker status",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Reset circuit breakers (admin endpoint)
   */
  async resetCircuitBreakers(req: Request, res: Response): Promise<void> {
    try {
      const serviceName = req.body.serviceName;

      if (serviceName) {
        const circuitBreaker = this.circuitBreakerRegistry.get(serviceName);
        if (!circuitBreaker) {
          res.status(404).json({
            error: `Circuit breaker not found for service: ${serviceName}`,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        circuitBreaker.reset();

        structuredLogger.info("Circuit breaker reset", {
          serviceName,
          resetBy: req.ip || "unknown",
        });

        res.status(200).json({
          message: `Circuit breaker reset for service: ${serviceName}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.circuitBreakerRegistry.resetAll();

        structuredLogger.info("All circuit breakers reset", {
          resetBy: req.ip || "unknown",
        });

        res.status(200).json({
          message: "All circuit breakers reset",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      structuredLogger.error("Circuit breaker reset failed", {
        serviceName: req.body.serviceName,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to reset circuit breakers",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get APM metrics history
   */
  async getAPMMetricsHistory(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const history = this.monitoringService.getAPMMetricsHistory(hours);

      structuredLogger.http("APM metrics history requested", {
        hours,
        dataPoints: history.length,
      });

      res.status(200).json({
        timeRange: `${hours} hours`,
        dataPoints: history.length,
        data: history,
        summary: {
          averageApdex:
            history.length > 0
              ? history.reduce(
                  (sum, m) => sum + m.applicationPerformance.apdex,
                  0
                ) / history.length
              : 0,
          averageErrorRate:
            history.length > 0
              ? history.reduce(
                  (sum, m) => sum + m.applicationPerformance.errorRate,
                  0
                ) / history.length
              : 0,
          averageP99ResponseTime:
            history.length > 0
              ? history.reduce(
                  (sum, m) => sum + m.applicationPerformance.responseTimeP99,
                  0
                ) / history.length
              : 0,
        },
      });
    } catch (error) {
      structuredLogger.error("APM metrics history request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve APM metrics history",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get custom metrics
   */
  async getCustomMetrics(req: Request, res: Response): Promise<void> {
    try {
      const customMetrics = this.monitoringService.getCustomMetrics();

      structuredLogger.http("Custom metrics requested", {
        metricCount: customMetrics.length,
      });

      res.status(200).json({
        metrics: customMetrics,
        count: customMetrics.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Custom metrics request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve custom metrics",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Record custom metric (POST endpoint)
   */
  async recordCustomMetric(req: Request, res: Response): Promise<void> {
    try {
      const { name, value, unit, tags, description } = req.body;

      if (!name || value === undefined) {
        res.status(400).json({
          error: "Name and value are required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.monitoringService.recordCustomMetric(
        name,
        parseFloat(value),
        unit || "count",
        tags || {},
        description || ""
      );

      structuredLogger.info("Custom metric recorded via API", {
        name,
        value,
        unit,
        tags,
        recordedBy: req.ip || "unknown",
      });

      res.status(201).json({
        message: "Custom metric recorded successfully",
        metric: { name, value, unit, tags, description },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Custom metric recording failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to record custom metric",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get alerting rules
   */
  async getAlertingRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = this.monitoringService.getAlertingRules();

      structuredLogger.http("Alerting rules requested", {
        ruleCount: rules.length,
        enabledRules: rules.filter((r) => r.enabled).length,
      });

      res.status(200).json({
        rules,
        summary: {
          total: rules.length,
          enabled: rules.filter((r) => r.enabled).length,
          disabled: rules.filter((r) => !r.enabled).length,
          bySeverity: {
            critical: rules.filter((r) => r.severity === "critical").length,
            high: rules.filter((r) => r.severity === "high").length,
            medium: rules.filter((r) => r.severity === "medium").length,
            low: rules.filter((r) => r.severity === "low").length,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Alerting rules request failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to retrieve alerting rules",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update alerting rule
   */
  async updateAlertingRule(req: Request, res: Response): Promise<void> {
    try {
      const ruleId = req.params.ruleId;
      const updates = req.body;

      if (!ruleId) {
        res.status(400).json({
          error: "Rule ID is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = this.monitoringService.updateAlertingRule(
        ruleId,
        updates
      );

      if (!success) {
        res.status(404).json({
          error: `Alerting rule not found: ${ruleId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      structuredLogger.info("Alerting rule updated via API", {
        ruleId,
        updates: Object.keys(updates),
        updatedBy: req.ip || "unknown",
      });

      res.status(200).json({
        message: `Alerting rule updated: ${ruleId}`,
        ruleId,
        updates: Object.keys(updates),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Alerting rule update failed", {
        ruleId: req.params.ruleId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to update alerting rule",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const alertId = req.params.alertId;

      if (!alertId) {
        res.status(400).json({
          error: "Alert ID is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = this.monitoringService.resolveAlert(alertId);

      if (!success) {
        res.status(404).json({
          error: `Alert not found: ${alertId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      structuredLogger.info("Alert resolved via API", {
        alertId,
        resolvedBy: req.ip || "unknown",
      });

      res.status(200).json({
        message: `Alert resolved: ${alertId}`,
        alertId,
        resolvedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Alert resolution failed", {
        alertId: req.params.alertId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to resolve alert",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test endpoint for triggering alerts (development/testing only)
   */
  async triggerTestAlert(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "Test alerts not available in production",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const { alertType, severity, metricValue } = req.body;

      // Simulate different types of test alerts
      switch (alertType) {
        case "high_error_rate":
          this.monitoringService.recordBusinessMetric(
            "test_error_rate",
            metricValue || 15
          );
          break;
        case "apdex_degradation":
          this.monitoringService.recordCustomMetric(
            "test_apdex",
            metricValue || 0.5,
            "score"
          );
          break;
        case "resource_exhaustion":
          this.monitoringService.recordCustomMetric(
            "test_cpu_usage",
            metricValue || 95,
            "percent"
          );
          break;
        default:
          res.status(400).json({
            error: "Invalid alert type",
            validTypes: [
              "high_error_rate",
              "apdex_degradation",
              "resource_exhaustion",
            ],
            timestamp: new Date().toISOString(),
          });
          return;
      }

      structuredLogger.info("Test alert triggered", {
        alertType,
        severity,
        metricValue,
        triggeredBy: req.ip || "unknown",
      });

      res.status(200).json({
        message: `Test alert triggered: ${alertType}`,
        alertType,
        severity,
        metricValue,
        note: "Alert evaluation will occur within 30 seconds",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      structuredLogger.error("Test alert trigger failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: "Failed to trigger test alert",
        timestamp: new Date().toISOString(),
      });
    }
  }

  private getStatusCode(status: string): number {
    switch (status) {
      case "healthy":
        return 200;
      case "degraded":
        return 200; // Still operational
      case "unhealthy":
        return 503;
      default:
        return 500;
    }
  }
}
