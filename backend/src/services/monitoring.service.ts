/**
 * Advanced monitoring and alerting service
 * Provides comprehensive application performance monitoring and alerting
 */

import { logger, structuredLogger, LogContext } from "../utils/logger";
import {
  CircuitBreakerRegistry,
  CircuitBreakerStats,
} from "../utils/circuit-breaker";
import {
  ErrorHandlerService,
  ErrorMetrics,
  CriticalServiceFailure,
} from "./error-handler.service";
import { MetricsData, CircuitBreakerState } from "../types";
import {
  AlertRule as DomainAlertRule,
  Alert as DomainAlert,
} from "../types/domain";
import { CacheService } from "./cache.service";
import { NotificationService } from "./notification.service";
import { db } from "@/config/database";
import { sql } from "kysely";

export interface PerformanceMetrics {
  timestamp: Date;
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  queueSize: number;
}

export interface ServiceHealthMetrics {
  serviceName: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  errorCount: number;
  successCount: number;
  availability: number;
  lastCheck: Date;
  circuitBreakerState?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  cooldownPeriod: number; // in seconds
  lastTriggered?: Date;
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface APMMetrics {
  applicationPerformance: {
    throughput: number; // requests per minute
    responseTimeP50: number;
    responseTimeP95: number;
    responseTimeP99: number;
    errorRate: number;
    apdex: number; // Application Performance Index
  };
  businessMetrics: {
    emailsProcessedPerHour: number;
    scheduleCreationSuccessRate: number;
    calendarEventCreationRate: number;
    notificationDeliveryRate: number;
    oauthTokenRefreshRate: number;
  };
  resourceUtilization: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    diskUsagePercent: number;
    networkIOBytes: number;
    databaseConnectionsActive: number;
    redisConnectionsActive: number;
  };
  customMetrics: Record<string, number>;
}

export interface CustomMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  description: string;
}

export interface AlertingRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  cooldownPeriod: number; // seconds
  escalationPolicy?: string;
  notificationChannels: string[];
  metadata: Record<string, any>;
}

export interface MonitoringDashboard {
  systemOverview: {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
  services: ServiceHealthMetrics[];
  performance: PerformanceMetrics;
  apmMetrics: APMMetrics;
  alerts: Alert[];
  circuitBreakers: Record<string, CircuitBreakerStats>;
  errorMetrics: Record<string, ErrorMetrics>;
  criticalFailures: CriticalServiceFailure[];
  customMetrics: CustomMetric[];
}

export class MonitoringService {
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private errorHandlerService: ErrorHandlerService;
  private cacheService: CacheService;
  private notificationService: NotificationService;

  private performanceHistory: PerformanceMetrics[] = [];
  private apmMetricsHistory: APMMetrics[] = [];
  private serviceHealthHistory: Map<string, ServiceHealthMetrics[]> = new Map();
  private alertRules: Map<string, DomainAlertRule> = new Map();
  private alertingRules: Map<string, AlertingRule> = new Map();
  private activeAlerts: Map<string, DomainAlert> = new Map();
  private requestMetrics: Map<
    string,
    {
      count: number;
      totalTime: number;
      errors: number;
      responseTimes: number[];
    }
  > = new Map();
  private customMetrics: Map<string, CustomMetric> = new Map();
  private businessMetrics: Map<string, number> = new Map();

  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private alertEvaluationInterval: NodeJS.Timeout | null = null;
  private apmCollectionInterval: NodeJS.Timeout | null = null;

  private readonly MAX_HISTORY_SIZE = 1440; // 24 hours of minute-by-minute data
  private readonly METRICS_COLLECTION_INTERVAL = 60000; // 1 minute
  private readonly ALERT_EVALUATION_INTERVAL = 30000; // 30 seconds
  private readonly APM_COLLECTION_INTERVAL = 30000; // 30 seconds

  constructor(
    errorHandlerService: ErrorHandlerService,
    cacheService: CacheService,
    notificationService: NotificationService
  ) {
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.errorHandlerService = errorHandlerService;
    this.cacheService = cacheService;
    this.notificationService = notificationService;

    this.initializeDefaultAlertRules();
    this.startMonitoring();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.initializeBasicAlertRules();
    this.initializeAdvancedAlertingRules();
  }

