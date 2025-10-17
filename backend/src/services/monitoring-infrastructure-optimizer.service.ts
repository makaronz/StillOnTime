/**
 * Monitoring Infrastructure Optimizer Service
 * Optimizes monitoring system to prevent alert storms and performance degradation
 */

import { logger } from '@/utils/logger';
import { emergencyMemoryRecoveryService } from '@/services/emergency-memory-recovery.service';

interface MonitoringMetrics {
  totalAlerts: number;
  activeAlerts: number;
  alertsPerMinute: number;
  lastAlertTime: Date | null;
  alertHistory: AlertEntry[];
  systemLoad: number;
  isEnabled: boolean;
}

interface AlertEntry {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface AlertThrottleConfig {
  maxAlertsPerMinute: number;
  maxAlertsPerHour: number;
  cooldownPeriodMs: number;
  deduplicationWindowMs: number;
  criticalAlertBypass: boolean;
}

export class MonitoringInfrastructureOptimizerService {
  private metrics: MonitoringMetrics = {
    totalAlerts: 0,
    activeAlerts: 0,
    alertsPerMinute: 0,
    lastAlertTime: null,
    alertHistory: [],
    systemLoad: 0,
    isEnabled: true
  };

  private throttleConfig: AlertThrottleConfig = {
    maxAlertsPerMinute: 10,
    maxAlertsPerHour: 100,
    cooldownPeriodMs: 30000, // 30 seconds
    deduplicationWindowMs: 300000, // 5 minutes
    criticalAlertBypass: true
  };

  private alertCounts: Map<string, number> = new Map();
  private lastAlertCounts: Map<string, number> = new Map();
  private lastCleanupTime = Date.now();

  constructor() {
    this.startPeriodicCleanup();
    this.startMetricsCollection();
  }

  /**
   * Start periodic cleanup of old alerts
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldAlerts();
      this.updateMetrics();
    }, 60000); // Every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Process and optimize alert before sending
   */
  public processAlert(alert: Omit<AlertEntry, 'id' | 'timestamp'>): AlertEntry | null {
    if (!this.metrics.isEnabled) {
      logger.debug('Monitoring is disabled, skipping alert');
      return null;
    }

    const now = new Date();
    const alertId = this.generateAlertId(alert.type, alert.message);

    // Check if this is a critical alert that should bypass throttling
    if (alert.severity === 'critical' && this.throttleConfig.criticalAlertBypass) {
      logger.info('Critical alert bypassing throttling', { type: alert.type });
      return this.createAlert(alertId, alert);
    }

    // Check alert throttling
    if (this.shouldThrottleAlert(alert.type, alert.message, now)) {
      logger.debug('Alert throttled', { type: alert.type, message: alert.message });
      return null;
    }

    // Check for duplicate alerts
    if (this.isDuplicateAlert(alert.type, alert.message, now)) {
      logger.debug('Duplicate alert filtered', { type: alert.type });
      return null;
    }

    // Update alert counts
    this.updateAlertCounts(alert.type);

    return this.createAlert(alertId, alert);
  }

