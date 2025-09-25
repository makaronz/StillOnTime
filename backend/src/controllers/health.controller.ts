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

  constructor(cacheService: CacheService, oauth2Service: OAuth2Service) {
    this.cacheService = cacheService;
    this.oauth2Service = oauth2Service;
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
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
        error: error.message,
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
        error: error.message,
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
        error: error.message,
      });

      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        error: error.message,
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
      structuredLogger.error("Liveness check failed", { error: error.message });

      res.status(503).json({
        status: "dead",
        timestamp: new Date().toISOString(),
        error: error.message,
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
        error: error.message,
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

      await this.cacheService.set(testKey, testValue, 10);
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
        error: error.message,
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
        error: error.message,
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
        error: error.message,
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
