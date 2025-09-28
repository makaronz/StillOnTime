/**
 * Monitoring middleware for automatic request tracking
 * Records performance metrics and error rates for all requests
 */

import { Request, Response, NextFunction } from "express";
import { structuredLogger } from "../utils/logger";
import { MonitoringService } from "../services/monitoring.service";

export interface MonitoringRequest extends Request {
  startTime?: number;
  requestId?: string;
}

export class MonitoringMiddleware {
  private monitoringService: MonitoringService;

  constructor(monitoringService: MonitoringService) {
    this.monitoringService = monitoringService;
  }

  /**
   * Request tracking middleware
   */
  trackRequest() {
    return (
      req: MonitoringRequest,
      res: Response,
      next: NextFunction
    ): void => {
      const startTime = Date.now();
      req.startTime = startTime;

      // Generate request ID for tracing
      req.requestId = this.generateRequestId();

      // Set request ID in structured logger
      structuredLogger.setRequestId(req.requestId);

      // Log request start
      structuredLogger.http("Request started", {
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        requestId: req.requestId,
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      const monitoringService = this.monitoringService; // Capture in closure
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const responseTime = Date.now() - startTime;
        const isError = res.statusCode >= 400;

        // Record metrics
        const endpoint = `${req.method} ${req.route?.path || req.path}`;
        monitoringService.recordRequest(endpoint, responseTime, isError);

        // Log request completion
        structuredLogger.http("Request completed", {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          requestId: req.requestId,
          isError,
        });

        // Clear request ID from logger
        structuredLogger.clearRequestId();

        // Call original end method
        return originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Error tracking middleware
   */
  trackErrors() {
    return (
      error: Error,
      req: MonitoringRequest,
      res: Response,
      next: NextFunction
    ): void => {
      const responseTime = req.startTime ? Date.now() - req.startTime : 0;
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      // Record error metrics
      this.monitoringService.recordRequest(endpoint, responseTime, true);

      // Log error with context
      structuredLogger.error(
        "Request error",
        {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode || 500,
          responseTime,
          requestId: req.requestId,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        error
      );

      next(error);
    };
  }

  /**
   * Performance monitoring middleware for specific operations
   */
  trackOperation(operationName: string) {
    return (
      req: MonitoringRequest,
      res: Response,
      next: NextFunction
    ): void => {
      const startTime = Date.now();

      // Override res.end to capture operation metrics
      const originalEnd = res.end;
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const operationTime = Date.now() - startTime;
        const isError = res.statusCode >= 400;

        // Log operation performance
        structuredLogger.performance(operationName, operationTime, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          requestId: req.requestId,
          isError,
        });

        return originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Rate limiting monitoring middleware
   */
  trackRateLimit() {
    return (
      req: MonitoringRequest,
      res: Response,
      next: NextFunction
    ): void => {
      // Check for rate limit headers
      res.on("finish", () => {
        const rateLimitRemaining = res.get("X-RateLimit-Remaining");
        const rateLimitLimit = res.get("X-RateLimit-Limit");
        const rateLimitReset = res.get("X-RateLimit-Reset");

        if (rateLimitRemaining !== undefined) {
          const remaining = parseInt(rateLimitRemaining);
          const limit = parseInt(rateLimitLimit || "0");
          const usagePercent =
            limit > 0 ? ((limit - remaining) / limit) * 100 : 0;

          structuredLogger.debug("Rate limit status", {
            endpoint: `${req.method} ${req.path}`,
            remaining,
            limit,
            usagePercent,
            resetTime: rateLimitReset,
            requestId: req.requestId,
          });

          // Alert if rate limit usage is high
          if (usagePercent > 80) {
            structuredLogger.warn("High rate limit usage", {
              endpoint: `${req.method} ${req.path}`,
              usagePercent,
              remaining,
              limit,
              requestId: req.requestId,
            });
          }
        }
      });

      next();
    };
  }

  /**
   * Security monitoring middleware
   */
  trackSecurity() {
    return (
      req: MonitoringRequest,
      res: Response,
      next: NextFunction
    ): void => {
      // Monitor for suspicious patterns
      const suspiciousPatterns = [
        /\.\./, // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /javascript:/i, // JavaScript injection
        /eval\(/i, // Code injection
      ];

      const url = req.url.toLowerCase();
      const body = JSON.stringify(req.body || {}).toLowerCase();
      const query = JSON.stringify(req.query || {}).toLowerCase();

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url) || pattern.test(body) || pattern.test(query)) {
          structuredLogger.security("Suspicious request pattern detected", {
            pattern: pattern.source,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.requestId,
            body: req.body,
            query: req.query,
          });
          break;
        }
      }

      // Monitor for unusual request sizes
      const contentLength = parseInt(req.get("Content-Length") || "0");
      if (contentLength > 10 * 1024 * 1024) {
        // 10MB
        structuredLogger.security("Large request detected", {
          contentLength,
          method: req.method,
          url: req.url,
          ip: req.ip,
          requestId: req.requestId,
        });
      }

      // Monitor for unusual user agents
      const userAgent = req.get("User-Agent") || "";
      const suspiciousUserAgents = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
      ];

      if (suspiciousUserAgents.some((pattern) => pattern.test(userAgent))) {
        structuredLogger.security("Suspicious user agent detected", {
          userAgent,
          method: req.method,
          url: req.url,
          ip: req.ip,
          requestId: req.requestId,
        });
      }

      next();
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create monitoring middleware
 */
export function createMonitoringMiddleware(
  monitoringService: MonitoringService
): MonitoringMiddleware {
  return new MonitoringMiddleware(monitoringService);
}
