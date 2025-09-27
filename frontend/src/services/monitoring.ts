import { api } from "./api";

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
  circuitBreakers: Record<string, any>;
  errorMetrics: Record<string, any>;
  criticalFailures: any[];
  customMetrics: CustomMetric[];
}

export interface ServiceHealthMetrics {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, any>;
}

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

export interface APMMetrics {
  applicationPerformance: {
    throughput: number;
    responseTimeP50: number;
    responseTimeP95: number;
    responseTimeP99: number;
    errorRate: number;
    apdex: number;
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
  cooldownPeriod: number;
  escalationPolicy?: string;
  notificationChannels: string[];
  metadata: Record<string, any>;
}

export interface PerformanceHistory {
  timeRange: string;
  dataPoints: number;
  data: PerformanceMetrics[];
}

export interface APMHistory {
  timeRange: string;
  dataPoints: number;
  data: APMMetrics[];
  summary: {
    averageApdex: number;
    averageErrorRate: number;
    averageP99ResponseTime: number;
  };
}

export interface ServiceHealthHistory {
  serviceName: string;
  timeRange: string;
  dataPoints: number;
  data: ServiceHealthMetrics[];
}

class MonitoringService {
  /**
   * Get comprehensive monitoring dashboard
   */
  async getDashboard(): Promise<MonitoringDashboard> {
    return api.get<MonitoringDashboard>("/monitoring/dashboard");
  }

  /**
   * Get performance metrics history
   */
  async getPerformanceHistory(hours: number = 24): Promise<PerformanceHistory> {
    return api.get<PerformanceHistory>(
      `/monitoring/performance/history?hours=${hours}`
    );
  }

  /**
   * Get APM metrics history
   */
  async getAPMHistory(hours: number = 24): Promise<APMHistory> {
    return api.get<APMHistory>(`/monitoring/apm/history?hours=${hours}`);
  }

  /**
   * Get service health history
   */
  async getServiceHealthHistory(
    serviceName: string,
    hours: number = 24
  ): Promise<ServiceHealthHistory> {
    return api.get<ServiceHealthHistory>(
      `/monitoring/services/${serviceName}/history?hours=${hours}`
    );
  }

  /**
   * Get error metrics and statistics
   */
  async getErrorMetrics(): Promise<{
    errorMetrics: Record<string, any>;
    criticalFailures: any[];
    summary: {
      totalErrorTypes: number;
      totalCriticalFailures: number;
      recentCriticalFailures: number;
    };
  }> {
    return api.get<{
      errorMetrics: Record<string, any>;
      criticalFailures: any[];
      summary: {
        totalErrorTypes: number;
        totalCriticalFailures: number;
        recentCriticalFailures: number;
      };
    }>("/monitoring/errors/metrics");
  }

  /**
   * Get circuit breaker status
   */
  async getCircuitBreakerStatus(): Promise<{
    circuitBreakers: Record<string, any>;
    summary: {
      total: number;
      open: number;
      halfOpen: number;
      closed: number;
    };
  }> {
    return api.get<{
      circuitBreakers: Record<string, any>;
      summary: {
        total: number;
        open: number;
        halfOpen: number;
        closed: number;
      };
    }>("/monitoring/circuit-breakers");
  }

  /**
   * Reset circuit breakers
   */
  async resetCircuitBreakers(serviceName?: string): Promise<void> {
    await api.post("/monitoring/circuit-breakers/reset", { serviceName });
  }

  /**
   * Get custom metrics
   */
  async getCustomMetrics(): Promise<{
    metrics: CustomMetric[];
    count: number;
  }> {
    return api.get<{
      metrics: CustomMetric[];
      count: number;
    }>("/monitoring/metrics/custom");
  }

  /**
   * Record custom metric
   */
  async recordCustomMetric(
    name: string,
    value: number,
    unit: string = "count",
    tags: Record<string, string> = {},
    description: string = ""
  ): Promise<void> {
    await api.post("/monitoring/metrics/custom", {
      name,
      value,
      unit,
      tags,
      description,
    });
  }

  /**
   * Get alerting rules
   */
  async getAlertingRules(): Promise<{
    rules: AlertingRule[];
    summary: {
      total: number;
      enabled: number;
      disabled: number;
      bySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
      };
    };
  }> {
    return api.get<{
      rules: AlertingRule[];
      summary: {
        total: number;
        enabled: number;
        disabled: number;
        bySeverity: {
          critical: number;
          high: number;
          medium: number;
          low: number;
        };
      };
    }>("/monitoring/alerts/rules");
  }

  /**
   * Update alerting rule
   */
  async updateAlertingRule(
    ruleId: string,
    updates: Partial<AlertingRule>
  ): Promise<void> {
    await api.put(`/monitoring/alerts/rules/${ruleId}`, updates);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await api.post(`/monitoring/alerts/${alertId}/resolve`);
  }

  /**
   * Trigger test alert (development only)
   */
  async triggerTestAlert(
    alertType: string,
    severity: string = "medium",
    metricValue?: number
  ): Promise<void> {
    await api.post("/monitoring/test/alert", {
      alertType,
      severity,
      metricValue,
    });
  }

  /**
   * Get basic health check
   */
  async getHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: ServiceHealthMetrics[];
    metrics: any;
  }> {
    return api.get<{
      status: "healthy" | "degraded" | "unhealthy";
      timestamp: string;
      uptime: number;
      version: string;
      environment: string;
      services: ServiceHealthMetrics[];
      metrics: any;
    }>("/monitoring/health");
  }

  /**
   * Get detailed health check
   */
  async getDetailedHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: ServiceHealthMetrics[];
    metrics: any;
    circuitBreakers?: Record<string, any>;
  }> {
    return api.get<{
      status: "healthy" | "degraded" | "unhealthy";
      timestamp: string;
      uptime: number;
      version: string;
      environment: string;
      services: ServiceHealthMetrics[];
      metrics: any;
      circuitBreakers?: Record<string, any>;
    }>("/monitoring/health/detailed");
  }

  /**
   * Get readiness probe status
   */
  async getReadiness(): Promise<{
    status: "ready" | "not_ready";
    timestamp: string;
    services: ServiceHealthMetrics[];
  }> {
    return api.get<{
      status: "ready" | "not_ready";
      timestamp: string;
      services: ServiceHealthMetrics[];
    }>("/monitoring/health/readiness");
  }

  /**
   * Get liveness probe status
   */
  async getLiveness(): Promise<{
    status: "alive" | "dead";
    timestamp: string;
    uptime: number;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  }> {
    return api.get<{
      status: "alive" | "dead";
      timestamp: string;
      uptime: number;
      memory: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
      };
    }>("/monitoring/health/liveness");
  }
}

export const monitoringService = new MonitoringService();