  /**
   * Initialize basic alert rules (existing functionality)
   */
  private initializeBasicAlertRules(): void {
    const defaultRules: DomainAlertRule[] = [
      {
        id: "high_error_rate",
        name: "High Error Rate",
        condition: "error_rate > threshold",
        threshold: 5, // 5%
        severity: "high",
        enabled: true,
        cooldownPeriod: 300, // 5 minutes
        description: "Error rate exceeds acceptable threshold",
      },
      {
        id: "slow_response_time",
        name: "Slow Response Time",
        condition: "avg_response_time > threshold",
        threshold: 5000, // 5 seconds
        severity: "medium",
        enabled: true,
        cooldownPeriod: 180, // 3 minutes
        description: "Average response time is too high",
      },
      {
        id: "high_memory_usage",
        name: "High Memory Usage",
        condition: "memory_usage_percentage > threshold",
        threshold: 85, // 85%
        severity: "high",
        enabled: true,
        cooldownPeriod: 300,
        description: "Memory usage is critically high",
      },
      {
        id: "database_connection_failure",
        name: "Database Connection Failure",
        condition: "database_status == unhealthy",
        threshold: 1,
        severity: "critical",
        enabled: true,
        cooldownPeriod: 60, // 1 minute
        description: "Database connection is failing",
      },
      {
        id: "circuit_breaker_open",
        name: "Circuit Breaker Open",
        condition: "circuit_breaker_state == OPEN",
        threshold: 1,
        severity: "high",
        enabled: true,
        cooldownPeriod: 120, // 2 minutes
        description: "Circuit breaker is open for external service",
      },
      {
        id: "oauth_failure_rate",
        name: "OAuth Failure Rate",
        condition: "oauth_error_rate > threshold",
        threshold: 10, // 10%
        severity: "high",
        enabled: true,
        cooldownPeriod: 300,
        description: "OAuth authentication failure rate is high",
      },
    ];

    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule);
    });

    structuredLogger.info("Initialized basic alert rules", {
      ruleCount: defaultRules.length,
    });
  }

  /**
   * Initialize advanced alerting rules for APM and business metrics
   */
  private initializeAdvancedAlertingRules(): void {
    const advancedRules: AlertingRule[] = [
      {
        id: "apdex_degradation",
        name: "Application Performance Index Degradation",
        description: "APDEX score indicates poor user experience",
        condition: "apdex < threshold",
        threshold: 0.7, // APDEX below 0.7 is poor
        severity: "high",
        enabled: true,
        cooldownPeriod: 300,
        notificationChannels: ["email", "sms"],
        metadata: { category: "performance", impact: "user_experience" },
      },
      {
        id: "p99_response_time",
        name: "99th Percentile Response Time High",
        description: "99th percentile response time exceeds acceptable limits",
        condition: "response_time_p99 > threshold",
        threshold: 10000, // 10 seconds
        severity: "high",
        enabled: true,
        cooldownPeriod: 180,
        notificationChannels: ["email"],
        metadata: { category: "performance", metric: "latency" },
      },
      {
        id: "email_processing_failure_rate",
        name: "Email Processing Failure Rate High",
        description:
          "Email processing success rate is below acceptable threshold",
        condition: "email_processing_success_rate < threshold",
        threshold: 90, // 90%
        severity: "high",
        enabled: true,
        cooldownPeriod: 300,
        notificationChannels: ["email", "sms"],
        metadata: { category: "business", operation: "email_processing" },
      },
      {
        id: "calendar_creation_failure_spike",
        name: "Calendar Event Creation Failure Spike",
        description: "Calendar event creation failures are increasing rapidly",
        condition: "calendar_creation_error_rate > threshold",
        threshold: 15, // 15%
        severity: "medium",
        enabled: true,
        cooldownPeriod: 240,
        notificationChannels: ["email"],
        metadata: { category: "business", operation: "calendar_integration" },
      },
      {
        id: "oauth_token_refresh_failure",
        name: "OAuth Token Refresh Failure Rate High",
        description: "OAuth token refresh operations are failing frequently",
        condition: "oauth_refresh_failure_rate > threshold",
        threshold: 20, // 20%
        severity: "critical",
        enabled: true,
        cooldownPeriod: 180,
        notificationChannels: ["email", "sms"],
        metadata: { category: "authentication", operation: "oauth_refresh" },
      },
      {
        id: "resource_exhaustion_cpu",
        name: "CPU Resource Exhaustion",
        description: "CPU usage is critically high for extended period",
        condition: "cpu_usage_percent > threshold",
        threshold: 90, // 90%
        severity: "critical",
        enabled: true,
        cooldownPeriod: 120,
        notificationChannels: ["email", "sms"],
        metadata: { category: "infrastructure", resource: "cpu" },
      },
      {
        id: "resource_exhaustion_memory",
        name: "Memory Resource Exhaustion",
        description: "Memory usage is critically high",
        condition: "memory_usage_percent > threshold",
        threshold: 90, // 90%
        severity: "critical",
        enabled: true,
        cooldownPeriod: 120,
        notificationChannels: ["email", "sms"],
        metadata: { category: "infrastructure", resource: "memory" },
      },
      {
        id: "database_connection_pool_exhaustion",
        name: "Database Connection Pool Exhaustion",
        description: "Database connection pool is near capacity",
        condition: "db_connections_active > threshold",
        threshold: 80, // 80% of pool size
        severity: "high",
        enabled: true,
        cooldownPeriod: 180,
        notificationChannels: ["email"],
        metadata: { category: "infrastructure", resource: "database" },
      },
      {
        id: "notification_delivery_failure",
        name: "Notification Delivery Failure Rate High",
        description: "Notification delivery success rate is below threshold",
        condition: "notification_delivery_rate < threshold",
        threshold: 85, // 85%
        severity: "medium",
        enabled: true,
        cooldownPeriod: 300,
        notificationChannels: ["email"],
        metadata: { category: "business", operation: "notifications" },
      },
    ];

    advancedRules.forEach((rule) => {
      this.alertingRules.set(rule.id, rule);
    });

    structuredLogger.info("Initialized advanced alerting rules", {
      ruleCount: advancedRules.length,
    });
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Start metrics collection
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.METRICS_COLLECTION_INTERVAL);

    // Start APM metrics collection
    this.apmCollectionInterval = setInterval(() => {
      this.collectAPMMetrics();
    }, this.APM_COLLECTION_INTERVAL);

    // Start alert evaluation
    this.alertEvaluationInterval = setInterval(() => {
      this.evaluateAlerts();
      this.evaluateAdvancedAlerts();
    }, this.ALERT_EVALUATION_INTERVAL);

    structuredLogger.info("Monitoring service started", {
      metricsInterval: this.METRICS_COLLECTION_INTERVAL,
      apmInterval: this.APM_COLLECTION_INTERVAL,
      alertInterval: this.ALERT_EVALUATION_INTERVAL,
    });
  }

  /**
   * Stop monitoring processes
   */
  public stopMonitoring(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    if (this.apmCollectionInterval) {
      clearInterval(this.apmCollectionInterval);
      this.apmCollectionInterval = null;
    }

    if (this.alertEvaluationInterval) {
      clearInterval(this.alertEvaluationInterval);
      this.alertEvaluationInterval = null;
    }

    structuredLogger.info("Monitoring service stopped");
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Calculate request metrics
      const totalRequests = Array.from(this.requestMetrics.values()).reduce(
        (sum, metric) => sum + metric.count,
        0
      );

      const totalTime = Array.from(this.requestMetrics.values()).reduce(
        (sum, metric) => sum + metric.totalTime,
        0
      );

      const totalErrors = Array.from(this.requestMetrics.values()).reduce(
        (sum, metric) => sum + metric.errors,
        0
      );

      const averageResponseTime =
        totalRequests > 0 ? totalTime / totalRequests : 0;
      const errorRate =
        totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      const throughput = totalRequests; // requests per collection interval

      // Get active connections (simplified - would need actual connection pool metrics)
      const activeConnections = await this.getActiveConnectionCount();

      // Get queue size (simplified - would need actual queue metrics)
      const queueSize = await this.getQueueSize();

      const metrics: PerformanceMetrics = {
        timestamp,
        requestCount: totalRequests,
        averageResponseTime,
        errorRate,
        throughput,
        memoryUsage,
        cpuUsage,
        activeConnections,
        queueSize,
      };

      // Store metrics
      this.performanceHistory.push(metrics);

      // Trim history to prevent memory leaks
      if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
        this.performanceHistory = this.performanceHistory.slice(
          -this.MAX_HISTORY_SIZE
        );
      }

      // Reset request metrics for next collection period
      this.requestMetrics.clear();

      // Collect service health metrics
      await this.collectServiceHealthMetrics();

      structuredLogger.debug("Metrics collected", {
        requestCount: totalRequests,
        averageResponseTime,
        errorRate,
        memoryUsagePercent:
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      });
    } catch (error) {
      structuredLogger.error("Failed to collect metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect service health metrics
   */
  private async collectServiceHealthMetrics(): Promise<void> {
    const services = [
      "database",
      "cache",
      "gmail_api",
      "calendar_api",
      "maps_api",
      "weather_api",
    ];

    for (const serviceName of services) {
      try {
        const healthMetric = await this.checkServiceHealth(serviceName);

        if (!this.serviceHealthHistory.has(serviceName)) {
          this.serviceHealthHistory.set(serviceName, []);
        }

        const history = this.serviceHealthHistory.get(serviceName)!;
        history.push(healthMetric);

        // Trim history
        if (history.length > this.MAX_HISTORY_SIZE) {
          this.serviceHealthHistory.set(
            serviceName,
            history.slice(-this.MAX_HISTORY_SIZE)
          );
        }
      } catch (error) {
        structuredLogger.warn("Failed to collect service health metrics", {
          serviceName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(
    serviceName: string
  ): Promise<ServiceHealthMetrics> {
    const startTime = Date.now();
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let errorCount = 0;
    let successCount = 0;

    try {
      switch (serviceName) {
        case "database":
          await sql`SELECT 1`.execute(db);
          successCount = 1;
          break;

        case "cache":
          const testKey = `health_check_${Date.now()}`;
          await this.cacheService.set(testKey, "test", { ttl: 10 });
          await this.cacheService.get(testKey);
          await this.cacheService.delete(testKey);
          successCount = 1;
          break;

        default:
          // For external APIs, check circuit breaker state
          const circuitBreaker = this.circuitBreakerRegistry.get(serviceName);
          if (circuitBreaker) {
            const stats = circuitBreaker.getStats();
            if (stats.state === "OPEN") {
              status = "unhealthy";
              errorCount = stats.failureCount;
            } else if (stats.state === "HALF_OPEN") {
              status = "degraded";
              errorCount = stats.failureCount;
            }
            successCount = stats.successCount;
          }
          break;
      }
    } catch (error) {
      status = "unhealthy";
      errorCount = 1;

      structuredLogger.warn("Service health check failed", {
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const responseTime = Date.now() - startTime;
    const totalChecks = errorCount + successCount;
    const availability =
      totalChecks > 0 ? (successCount / totalChecks) * 100 : 0;

    // Get circuit breaker state if available
    const circuitBreaker = this.circuitBreakerRegistry.get(serviceName);
    const circuitBreakerState = circuitBreaker?.getStats().state;

    return {
      serviceName,
      status,
      responseTime,
      errorCount,
      successCount,
      availability,
      lastCheck: new Date(),
      circuitBreakerState,
    };
  }

  /**
   * Evaluate alert rules and trigger alerts
   */
  private async evaluateAlerts(): Promise<void> {
    const currentMetrics = this.getCurrentMetrics();

    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldownPeriod * 1000) {
          continue;
        }
      }

      try {
        const shouldTrigger = await this.evaluateAlertCondition(
          rule,
          currentMetrics
        );

        if (shouldTrigger) {
          await this.triggerAlert(rule, currentMetrics);
        }
      } catch (error) {
        structuredLogger.error("Failed to evaluate alert rule", {
          ruleId,
          ruleName: rule.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Evaluate individual alert condition
   */
  private async evaluateAlertCondition(
    rule: DomainAlertRule,
    metrics: MetricsData
  ): Promise<boolean> {
    switch (rule.id) {
      case "high_error_rate":
        return metrics.errorRate > rule.threshold;

      case "slow_response_time":
        return metrics.averageResponseTime > rule.threshold;

      case "high_memory_usage":
        const memoryPercent =
          (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
        return memoryPercent > rule.threshold;

      case "database_connection_failure":
        const dbHealth = metrics.services.find(
          (s) => s.serviceName === "database"
        );
        return dbHealth?.status === "unhealthy";

      case "circuit_breaker_open":
        return Object.values(metrics.circuitBreakers).some(
          (cb) => cb.state === "OPEN"
        );

      case "oauth_failure_rate":
        const oauthErrors = Object.entries(metrics.errorMetrics)
          .filter(([key]) => key.includes("oauth"))
          .reduce((sum, [, metric]) => sum + (metric?.errorCount || 0), 0);
        const oauthTotal = oauthErrors + 100; // Simplified calculation
        return (
          oauthTotal > 0 && (oauthErrors / oauthTotal) * 100 > rule.threshold
        );

      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(
    rule: DomainAlertRule,
    metrics: MetricsData
  ): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;
    const alert: DomainAlert = {
      id: alertId,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.description}`,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule: rule.name,
        condition: rule.condition,
        threshold: rule.threshold,
        currentValue: this.getCurrentValueForRule(rule, metrics),
      },
    };

    this.activeAlerts.set(alertId, alert);
    rule.lastTriggered = new Date();

    structuredLogger.error("Alert triggered", {
      alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metadata: alert.metadata,
    });

    // Send notification
    try {
      await this.notificationService.sendAlert({
        id: alertId,
        severity: rule.severity,
        title: rule.name,
        message: alert.message,
        timestamp: alert.timestamp,
        metadata: alert.metadata,
      });
    } catch (notificationError) {
      structuredLogger.error("Failed to send alert notification", {
        alertId,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }
  }

  /**
   * Get current value for alert rule evaluation
   */
  private getCurrentValueForRule(
    rule: DomainAlertRule,
    metrics: MetricsData
  ): number {
    switch (rule.id) {
      case "high_error_rate":
        return metrics.errorRate;
      case "slow_response_time":
        return metrics.averageResponseTime;
      case "high_memory_usage":
        return (
          (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100
        );
      default:
        return 0; // Return 0 instead of "unknown" to maintain number type
    }
  }

  /**
   * Get current comprehensive metrics
   */
  private getCurrentMetrics(): MetricsData {
    const latestPerformance =
      this.performanceHistory[this.performanceHistory.length - 1];
    const services: ServiceHealthMetrics[] = [];

    for (const [serviceName, history] of this.serviceHealthHistory.entries()) {
      if (history.length > 0) {
        services.push(history[history.length - 1]);
      }
    }

    // Provide default values if no performance history exists
    const defaultMetrics: MetricsData = {
      timestamp: new Date(),
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      responseTime: 0,
      throughput: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      queueSize: 0,
      services,
      circuitBreakers: this.circuitBreakerRegistry.getAllStats(),
      errorMetrics: this.errorHandlerService.getErrorMetrics(),
    };

    if (!latestPerformance) {
      return defaultMetrics;
    }

    return {
      ...latestPerformance,
      responseTime: latestPerformance.averageResponseTime, // Map averageResponseTime to responseTime for compatibility
      services,
      circuitBreakers: this.circuitBreakerRegistry.getAllStats(),
      errorMetrics: this.errorHandlerService.getErrorMetrics(),
    };
  }

  /**
   * Record request metrics for monitoring
   */
  public recordRequest(
    endpoint: string,
    responseTime: number,
    isError: boolean = false
  ): void {
    const existing = this.requestMetrics.get(endpoint) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      responseTimes: [],
    };

    existing.count++;
    existing.totalTime += responseTime;
    existing.responseTimes.push(responseTime);

    // Keep only last 1000 response times for percentile calculations
    if (existing.responseTimes.length > 1000) {
      existing.responseTimes = existing.responseTimes.slice(-1000);
    }

    if (isError) {
      existing.errors++;
    }

    this.requestMetrics.set(endpoint, existing);
  }

  /**
   * Record business metric
   */
  public recordBusinessMetric(metricName: string, value: number): void {
    this.businessMetrics.set(metricName, value);

    structuredLogger.debug("Business metric recorded", {
      metricName,
      value,
    });
  }

  /**
   * Record custom metric
   */
  public recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    description: string = ""
  ): void {
    const metric: CustomMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      description,
    };

    this.customMetrics.set(name, metric);

    structuredLogger.debug("Custom metric recorded", {
      name,
      value,
      unit,
      tags,
    });
  }

  /**
   * Collect APM metrics
   */
  private async collectAPMMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // Calculate application performance metrics
      const allResponseTimes = Array.from(this.requestMetrics.values()).flatMap(
        (metric) => metric.responseTimes
      );

      const totalRequests = Array.from(this.requestMetrics.values()).reduce(
        (sum, metric) => sum + metric.count,
        0
      );

      const totalErrors = Array.from(this.requestMetrics.values()).reduce(
        (sum, metric) => sum + metric.errors,
        0
      );

      const errorRate =
        totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Calculate percentiles
      const sortedResponseTimes = allResponseTimes.sort((a, b) => a - b);
      const responseTimeP50 = this.calculatePercentile(sortedResponseTimes, 50);
      const responseTimeP95 = this.calculatePercentile(sortedResponseTimes, 95);
      const responseTimeP99 = this.calculatePercentile(sortedResponseTimes, 99);

      // Calculate APDEX (Application Performance Index)
      // Satisfied: <= 500ms, Tolerating: <= 2000ms, Frustrated: > 2000ms
      const satisfiedRequests = allResponseTimes.filter((t) => t <= 500).length;
      const toleratingRequests = allResponseTimes.filter(
        (t) => t > 500 && t <= 2000
      ).length;
      const totalApdexRequests = allResponseTimes.length;
      const apdex =
        totalApdexRequests > 0
          ? (satisfiedRequests + toleratingRequests * 0.5) / totalApdexRequests
          : 1;

      // Get system resource metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Calculate resource utilization percentages
      const memoryUsagePercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      // Get business metrics
      const emailsProcessedPerHour =
        this.businessMetrics.get("emails_processed_per_hour") || 0;
      const scheduleCreationSuccessRate =
        this.businessMetrics.get("schedule_creation_success_rate") || 100;
      const calendarEventCreationRate =
        this.businessMetrics.get("calendar_event_creation_rate") || 100;
      const notificationDeliveryRate =
        this.businessMetrics.get("notification_delivery_rate") || 100;
      const oauthTokenRefreshRate =
        this.businessMetrics.get("oauth_token_refresh_rate") || 100;

      const apmMetrics: APMMetrics = {
        applicationPerformance: {
          throughput: totalRequests, // requests per collection interval
          responseTimeP50,
          responseTimeP95,
          responseTimeP99,
          errorRate,
          apdex,
        },
        businessMetrics: {
          emailsProcessedPerHour,
          scheduleCreationSuccessRate,
          calendarEventCreationRate,
          notificationDeliveryRate,
          oauthTokenRefreshRate,
        },
        resourceUtilization: {
          cpuUsagePercent,
          memoryUsagePercent,
          diskUsagePercent: await this.getDiskUsagePercent(),
          networkIOBytes: await this.getNetworkIOBytes(),
          databaseConnectionsActive: await this.getDatabaseConnectionsActive(),
          redisConnectionsActive: await this.getRedisConnectionsActive(),
        },
        customMetrics: Object.fromEntries(
          Array.from(this.customMetrics.entries()).map(([key, metric]) => [
            key,
            metric.value,
          ])
        ),
      };

      // Store APM metrics
      this.apmMetricsHistory.push(apmMetrics);

      // Trim history
      if (this.apmMetricsHistory.length > this.MAX_HISTORY_SIZE) {
        this.apmMetricsHistory = this.apmMetricsHistory.slice(
          -this.MAX_HISTORY_SIZE
        );
      }

      structuredLogger.debug("APM metrics collected", {
        throughput: apmMetrics.applicationPerformance.throughput,
        apdex: apmMetrics.applicationPerformance.apdex,
        errorRate: apmMetrics.applicationPerformance.errorRate,
        p99ResponseTime: apmMetrics.applicationPerformance.responseTimeP99,
        memoryUsagePercent,
        cpuUsagePercent,
      });
    } catch (error) {
      structuredLogger.error("Failed to collect APM metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(
    sortedArray: number[],
    percentile: number
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Get monitoring dashboard data
   */
  public async getMonitoringDashboard(): Promise<MonitoringDashboard> {
    const latestMetrics =
      this.performanceHistory[this.performanceHistory.length - 1];
    const latestAPMMetrics =
      this.apmMetricsHistory[this.apmMetricsHistory.length - 1];
    const services: ServiceHealthMetrics[] = [];

    for (const [serviceName, history] of this.serviceHealthHistory.entries()) {
      if (history.length > 0) {
        services.push(history[history.length - 1]);
      }
    }

    const unhealthyServices = services.filter(
      (s) => s.status === "unhealthy"
    ).length;
    const degradedServices = services.filter(
      (s) => s.status === "degraded"
    ).length;

    let systemStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (unhealthyServices > 0) {
      systemStatus = "unhealthy";
    } else if (degradedServices > 0) {
      systemStatus = "degraded";
    }

    // Also consider APM metrics for system status
    if (latestAPMMetrics) {
      if (
        latestAPMMetrics.applicationPerformance.apdex < 0.5 ||
        latestAPMMetrics.applicationPerformance.errorRate > 10
      ) {
        systemStatus = "unhealthy";
      } else if (
        latestAPMMetrics.applicationPerformance.apdex < 0.7 ||
        latestAPMMetrics.applicationPerformance.errorRate > 5
      ) {
        systemStatus = systemStatus === "healthy" ? "degraded" : systemStatus;
      }
    }

    return {
      systemOverview: {
        status: systemStatus,
        uptime: process.uptime(),
        totalRequests: latestMetrics?.requestCount || 0,
        errorRate: latestMetrics?.errorRate || 0,
        averageResponseTime: latestMetrics?.averageResponseTime || 0,
      },
      services,
      performance: latestMetrics || this.getDefaultPerformanceMetrics(),
      apmMetrics: latestAPMMetrics || this.getDefaultAPMMetrics(),
      alerts: Array.from(this.activeAlerts.values()).filter(
        (alert) => !alert.resolved
      ),
      circuitBreakers: this.circuitBreakerRegistry.getAllStats(),
      errorMetrics: this.errorHandlerService.getErrorMetrics(),
      criticalFailures: this.errorHandlerService.getCriticalFailures(),
      customMetrics: this.getCustomMetrics(),
    };
  }

  /**
   * Get default APM metrics
   */
  private getDefaultAPMMetrics(): APMMetrics {
    return {
      applicationPerformance: {
        throughput: 0,
        responseTimeP50: 0,
        responseTimeP95: 0,
        responseTimeP99: 0,
        errorRate: 0,
        apdex: 1,
      },
      businessMetrics: {
        emailsProcessedPerHour: 0,
        scheduleCreationSuccessRate: 100,
        calendarEventCreationRate: 100,
        notificationDeliveryRate: 100,
        oauthTokenRefreshRate: 100,
      },
      resourceUtilization: {
        cpuUsagePercent: 0,
        memoryUsagePercent: 0,
        diskUsagePercent: 0,
        networkIOBytes: 0,
        databaseConnectionsActive: 0,
        redisConnectionsActive: 0,
      },
      customMetrics: {},
    };
  }

  /**
   * Get performance history for charts
   */
  public getPerformanceHistory(hours: number = 24): PerformanceMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(
      (metric) => metric.timestamp >= cutoffTime
    );
  }

  /**
   * Get service health history
   */
  public getServiceHealthHistory(
    serviceName: string,
    hours: number = 24
  ): ServiceHealthMetrics[] {
    const history = this.serviceHealthHistory.get(serviceName) || [];
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.filter((metric) => metric.lastCheck >= cutoffTime);
  }

  /**
   * Add custom alert rule
   */
  public addAlertRule(rule: DomainAlertRule): void {
    this.alertRules.set(rule.id, rule);
    structuredLogger.info("Alert rule added", {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
    });
  }

  /**
   * Update alert rule
   */
  public updateAlertRule(
    ruleId: string,
    updates: Partial<DomainAlertRule>
  ): boolean {
    const existing = this.alertRules.get(ruleId);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.alertRules.set(ruleId, updated);

    structuredLogger.info("Alert rule updated", {
      ruleId,
      updates: Object.keys(updates),
    });

    return true;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId) as DomainAlert | undefined;
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();

    structuredLogger.info("Alert resolved", {
      alertId,
      ruleId: alert.ruleId,
      resolvedAt: alert.resolvedAt,
    });

    return true;
  }

  /**
   * Get active connection count (simplified implementation)
   */
  private async getActiveConnectionCount(): Promise<number> {
    try {
      // This would typically query the connection pool
      // For now, return a placeholder
      return 5;
    } catch {
      return 0;
    }
  }

  /**
   * Get queue size (simplified implementation)
   */
  private async getQueueSize(): Promise<number> {
    try {
      // This would typically query the job queue
      // For now, return a placeholder
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get default performance metrics
   */
  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      queueSize: 0,
    };
  }

  /**
   * Get disk usage percentage (simplified implementation)
   */
  private async getDiskUsagePercent(): Promise<number> {
    try {
      // This would typically use a system monitoring library
      // For now, return a placeholder based on available space
      return 45; // Placeholder: 45% disk usage
    } catch {
      return 0;
    }
  }

  /**
   * Get network I/O bytes (simplified implementation)
   */
  private async getNetworkIOBytes(): Promise<number> {
    try {
      // This would typically monitor actual network I/O
      // For now, return a placeholder
      return 1024 * 1024; // Placeholder: 1MB
    } catch {
      return 0;
    }
  }

  /**
   * Get active database connections
   */
  private async getDatabaseConnectionsActive(): Promise<number> {
    try {
      // This would query the actual connection pool
      // For now, return a placeholder
      return 5; // Placeholder: 5 active connections
    } catch {
      return 0;
    }
  }

  /**
   * Get active Redis connections
   */
  private async getRedisConnectionsActive(): Promise<number> {
    try {
      // This would query the Redis connection pool
      // For now, return a placeholder
      return 2; // Placeholder: 2 active connections
    } catch {
      return 0;
    }
  }

  /**
   * Evaluate advanced alerting rules
   */
  private async evaluateAdvancedAlerts(): Promise<void> {
    const latestAPMMetrics =
      this.apmMetricsHistory[this.apmMetricsHistory.length - 1];
    if (!latestAPMMetrics) return;

    for (const [ruleId, rule] of this.alertingRules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        (alert) => alert.ruleId === ruleId && !alert.resolved
      );

      if (existingAlert) {
        const timeSinceTriggered =
          Date.now() - existingAlert.timestamp.getTime();
        if (timeSinceTriggered < rule.cooldownPeriod * 1000) {
          continue;
        }
      }

      try {
        const shouldTrigger = await this.evaluateAdvancedAlertCondition(
          rule,
          latestAPMMetrics
        );

        if (shouldTrigger) {
          await this.triggerAdvancedAlert(rule, latestAPMMetrics);
        }
      } catch (error) {
        structuredLogger.error("Failed to evaluate advanced alert rule", {
          ruleId,
          ruleName: rule.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Evaluate advanced alert condition
   */
  private async evaluateAdvancedAlertCondition(
    rule: AlertingRule,
    metrics: APMMetrics
  ): Promise<boolean> {
    switch (rule.id) {
      case "apdex_degradation":
        return metrics.applicationPerformance.apdex < rule.threshold;

      case "p99_response_time":
        return metrics.applicationPerformance.responseTimeP99 > rule.threshold;

      case "email_processing_failure_rate":
        return (
          metrics.businessMetrics.scheduleCreationSuccessRate < rule.threshold
        );

      case "calendar_creation_failure_spike":
        return (
          100 - metrics.businessMetrics.calendarEventCreationRate >
          rule.threshold
        );

      case "oauth_token_refresh_failure":
        return (
          100 - metrics.businessMetrics.oauthTokenRefreshRate > rule.threshold
        );

      case "resource_exhaustion_cpu":
        return metrics.resourceUtilization.cpuUsagePercent > rule.threshold;

      case "resource_exhaustion_memory":
        return metrics.resourceUtilization.memoryUsagePercent > rule.threshold;

      case "database_connection_pool_exhaustion":
        return (
          metrics.resourceUtilization.databaseConnectionsActive > rule.threshold
        );

      case "notification_delivery_failure":
        return (
          metrics.businessMetrics.notificationDeliveryRate < rule.threshold
        );

      default:
        return false;
    }
  }

  /**
   * Trigger advanced alert
   */
  private async triggerAdvancedAlert(
    rule: AlertingRule,
    metrics: APMMetrics
  ): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;
    const currentValue = this.getCurrentValueForAdvancedRule(rule, metrics);

    const alert: DomainAlert = {
      id: alertId,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.description}`,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule: rule.name,
        condition: rule.condition,
        threshold: rule.threshold,
        currentValue,
        category: rule.metadata.category,
        ...rule.metadata,
      },
    };

    this.activeAlerts.set(alertId, alert);

    structuredLogger.error("Advanced alert triggered", {
      alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      currentValue,
      threshold: rule.threshold,
      metadata: alert.metadata,
    });

    // Send notification through configured channels
    try {
      await this.notificationService.sendAlert({
        id: alertId,
        severity: rule.severity,
        title: rule.name,
        message: alert.message,
        timestamp: alert.timestamp,
        metadata: alert.metadata,
      });
    } catch (notificationError) {
      structuredLogger.error("Failed to send advanced alert notification", {
        alertId,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }
  }

  /**
   * Get current value for advanced alert rule evaluation
   */
  private getCurrentValueForAdvancedRule(
    rule: AlertingRule,
    metrics: APMMetrics
  ): number {
    switch (rule.id) {
      case "apdex_degradation":
        return metrics.applicationPerformance.apdex;
      case "p99_response_time":
        return metrics.applicationPerformance.responseTimeP99;
      case "email_processing_failure_rate":
        return metrics.businessMetrics.scheduleCreationSuccessRate;
      case "calendar_creation_failure_spike":
        return 100 - metrics.businessMetrics.calendarEventCreationRate;
      case "oauth_token_refresh_failure":
        return 100 - metrics.businessMetrics.oauthTokenRefreshRate;
      case "resource_exhaustion_cpu":
        return metrics.resourceUtilization.cpuUsagePercent;
      case "resource_exhaustion_memory":
        return metrics.resourceUtilization.memoryUsagePercent;
      case "database_connection_pool_exhaustion":
        return metrics.resourceUtilization.databaseConnectionsActive;
      case "notification_delivery_failure":
        return metrics.businessMetrics.notificationDeliveryRate;
      default:
        return 0; // Return 0 instead of "unknown" to maintain number type
    }
  }

  /**
   * Get APM metrics history
   */
  public getAPMMetricsHistory(hours: number = 24): APMMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.apmMetricsHistory.filter(
      (metric) => new Date() >= cutoffTime // Simplified time filtering
    );
  }

  /**
   * Get custom metrics
   */
  public getCustomMetrics(): CustomMetric[] {
    return Array.from(this.customMetrics.values());
  }

  /**
   * Add or update alerting rule
   */
  public addAlertingRule(rule: AlertingRule): void {
    this.alertingRules.set(rule.id, rule);
    structuredLogger.info("Advanced alerting rule added", {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      category: rule.metadata.category,
    });
  }

  /**
   * Update alerting rule
   */
  public updateAlertingRule(
    ruleId: string,
    updates: Partial<AlertingRule>
  ): boolean {
    const existing = this.alertingRules.get(ruleId);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.alertingRules.set(ruleId, updated);

    structuredLogger.info("Advanced alerting rule updated", {
      ruleId,
      updates: Object.keys(updates),
    });

    return true;
  }

  /**
   * Get all alerting rules
   */
  public getAlertingRules(): AlertingRule[] {
    return Array.from(this.alertingRules.values());
  }
}
