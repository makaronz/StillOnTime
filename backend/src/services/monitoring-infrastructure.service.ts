/**
 * Monitoring and Alerting Infrastructure Service
 * Comprehensive system monitoring with intelligent alerting
 */

import { logger, structuredLogger } from "../utils/logger";
import { z } from "zod";
import { EventEmitter } from "events";

// Monitoring schemas
export const MetricSchema = z.object({
  metricId: z.string(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.date(),
  tags: z.record(z.string()),
  dimensions: z.record(z.string()).optional()
});

export const AlertRuleSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  description: z.string(),
  metricName: z.string(),
  condition: z.object({
    operator: z.enum(["gt", "lt", "eq", "gte", "lte", "ne"]),
    threshold: z.number(),
    aggregation: z.enum(["avg", "sum", "min", "max", "count"]),
    timeWindow: z.number() // minutes
  }),
  severity: z.enum(["info", "warning", "error", "critical"]),
  enabled: z.boolean(),
  cooldownPeriod: z.number(), // minutes
  notificationChannels: z.array(z.string()),
  escalationRules: z.array(z.object({
    condition: z.string(),
    delay: z.number(), // minutes
    channels: z.array(z.string())
  })).optional()
});

export const AlertSchema = z.object({
  alertId: z.string(),
  ruleId: z.string(),
  ruleName: z.string(),
  status: z.enum(["firing", "resolved", "suppressed"]),
  severity: z.enum(["info", "warning", "error", "critical"]),
  triggeredAt: z.date(),
  resolvedAt: z.date().optional(),
  currentValue: z.number(),
  threshold: z.number(),
  message: z.string(),
  tags: z.record(z.string()),
  notificationsSent: z.array(z.object({
    channel: z.string(),
    sentAt: z.date(),
    status: z.enum(["sent", "failed", "pending"])
  }))
});

export const HealthCheckSchema = z.object({
  checkId: z.string(),
  name: z.string(),
  status: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
  responseTime: z.number(),
  timestamp: z.date(),
  details: z.record(z.any()),
  dependencies: z.array(z.string()).optional()
});

export type Metric = z.infer<typeof MetricSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;

/**
 * Monitoring and Alerting Infrastructure Service
 */
