import { api } from "./api";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface MemoryUsageSnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface CpuUsageSnapshot {
  user: number;
  system: number;
}

export interface PerformanceMetrics {
  timestamp: string;
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: MemoryUsageSnapshot;
  cpuUsage: CpuUsageSnapshot;
  activeConnections: number;
  queueSize: number;
}

export interface ServiceHealthMetrics {
  serviceName: string;
  status: HealthStatus;
  responseTime: number;
  errorCount: number;
  successCount: number;
  availability: number;
  lastCheck: string;
  circuitBreakerState?: CircuitBreakerState;
  error?: string;
  details?: Record<string, unknown>;
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

export interface MonitoringAlert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata: Record<string, unknown>;
}

export interface CustomMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
  description: string;
}

export interface AlertingRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownPeriod: number;
  escalationPolicy?: string;
  notificationChannels: string[];
  metadata: Record<string, unknown>;
}

export interface CriticalServiceFailure {
  serviceName: string;
  errorCode: string;
  failureTime: string;
  impact: "low" | "medium" | "high" | "critical";
  affectedOperations: string[];
  estimatedRecoveryTime?: number;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastErrorTime: string;
  recoveryCount: number;
  fallbackUsageCount: number;
  averageRecoveryTime: number;
}

export interface CircuitBreakerStatsResponse {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: string;
  nextAttemptTime?: string;
}

export interface MonitoringDashboard {
  systemOverview: {
    status: HealthStatus;
    uptime: number;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
  services: ServiceHealthMetrics[];
  performance: PerformanceMetrics;
  apmMetrics: APMMetrics;
  alerts: MonitoringAlert[];
  circuitBreakers: Record<string, CircuitBreakerStatsResponse>;
  errorMetrics: Record<string, ErrorMetrics>;
  criticalFailures: CriticalServiceFailure[];
  customMetrics: CustomMetric[];
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

export interface ErrorMetricsResponse {
  errorMetrics: Record<string, ErrorMetrics>;
  criticalFailures: CriticalServiceFailure[];
  summary: {
    totalErrorTypes: number;
    totalCriticalFailures: number;
    recentCriticalFailures: number;
  };
}

export interface CircuitBreakerStatusResponse {
  circuitBreakers: Record<string, CircuitBreakerStatsResponse>;
  summary: {
    total: number;
    open: number;
    halfOpen: number;
    closed: number;
  };
}

export interface CustomMetricsResponse {
  metrics: CustomMetric[];
  count: number;
}

export interface AlertingRulesResponse {
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

export interface HealthServiceStatus {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface HealthStatusResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: HealthServiceStatus[];
  metrics: SystemMetrics;
  circuitBreakers?: Record<string, CircuitBreakerStatsResponse>;
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  timestamp: string;
  services: HealthServiceStatus[];
}

export interface LivenessResponse {
  status: "alive" | "dead";
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

class MonitoringService {
  async getDashboard(): Promise<MonitoringDashboard> {
    return api.get<MonitoringDashboard>("/api/monitoring/dashboard");
  }

  async getPerformanceHistory(hours = 24): Promise<PerformanceHistory> {
    return api.get<PerformanceHistory>(
      `/api/monitoring/performance/history?hours=${hours}`
    );
  }

  async getAPMHistory(hours = 24): Promise<APMHistory> {
    return api.get<APMHistory>(`/api/monitoring/apm/history?hours=${hours}`);
  }

  async getServiceHealthHistory(
    serviceName: string,
    hours = 24
  ): Promise<ServiceHealthHistory> {
    return api.get<ServiceHealthHistory>(
      `/api/monitoring/services/${serviceName}/history?hours=${hours}`
    );
  }

  async getErrorMetrics(): Promise<ErrorMetricsResponse> {
    return api.get<ErrorMetricsResponse>("/api/monitoring/errors/metrics");
  }

  async getCircuitBreakerStatus(): Promise<CircuitBreakerStatusResponse> {
    return api.get<CircuitBreakerStatusResponse>(
      "/api/monitoring/circuit-breakers"
    );
  }

  async resetCircuitBreakers(serviceName?: string): Promise<void> {
    await api.post("/api/monitoring/circuit-breakers/reset", { serviceName });
  }

  async getCustomMetrics(): Promise<CustomMetricsResponse> {
    return api.get<CustomMetricsResponse>("/api/monitoring/metrics/custom");
  }

  async recordCustomMetric(
    name: string,
    value: number,
    unit = "count",
    tags: Record<string, string> = {},
    description = ""
  ): Promise<void> {
    await api.post("/api/monitoring/metrics/custom", {
      name,
      value,
      unit,
      tags,
      description,
    });
  }

  async getAlertingRules(): Promise<AlertingRulesResponse> {
    return api.get<AlertingRulesResponse>("/api/monitoring/alerts/rules");
  }

  async updateAlertingRule(
    ruleId: string,
    updates: Partial<AlertingRule>
  ): Promise<void> {
    await api.put(`/api/monitoring/alerts/rules/${ruleId}`, updates);
  }

  async resolveAlert(alertId: string): Promise<void> {
    await api.post(`/api/monitoring/alerts/${alertId}/resolve`);
  }

  async triggerTestAlert(
    alertType: string,
    severity: AlertSeverity = "medium",
    metricValue?: number
  ): Promise<void> {
    await api.post("/api/monitoring/test/alert", {
      alertType,
      severity,
      metricValue,
    });
  }

  async getHealth(): Promise<HealthStatusResponse> {
    return api.get<HealthStatusResponse>("/api/monitoring/health");
  }

  async getDetailedHealth(): Promise<HealthStatusResponse> {
    return api.get<HealthStatusResponse>("/api/monitoring/health/detailed");
  }

  async getReadiness(): Promise<ReadinessResponse> {
    return api.get<ReadinessResponse>("/api/monitoring/health/readiness");
  }

  async getLiveness(): Promise<LivenessResponse> {
    return api.get<LivenessResponse>("/api/monitoring/health/liveness");
  }
}

export const monitoringService = new MonitoringService();