  /**
   * Check if alert should be throttled
   */
  private shouldThrottleAlert(type: string, message: string, now: Date): boolean {
    const alertCount = this.alertCounts.get(type) || 0;
    const maxPerMinute = this.throttleConfig.maxAlertsPerMinute;
    const maxPerHour = this.throttleConfig.maxAlertsPerHour;

    // Check per-minute limit
    if (alertCount >= maxPerMinute) {
      logger.warn('Alert throttled: per-minute limit exceeded', {
        type,
        count: alertCount,
        limit: maxPerMinute
      });
      return true;
    }

    // Check cooldown period
    if (this.metrics.lastAlertTime) {
      const timeSinceLastAlert = now.getTime() - this.metrics.lastAlertTime.getTime();
      if (timeSinceLastAlert < this.throttleConfig.cooldownPeriodMs) {
        logger.debug('Alert throttled: cooldown period active', {
          type,
          timeSinceLastAlert: `${timeSinceLastAlert}ms`,
          cooldownPeriod: `${this.throttleConfig.cooldownPeriodMs}ms`
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Check if alert is a duplicate
   */
  private isDuplicateAlert(type: string, message: string, now: Date): boolean {
    const deduplicationWindow = this.throttleConfig.deduplicationWindowMs;
    const cutoffTime = new Date(now.getTime() - deduplicationWindow);

    // Check for similar alerts in the deduplication window
    const duplicateAlert = this.metrics.alertHistory.find(alert =>
      alert.type === type &&
      alert.message === message &&
      alert.timestamp > cutoffTime &&
      !alert.resolved
    );

    return !!duplicateAlert;
  }

  /**
   * Update alert counts
   */
  private updateAlertCounts(type: string): void {
    const currentCount = this.alertCounts.get(type) || 0;
    this.alertCounts.set(type, currentCount + 1);
    this.metrics.totalAlerts++;
    this.metrics.activeAlerts++;
    this.metrics.lastAlertTime = new Date();
  }

  /**
   * Create alert entry
   */
  private createAlert(id: string, alert: Omit<AlertEntry, 'id' | 'timestamp'>): AlertEntry {
    return {
      id,
      ...alert,
      timestamp: new Date()
    };
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(type: string, message: string): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${type}-${message}-${Date.now()}`)
      .digest('hex');
    return `alert-${hash.substring(0, 8)}`;
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoffTime = new Date(now - maxAge);

    const originalCount = this.metrics.alertHistory.length;
    this.metrics.alertHistory = this.metrics.alertHistory.filter(
      alert => alert.timestamp > cutoffTime
    );

    const cleanedCount = originalCount - this.metrics.alertHistory.length;
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old alerts`);
    }

    this.lastCleanupTime = now;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    // Calculate alerts per minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentAlerts = this.metrics.alertHistory.filter(
      alert => alert.timestamp > oneMinuteAgo
    );
    this.metrics.alertsPerMinute = recentAlerts.length;

    // Update active alerts count
    this.metrics.activeAlerts = this.metrics.alertHistory.filter(
      alert => !alert.resolved
    ).length;

    // Reset per-minute counters
    this.lastAlertCounts = new Map(this.alertCounts);
    this.alertCounts.clear();
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      const memoryStatus = emergencyMemoryRecoveryService.getMemoryStatus();

      // Calculate system load (0-1 scale)
      const memoryLoad = memoryStatus.current.systemUsagePercent / 100;
      const cpuLoad = require('os').loadavg()[0] / require('os').cpus().length;

      this.metrics.systemLoad = Math.max(memoryLoad, cpuLoad);

      // Auto-disable monitoring if system is under extreme load
      if (this.metrics.systemLoad > 0.95) {
        logger.warn('System under extreme load, temporarily disabling monitoring');
        this.metrics.isEnabled = false;

        // Re-enable after 5 minutes
        setTimeout(() => {
          logger.info('Re-enabling monitoring after system load reduction');
          this.metrics.isEnabled = true;
        }, 5 * 60 * 1000);
      }

    } catch (error) {
      logger.warn('Failed to collect system metrics', { error });
    }
  }

  /**
   * Add alert to history
   */
  public addAlertToHistory(alert: AlertEntry): void {
    this.metrics.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.metrics.alertHistory.length > 1000) {
      this.metrics.alertHistory = this.metrics.alertHistory.slice(-1000);
    }
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.metrics.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.metrics.activeAlerts = Math.max(0, this.metrics.activeAlerts - 1);
      logger.info('Alert resolved', { alertId, type: alert.type });
      return true;
    }
    return false;
  }

  /**
   * Get monitoring metrics
   */
  public getMonitoringMetrics(): MonitoringMetrics & {
    throttleConfig: AlertThrottleConfig;
    alertCounts: Record<string, number>;
  } {
    return {
      ...this.metrics,
      throttleConfig: this.throttleConfig,
      alertCounts: Object.fromEntries(this.alertCounts)
    };
  }

  /**
   * Update throttle configuration
   */
  public updateThrottleConfig(config: Partial<AlertThrottleConfig>): void {
    this.throttleConfig = { ...this.throttleConfig, ...config };
    logger.info('Alert throttle configuration updated', this.throttleConfig);
  }

  /**
   * Enable/disable monitoring
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.metrics.isEnabled = enabled;
    logger.info(`Monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get performance recommendations
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.alertsPerMinute > 20) {
      recommendations.push('High alert volume detected. Consider increasing alert thresholds or improving system stability.');
    }

    if (this.metrics.systemLoad > 0.8) {
      recommendations.push('High system load detected. Consider scaling resources or optimizing performance.');
    }

    if (this.metrics.activeAlerts > 50) {
      recommendations.push('Many unresolved alerts. Consider implementing automated resolution procedures.');
    }

    if (this.metrics.alertHistory.length > 900) {
      recommendations.push('Alert history approaching limit. Consider reducing retention period.');
    }

    if (!this.metrics.isEnabled) {
      recommendations.push('Monitoring is currently disabled due to system load. Re-enable when system is stable.');
    }

    return recommendations;
  }
}

// Export singleton instance
export const monitoringInfrastructureOptimizerService = new MonitoringInfrastructureOptimizerService();