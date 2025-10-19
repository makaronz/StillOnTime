import { logger } from "@/utils/logger";
import { getRedisClient } from "@/config/redis";
import { createClient } from "redis";

/**
 * Performance monitoring service for tracking system metrics
 */
export interface PerformanceMetrics {
  // API metrics
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  slowQueries: number;

  // Database metrics
  dbConnections: number;
  dbQueryTime: number;
  dbSlowQueries: number;

  // Cache metrics
  cacheHitRate: number;
  cacheMemoryUsage: string;

  // System metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;

  // Frontend metrics
  webVitals: WebVitalsMetrics;
}

export interface WebVitalsMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte

  // Additional metrics
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
}

export interface AlertThresholds {
  responseTime: number;
  errorRate: number;
  memoryUsage: number;
  cacheHitRate: number;
  webVitals: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
}

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private redisClient: ReturnType<typeof createClient> | null = null;
  private metrics = new Map<string, any>();
  private alerts: AlertThresholds = {
    responseTime: 1000, // 1 second
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80%
    cacheHitRate: 0.8, // 80%
    webVitals: {
      lcp: 2500, // Good: <2.5s
      fid: 100, // Good: <100ms
      cls: 0.1, // Good: <0.1
      fcp: 1800, // Good: <1.8s
      ttfb: 800, // Good: <800ms
    },
  };

  private constructor() {
    this.initializeRedis();
    this.startPeriodicCollection();
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = await getRedisClient();
    } catch (error) {
      logger.error("Failed to initialize Redis for performance monitoring", { error });
    }
  }

  /**
   * Record API request metrics
   */
  recordRequest(req: any, res: any, responseTime: number): void {
    const key = `api:${req.route?.path || req.path}`;
    const timestamp = Date.now();

    const metrics = {
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    };

    // Store in Redis for real-time monitoring
    this.storeMetric(key, metrics);

    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(query: string, duration: number, success: boolean): void {
    const key = "db:queries";
    const metrics = {
      query: query.substring(0, 100), // Limit query length
      duration,
      success,
      timestamp: Date.now(),
    };

    this.storeMetric(key, metrics);

    // Alert on slow queries
    if (duration > 1000) { // 1 second threshold
      logger.warn("Slow database query detected", {
        query: query.substring(0, 100),
        duration,
      });
    }
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(operation: "hit" | "miss" | "set" | "delete", key: string, duration: number): void {
    const cacheKey = `cache:${operation}`;
    const metrics = {
      key,
      duration,
      timestamp: Date.now(),
    };

    this.storeMetric(cacheKey, metrics);
  }

  /**
   * Record Web Vitals from frontend
   */
  recordWebVitals(userId: string, vitals: WebVitalsMetrics): void {
    const key = `webvitals:${userId}`;
    const metrics = {
      ...vitals,
      timestamp: Date.now(),
      userId,
    };

    this.storeMetric(key, metrics);

    // Check Web Vitals thresholds
    this.checkWebVitalsAlerts(vitals, userId);
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour ago

    try {
      // API metrics
      const apiMetrics = await this.getAggregatedMetrics("api:", oneHourAgo);
      const requestCount = apiMetrics.length;
      const averageResponseTime = apiMetrics.length > 0
        ? apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / apiMetrics.length
        : 0;
      const errorRate = apiMetrics.length > 0
        ? apiMetrics.filter(m => m.statusCode >= 400).length / apiMetrics.length
        : 0;

      // Database metrics
      const dbMetrics = await this.getAggregatedMetrics("db:queries", oneHourAgo);
      const dbQueryTime = dbMetrics.length > 0
        ? dbMetrics.reduce((sum, m) => sum + m.duration, 0) / dbMetrics.length
        : 0;
      const dbSlowQueries = dbMetrics.filter(m => m.duration > 1000).length;

      // Cache metrics
      const cacheHits = await this.getMetricCount("cache:hit", oneHourAgo);
      const cacheMisses = await this.getMetricCount("cache:miss", oneHourAgo);
      const cacheHitRate = cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

      // System metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      // Web Vitals (average across all users in last hour)
      const webVitalsMetrics = await this.getAggregatedMetrics("webvitals:", oneHourAgo);
      const webVitals = this.calculateAverageWebVitals(webVitalsMetrics);

      return {
        requestCount,
        averageResponseTime,
        errorRate,
        slowQueries: dbSlowQueries,
        dbConnections: 0, // Would need connection pool monitoring
        dbQueryTime,
        dbSlowQueries,
        cacheHitRate,
        cacheMemoryUsage: "N/A", // Would need Redis memory monitoring
        memoryUsage,
        cpuUsage,
        uptime,
        webVitals,
      };
    } catch (error) {
      logger.error("Failed to get performance metrics", { error });
      throw error;
    }
  }

  /**
   * Get performance dashboard data
   */
  async getDashboardData(): Promise<any> {
    const now = Date.now();
    const last24Hours = now - 86400000; // 24 hours ago

    try {
      const [
        currentMetrics,
        hourlyStats,
        errorBreakdown,
        slowQueries,
        recentAlerts,
        webVitalsSummary,
      ] = await Promise.all([
        this.getCurrentMetrics(),
        this.getHourlyStats(last24Hours),
        this.getErrorBreakdown(last24Hours),
        this.getSlowQueries(last24Hours),
        this.getRecentAlerts(last24Hours),
        this.getWebVitalsSummary(last24Hours),
      ]);

      return {
        currentMetrics,
        hourlyStats,
        errorBreakdown,
        slowQueries,
        recentAlerts,
        webVitalsSummary,
        timestamp: now,
      };
    } catch (error) {
      logger.error("Failed to get dashboard data", { error });
      throw error;
    }
  }

  /**
   * Store metric in Redis
   */
  private async storeMetric(key: string, data: any): Promise<void> {
    if (!this.redisClient) return;

    try {
      const timestamp = Date.now();
      await this.redisClient.zAdd(`metrics:${key}`, {
        score: timestamp,
        value: JSON.stringify(data),
      });

      // Keep only last 24 hours of data
      const oneDayAgo = timestamp - 86400000;
      await this.redisClient.zRemRangeByScore(`metrics:${key}`, 0, oneDayAgo);
    } catch (error) {
      logger.error("Failed to store metric", { error, key });
    }
  }

  /**
   * Get aggregated metrics for a time range
   */
  private async getAggregatedMetrics(prefix: string, since: number): Promise<any[]> {
    if (!this.redisClient) return [];

    try {
      const keys = await this.redisClient.keys(`metrics:${prefix}*`);
      const metrics: any[] = [];

      for (const key of keys) {
        const values = await this.redisClient.zRangeByScore(key, since, Date.now());
        for (const value of values) {
          try {
            metrics.push(JSON.parse(value));
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      return metrics;
    } catch (error) {
      logger.error("Failed to get aggregated metrics", { error, prefix });
      return [];
    }
  }

  /**
   * Get metric count for a time range
   */
  private async getMetricCount(key: string, since: number): Promise<number> {
    if (!this.redisClient) return 0;

    try {
      return await this.redisClient.zCount(`metrics:${key}`, since, Date.now());
    } catch (error) {
      logger.error("Failed to get metric count", { error, key });
      return 0;
    }
  }

  /**
   * Calculate average Web Vitals
   */
  private calculateAverageWebVitals(metrics: any[]): WebVitalsMetrics {
    if (metrics.length === 0) {
      return {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        navigationStart: 0,
        domContentLoaded: 0,
        loadComplete: 0,
      };
    }

    const sum = metrics.reduce((acc, m) => ({
      lcp: acc.lcp + m.lcp,
      fid: acc.fid + m.fid,
      cls: acc.cls + m.cls,
      fcp: acc.fcp + m.fcp,
      ttfb: acc.ttfb + m.ttfb,
      navigationStart: acc.navigationStart + m.navigationStart,
      domContentLoaded: acc.domContentLoaded + m.domContentLoaded,
      loadComplete: acc.loadComplete + m.loadComplete,
    }), {
      lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0,
      navigationStart: 0, domContentLoaded: 0, loadComplete: 0,
    });

    const count = metrics.length;
    return {
      lcp: sum.lcp / count,
      fid: sum.fid / count,
      cls: sum.cls / count,
      fcp: sum.fcp / count,
      ttfb: sum.ttfb / count,
      navigationStart: sum.navigationStart / count,
      domContentLoaded: sum.domContentLoaded / count,
      loadComplete: sum.loadComplete / count,
    };
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: any): void {
    if (metrics.responseTime > this.alerts.responseTime) {
      logger.warn("High response time detected", {
        responseTime: metrics.responseTime,
        threshold: this.alerts.responseTime,
      });
    }

    if (metrics.statusCode >= 400) {
      logger.warn("API error recorded", {
        statusCode: metrics.statusCode,
        responseTime: metrics.responseTime,
      });
    }
  }

  /**
   * Check Web Vitals alerts
   */
  private checkWebVitalsAlerts(vitals: WebVitalsMetrics, userId: string): void {
    const alerts: string[] = [];

    if (vitals.lcp > this.alerts.webVitals.lcp) {
      alerts.push(`LCP: ${vitals.lcp}ms (threshold: ${this.alerts.webVitals.lcp}ms)`);
    }

    if (vitals.fid > this.alerts.webVitals.fid) {
      alerts.push(`FID: ${vitals.fid}ms (threshold: ${this.alerts.webVitals.fid}ms)`);
    }

    if (vitals.cls > this.alerts.webVitals.cls) {
      alerts.push(`CLS: ${vitals.cls} (threshold: ${this.alerts.webVitals.cls})`);
    }

    if (vitals.fcp > this.alerts.webVitals.fcp) {
      alerts.push(`FCP: ${vitals.fcp}ms (threshold: ${this.alerts.webVitals.fcp}ms)`);
    }

    if (vitals.ttfb > this.alerts.webVitals.ttfb) {
      alerts.push(`TTFB: ${vitals.ttfb}ms (threshold: ${this.alerts.webVitals.ttfb}ms)`);
    }

    if (alerts.length > 0) {
      logger.warn("Web Vitals performance issues detected", {
        userId,
        alerts,
        vitals,
      });
    }
  }

  /**
   * Get hourly statistics
   */
  private async getHourlyStats(since: number): Promise<any[]> {
    const stats = [];
    const now = Date.now();
    const hours = 24;

    for (let i = 0; i < hours; i++) {
      const hourStart = since + (i * 3600000);
      const hourEnd = hourStart + 3600000;

      try {
        const apiMetrics = await this.getAggregatedMetrics("api:", hourStart);
        const hourlyMetrics = apiMetrics.filter(m => m.timestamp >= hourStart && m.timestamp < hourEnd);

        stats.push({
          hour: new Date(hourStart).toISOString(),
          requestCount: hourlyMetrics.length,
          averageResponseTime: hourlyMetrics.length > 0
            ? hourlyMetrics.reduce((sum, m) => sum + m.responseTime, 0) / hourlyMetrics.length
            : 0,
          errorRate: hourlyMetrics.length > 0
            ? hourlyMetrics.filter(m => m.statusCode >= 400).length / hourlyMetrics.length
            : 0,
        });
      } catch (error) {
        stats.push({
          hour: new Date(hourStart).toISOString(),
          requestCount: 0,
          averageResponseTime: 0,
          errorRate: 0,
        });
      }
    }

    return stats;
  }

  /**
   * Get error breakdown
   */
  private async getErrorBreakdown(since: number): Promise<any> {
    try {
      const apiMetrics = await this.getAggregatedMetrics("api:", since);
      const errors = apiMetrics.filter(m => m.statusCode >= 400);

      const breakdown = errors.reduce((acc, error) => {
        const key = `${error.statusCode} ${error.method} ${error.route || error.path}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(breakdown)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 errors
    } catch (error) {
      return [];
    }
  }

  /**
   * Get slow queries
   */
  private async getSlowQueries(since: number): Promise<any[]> {
    try {
      const dbMetrics = await this.getAggregatedMetrics("db:queries", since);
      const slowQueries = dbMetrics
        .filter(m => m.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20); // Top 20 slow queries

      return slowQueries.map(q => ({
        query: q.query,
        duration: q.duration,
        timestamp: q.timestamp,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recent alerts
   */
  private async getRecentAlerts(since: number): Promise<any[]> {
    // This would integrate with an alerting system
    // For now, return empty array
    return [];
  }

  /**
   * Get Web Vitals summary
   */
  private async getWebVitalsSummary(since: number): Promise<any> {
    try {
      const webVitalsMetrics = await this.getAggregatedMetrics("webvitals:", since);
      const webVitals = this.calculateAverageWebVitals(webVitalsMetrics);

      const ratings = {
        lcp: this.getWebVitalsRating(webVitals.lcp, "lcp"),
        fid: this.getWebVitalsRating(webVitals.fid, "fid"),
        cls: this.getWebVitalsRating(webVitals.cls, "cls"),
        fcp: this.getWebVitalsRating(webVitals.fcp, "fcp"),
        ttfb: this.getWebVitalsRating(webVitals.ttfb, "ttfb"),
      };

      return {
        metrics: webVitals,
        ratings,
        sampleSize: webVitalsMetrics.length,
      };
    } catch (error) {
      return {
        metrics: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
        ratings: { lcp: "poor", fid: "poor", cls: "poor", fcp: "poor", ttfb: "poor" },
        sampleSize: 0,
      };
    }
  }

  /**
   * Get Web Vitals rating
   */
  private getWebVitalsRating(value: number, metric: keyof WebVitalsMetrics): "good" | "needs-improvement" | "poor" {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return "poor";

    if (value <= threshold.good) return "good";
    if (value <= threshold.poor) return "needs-improvement";
    return "poor";
  }

  /**
   * Start periodic collection
   */
  private startPeriodicCollection(): void {
    // Collect system metrics every minute
    setInterval(async () => {
      try {
        const metrics = await this.getCurrentMetrics();
        this.storeMetric("system:metrics", {
          ...metrics,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error("Failed to collect periodic metrics", { error });
      }
    }, 60000); // 1 minute
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.alerts = { ...this.alerts, ...newThresholds };
    logger.info("Alert thresholds updated", { thresholds: this.alerts });
  }
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();