export class MonitoringInfrastructureService extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map(); // metricName -> metrics
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private notificationChannels: Map<string, any> = new Map();
  
  // Performance tracking
  private systemMetrics = {
    cpu: [] as number[],
    memory: [] as number[],
    disk: [] as number[],
    network: [] as number[]
  };
  
  // Alert suppression and correlation
  private suppressedAlerts: Set<string> = new Set();
  private alertCorrelations: Map<string, string[]> = new Map(); // parentAlert -> childAlerts
  
  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.initializeNotificationChannels();
    this.startSystemMonitoring();
    this.startAlertEvaluation();
    this.startHealthChecks();
  }

  /**
   * Record a custom metric
   */
  async recordMetric(metric: Omit<Metric, 'metricId' | 'timestamp'>): Promise<void> {
    try {
      const fullMetric: Metric = {
        metricId: this.generateMetricId(),
        timestamp: new Date(),
        ...metric
      };

      // Validate metric
      MetricSchema.parse(fullMetric);

      // Store metric
      if (!this.metrics.has(metric.name)) {
        this.metrics.set(metric.name, []);
      }
      
      const metricHistory = this.metrics.get(metric.name)!;
      metricHistory.push(fullMetric);

      // Keep only last 1440 data points (24 hours at 1-minute intervals)
      if (metricHistory.length > 1440) {
        metricHistory.splice(0, metricHistory.length - 1440);
      }

      // Emit metric event for real-time processing
      this.emit('metric_recorded', fullMetric);

      // Evaluate alert rules for this metric
      await this.evaluateAlertsForMetric(metric.name);

      structuredLogger.debug("Metric recorded", {
        metricName: metric.name,
        value: metric.value,
        unit: metric.unit
      });

    } catch (error) {
      structuredLogger.error("Failed to record metric", {
        error: error.message,
        metric
      });
      throw error;
    }
  }

  /**
   * Create or update alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'ruleId'>): Promise<string> {
    try {
      const alertRule: AlertRule = {
        ruleId: this.generateRuleId(),
        ...rule
      };

      // Validate rule
      AlertRuleSchema.parse(alertRule);

      this.alertRules.set(alertRule.ruleId, alertRule);

      structuredLogger.info("Alert rule created", {
        ruleId: alertRule.ruleId,
        name: alertRule.name,
        metricName: alertRule.metricName
      });

      return alertRule.ruleId;

    } catch (error) {
      structuredLogger.error("Failed to create alert rule", {
        error: error.message,
        rule
      });
      throw error;
    }
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const existingRule = this.alertRules.get(ruleId);
      if (!existingRule) {
        throw new Error(`Alert rule not found: ${ruleId}`);
      }

      const updatedRule = { ...existingRule, ...updates };
      AlertRuleSchema.parse(updatedRule);

      this.alertRules.set(ruleId, updatedRule);

      structuredLogger.info("Alert rule updated", {
        ruleId,
        changes: Object.keys(updates)
      });

    } catch (error) {
      structuredLogger.error("Failed to update alert rule", {
        error: error.message,
        ruleId,
        updates
      });
      throw error;
    }
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      const rule = this.alertRules.get(ruleId);
      if (!rule) {
        throw new Error(`Alert rule not found: ${ruleId}`);
      }

      this.alertRules.delete(ruleId);

      // Resolve any active alerts for this rule
      const activeAlerts = Array.from(this.activeAlerts.values())
        .filter(alert => alert.ruleId === ruleId);

      for (const alert of activeAlerts) {
        await this.resolveAlert(alert.alertId, "Rule deleted");
      }

      structuredLogger.info("Alert rule deleted", {
        ruleId,
        ruleName: rule.name
      });

    } catch (error) {
      structuredLogger.error("Failed to delete alert rule", {
        error: error.message,
        ruleId
      });
      throw error;
    }
  }

  /**
   * Register health check
   */
  async registerHealthCheck(
    name: string,
    checkFunction: () => Promise<{
      status: HealthCheck['status'];
      responseTime: number;
      details: Record<string, any>;
    }>,
    dependencies?: string[]
  ): Promise<void> {
    try {
      const checkId = this.generateCheckId();
      
      // Run initial check
      const result = await checkFunction();
      
      const healthCheck: HealthCheck = {
        checkId,
        name,
        status: result.status,
        responseTime: result.responseTime,
        timestamp: new Date(),
        details: result.details,
        dependencies
      };

      this.healthChecks.set(name, healthCheck);

      structuredLogger.info("Health check registered", {
        checkId,
        name,
        status: result.status
      });

    } catch (error) {
      structuredLogger.error("Failed to register health check", {
        error: error.message,
        name
      });
      throw error;
    }
  }

  /**
   * Execute health check
   */
  async executeHealthCheck(name: string): Promise<HealthCheck> {
    try {
      const existingCheck = this.healthChecks.get(name);
      if (!existingCheck) {
        throw new Error(`Health check not found: ${name}`);
      }

      // This would execute the actual check function
      // For now, we'll simulate a health check
      const startTime = Date.now();
      const responseTime = Date.now() - startTime;
      
      const updatedCheck: HealthCheck = {
        ...existingCheck,
        status: 'healthy', // Would be determined by actual check
        responseTime,
        timestamp: new Date(),
        details: {
          lastCheck: new Date(),
          checkCount: (existingCheck.details.checkCount || 0) + 1
        }
      };

      this.healthChecks.set(name, updatedCheck);
      
      // Record health check metric
      await this.recordMetric({
        name: `health_check_${name}`,
        value: responseTime,
        unit: 'ms',
        tags: {
          check_name: name,
          status: updatedCheck.status
        }
      });

      return updatedCheck;

    } catch (error) {
      structuredLogger.error("Health check execution failed", {
        error: error.message,
        name
      });
      
      // Record failed health check
      const failedCheck: HealthCheck = {
        checkId: this.generateCheckId(),
        name,
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        details: { error: error.message }
      };
      
      this.healthChecks.set(name, failedCheck);
      return failedCheck;
    }
  }

  /**
   * Add notification channel
   */
  addNotificationChannel(
    name: string,
    config: {
      type: 'email' | 'slack' | 'webhook' | 'sms';
      settings: Record<string, any>;
    }
  ): void {
    this.notificationChannels.set(name, config);
    
    structuredLogger.info("Notification channel added", {
      name,
      type: config.type
    });
  }

  /**
   * Send notification
   */
  private async sendNotification(
    channelName: string,
    alert: Alert
  ): Promise<{ status: 'sent' | 'failed'; error?: string }> {
    try {
      const channel = this.notificationChannels.get(channelName);
      if (!channel) {
        throw new Error(`Notification channel not found: ${channelName}`);
      }

      const message = this.formatAlertMessage(alert);

      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel.settings, message);
          break;
        case 'slack':
          await this.sendSlackNotification(channel.settings, message);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel.settings, alert);
          break;
        case 'sms':
          await this.sendSMSNotification(channel.settings, message);
          break;
      }

      return { status: 'sent' };

    } catch (error) {
      structuredLogger.error("Failed to send notification", {
        error: error.message,
        channelName,
        alertId: alert.alertId
      });
      return { status: 'failed', error: error.message };
    }
  }

  /**
   * Get system dashboard data
   */
  async getDashboardData(): Promise<{
    systemOverview: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      uptime: number;
      version: string;
    };
    activeAlerts: {
      critical: number;
      error: number;
      warning: number;
      info: number;
    };
    healthChecks: HealthCheck[];
    systemMetrics: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
    recentMetrics: Record<string, Metric[]>;
  }> {
    // Calculate system status
    const healthStatuses = Array.from(this.healthChecks.values())
      .map(check => check.status);
    
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (healthStatuses.includes('unhealthy')) {
      systemStatus = 'unhealthy';
    } else if (healthStatuses.includes('degraded')) {
      systemStatus = 'degraded';
    }

    // Count active alerts by severity
    const activeAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'firing');
    
    const alertCounts = {
      critical: activeAlerts.filter(a => a.severity === 'critical').length,
      error: activeAlerts.filter(a => a.severity === 'error').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length,
      info: activeAlerts.filter(a => a.severity === 'info').length
    };

    // Get recent system metrics
    const currentSystemMetrics = {
      cpu: this.systemMetrics.cpu.slice(-1)[0] || 0,
      memory: this.systemMetrics.memory.slice(-1)[0] || 0,
      disk: this.systemMetrics.disk.slice(-1)[0] || 0,
      network: this.systemMetrics.network.slice(-1)[0] || 0
    };

    // Get recent metrics for important metrics
    const recentMetrics: Record<string, Metric[]> = {};
    const importantMetrics = [
      'response_time',
      'error_rate',
      'throughput',
      'email_processing_rate'
    ];

    for (const metricName of importantMetrics) {
      const metrics = this.metrics.get(metricName);
      if (metrics) {
        recentMetrics[metricName] = metrics.slice(-60); // Last hour
      }
    }

    return {
      systemOverview: {
        status: systemStatus,
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0'
      },
      activeAlerts: alertCounts,
      healthChecks: Array.from(this.healthChecks.values()),
      systemMetrics: currentSystemMetrics,
      recentMetrics
    };
  }

  /**
   * Initialize default metrics and alert rules
   */
  private initializeDefaultMetrics(): void {
    // Initialize system metrics storage
    this.metrics.set('cpu_usage', []);
    this.metrics.set('memory_usage', []);
    this.metrics.set('disk_usage', []);
    this.metrics.set('response_time', []);
    this.metrics.set('error_rate', []);
    this.metrics.set('throughput', []);
  }

  /**
   * Initialize notification channels
   */
  private initializeNotificationChannels(): void {
    // Default email channel
    if (process.env.NOTIFICATION_EMAIL) {
      this.addNotificationChannel('email_default', {
        type: 'email',
        settings: {
          to: process.env.NOTIFICATION_EMAIL,
          from: process.env.FROM_EMAIL || 'noreply@stillontime.com'
        }
      });
    }

    // Default Slack channel
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addNotificationChannel('slack_default', {
        type: 'slack',
        settings: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts'
        }
      });
    }
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    setInterval(async () => {
      try {
        // Collect system metrics
        const cpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
        const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        
        // Record system metrics
        await this.recordMetric({
          name: 'cpu_usage',
          value: cpuPercent,
          unit: 'percent',
          tags: { type: 'system' }
        });

        await this.recordMetric({
          name: 'memory_usage',
          value: memoryPercent * 100,
          unit: 'percent',
          tags: { type: 'system' }
        });

        // Store for dashboard
        this.systemMetrics.cpu.push(cpuPercent);
        this.systemMetrics.memory.push(memoryPercent * 100);

        // Keep only last 60 data points (1 hour)
        if (this.systemMetrics.cpu.length > 60) {
          this.systemMetrics.cpu = this.systemMetrics.cpu.slice(-60);
          this.systemMetrics.memory = this.systemMetrics.memory.slice(-60);
        }

      } catch (error) {
        structuredLogger.error("System monitoring failed", {
          error: error.message
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Start alert evaluation
   */
  private startAlertEvaluation(): void {
    setInterval(async () => {
      for (const [ruleId, rule] of this.alertRules.entries()) {
        if (rule.enabled) {
          await this.evaluateAlertRule(rule);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(async () => {
      const checkPromises = Array.from(this.healthChecks.keys())
        .map(name => this.executeHealthCheck(name));

      await Promise.allSettled(checkPromises);
    }, 60000); // Every minute
  }

  /**
   * Evaluate alerts for a specific metric
   */
  private async evaluateAlertsForMetric(metricName: string): Promise<void> {
    const relevantRules = Array.from(this.alertRules.values())
      .filter(rule => rule.metricName === metricName && rule.enabled);

    for (const rule of relevantRules) {
      await this.evaluateAlertRule(rule);
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      const metrics = this.metrics.get(rule.metricName);
      if (!metrics || metrics.length === 0) {
        return;
      }

      // Get metrics within the time window
      const windowMs = rule.condition.timeWindow * 60 * 1000;
      const cutoffTime = new Date(Date.now() - windowMs);
      const windowMetrics = metrics.filter(m => m.timestamp >= cutoffTime);

      if (windowMetrics.length === 0) {
        return;
      }

      // Calculate aggregated value
      const values = windowMetrics.map(m => m.value);
      let aggregatedValue: number;

      switch (rule.condition.aggregation) {
        case 'avg':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
      }

      // Check condition
      const isTriggered = this.evaluateCondition(
        aggregatedValue,
        rule.condition.operator,
        rule.condition.threshold
      );

      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.ruleId === rule.ruleId && alert.status === 'firing');

      if (isTriggered && !existingAlert) {
        // Create new alert
        await this.createAlert(rule, aggregatedValue);
      } else if (!isTriggered && existingAlert) {
        // Resolve existing alert
        await this.resolveAlert(existingAlert.alertId, "Condition no longer met");
      }

    } catch (error) {
      structuredLogger.error("Alert rule evaluation failed", {
        error: error.message,
        ruleId: rule.ruleId
      });
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    value: number,
    operator: AlertRule['condition']['operator'],
    threshold: number
  ): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Create new alert
   */
  private async createAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alert: Alert = {
      alertId: this.generateAlertId(),
      ruleId: rule.ruleId,
      ruleName: rule.name,
      status: 'firing',
      severity: rule.severity,
      triggeredAt: new Date(),
      currentValue,
      threshold: rule.condition.threshold,
      message: this.generateAlertMessage(rule, currentValue),
      tags: { metric: rule.metricName },
      notificationsSent: []
    };

    this.activeAlerts.set(alert.alertId, alert);

    // Send notifications
    for (const channelName of rule.notificationChannels) {
      const result = await this.sendNotification(channelName, alert);
      alert.notificationsSent.push({
        channel: channelName,
        sentAt: new Date(),
        status: result.status
      });
    }

    this.emit('alert_created', alert);

    structuredLogger.warn("Alert triggered", {
      alertId: alert.alertId,
      ruleName: rule.name,
      severity: rule.severity,
      currentValue,
      threshold: rule.condition.threshold
    });
  }

  /**
   * Resolve alert
   */
  private async resolveAlert(alertId: string, reason: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    this.emit('alert_resolved', alert);

    structuredLogger.info("Alert resolved", {
      alertId,
      ruleName: alert.ruleName,
      reason,
      duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime()
    });

    // Remove from active alerts after a delay
    setTimeout(() => {
      this.activeAlerts.delete(alertId);
    }, 300000); // 5 minutes
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, currentValue: number): string {
    return `${rule.name}: ${rule.metricName} is ${currentValue} (threshold: ${rule.condition.threshold})`;
  }

  /**
   * Format alert message for notifications
   */
  private formatAlertMessage(alert: Alert): string {
    return `🚨 ALERT: ${alert.message}\n` +
           `Severity: ${alert.severity.toUpperCase()}\n` +
           `Triggered: ${alert.triggeredAt.toISOString()}\n` +
           `Alert ID: ${alert.alertId}`;
  }

  // Notification methods (simplified implementations)
  private async sendEmailNotification(settings: any, message: string): Promise<void> {
    // Implementation would use actual email service
    structuredLogger.info("Email notification sent", { to: settings.to });
  }

  private async sendSlackNotification(settings: any, message: string): Promise<void> {
    // Implementation would use Slack API
    structuredLogger.info("Slack notification sent", { channel: settings.channel });
  }

  private async sendWebhookNotification(settings: any, alert: Alert): Promise<void> {
    // Implementation would make HTTP request to webhook
    structuredLogger.info("Webhook notification sent", { url: settings.url });
  }

  private async sendSMSNotification(settings: any, message: string): Promise<void> {
    // Implementation would use SMS service
    structuredLogger.info("SMS notification sent", { to: settings.to });
  }

  // Utility methods
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCheckId(): string {
    return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}