import { getWebVitals, reportWebVitals } from "web-vitals";

/**
 * Frontend Performance Monitoring Service
 * Tracks Core Web Vitals and sends metrics to backend
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte

  // Additional metrics
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;

  // Resource metrics
  resourceCount: number;
  totalResourceSize: number;

  // Navigation metrics
  navigationStart: number;
  redirectTime: number;
  dnsTime: number;
  tcpTime: number;
  sslTime: number;
  requestTime: number;
  responseTime: number;
  domProcessingTime: number;
}

export interface PerformanceConfig {
  endpoint: string;
  apiKey?: string;
  sampleRate: number; // 0-1, percentage of users to track
  debug: boolean;
}

class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private isInitialized = false;

  private constructor() {
    this.config = {
      endpoint: "/api/performance/web-vitals",
      sampleRate: 1.0, // Track 100% of users in development, adjust for production
      debug: process.env.NODE_ENV === "development",
    };
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * Initialize performance monitoring
   */
  init(config?: Partial<PerformanceConfig>): void {
    if (this.isInitialized) return;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Don't initialize if not in browser or if sample rate doesn't match
    if (typeof window === "undefined" || !this.shouldSample()) {
      return;
    }

    this.setupWebVitals();
    this.setupNavigationTiming();
    this.setupResourceTiming();
    this.setupErrorTracking();
    this.setupRouteTracking();

    this.isInitialized = true;

    if (this.config.debug) {
      console.log("Performance monitoring initialized");
    }
  }

  /**
   * Check if current session should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Setup Core Web Vitals tracking
   */
  private setupWebVitals(): void {
    try {
      reportWebVitals((metric) => {
        this.recordMetric({
          [metric.name.toLowerCase()]: metric.value,
        } as any);

        // Send to backend immediately for important metrics
        if (["LCP", "FID", "CLS"].includes(metric.name)) {
          this.sendMetrics({
            [metric.name.toLowerCase()]: metric.value,
            timestamp: Date.now(),
            type: "web-vital",
            rating: metric.rating,
          });
        }
      });
    } catch (error) {
      console.error("Failed to setup Web Vitals tracking:", error);
    }
  }

  /**
   * Setup Navigation Timing API
   */
  private setupNavigationTiming(): void {
    try {
      window.addEventListener("load", () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

          if (navigation) {
            const metrics: PerformanceMetrics = {
              navigationStart: navigation.navigationStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              firstPaint: 0,
              firstContentfulPaint: 0,
              resourceCount: 0,
              totalResourceSize: 0,
              redirectTime: navigation.redirectEnd - navigation.redirectStart,
              dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
              tcpTime: navigation.connectEnd - navigation.connectStart,
              sslTime: navigation.secureConnectionStart > 0 ? navigation.connectEnd - navigation.secureConnectionStart : 0,
              requestTime: navigation.requestStart - navigation.connectEnd,
              responseTime: navigation.responseEnd - navigation.requestStart,
              domProcessingTime: navigation.domContentLoadedEventStart - navigation.responseEnd,
            };

            // Get paint timing
            const paintEntries = performance.getEntriesByType("paint");
            paintEntries.forEach((entry) => {
              if (entry.name === "first-paint") {
                metrics.firstPaint = entry.startTime;
              }
              if (entry.name === "first-contentful-paint") {
                metrics.firstContentfulPaint = entry.startTime;
              }
            });

            this.recordMetric(metrics);
            this.sendMetrics({
              ...metrics,
              timestamp: Date.now(),
              type: "navigation-timing",
            });
          }
        }, 0);
      });
    } catch (error) {
      console.error("Failed to setup Navigation Timing:", error);
    }
  }

  /**
   * Setup Resource Timing API
   */
  private setupResourceTiming(): void {
    try {
      window.addEventListener("load", () => {
        setTimeout(() => {
          const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

          let totalSize = 0;
          resources.forEach((resource) => {
            // Calculate resource size if available
            if (resource.transferSize) {
              totalSize += resource.transferSize;
            }
          });

          this.recordMetric({
            resourceCount: resources.length,
            totalResourceSize: totalSize,
          } as any);

          // Track slow resources
          const slowResources = resources.filter(
            resource => resource.duration > 1000 // More than 1 second
          );

          if (slowResources.length > 0) {
            this.sendMetrics({
              slowResources: slowResources.map(resource => ({
                name: resource.name,
                duration: resource.duration,
                size: resource.transferSize || 0,
              })),
              timestamp: Date.now(),
              type: "slow-resources",
            });
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Failed to setup Resource Timing:", error);
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking(): void {
    try {
      window.addEventListener("error", (event) => {
        this.sendMetrics({
          type: "javascript-error",
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now(),
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        this.sendMetrics({
          type: "unhandled-promise-rejection",
          reason: event.reason,
          timestamp: Date.now(),
        });
      });
    } catch (error) {
      console.error("Failed to setup error tracking:", error);
    }
  }

  /**
   * Setup route tracking for SPAs
   */
  private setupRouteTracking(): void {
    try {
      // Track page visibility changes
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.sendMetrics({
            type: "page-visible",
            timestamp: Date.now(),
          });
        }
      });

      // Track beforeunload for page close
      window.addEventListener("beforeunload", () => {
        this.sendMetrics({
          type: "page-unload",
          timeOnPage: Date.now() - performance.timing.navigationStart,
          timestamp: Date.now(),
        }, true); // Use sendBeacon for unload events
      });
    } catch (error) {
      console.error("Failed to setup route tracking:", error);
    }
  }

  /**
   * Record metric locally
   */
  private recordMetric(metrics: Partial<PerformanceMetrics>): void {
    this.metrics.push(metrics as PerformanceMetrics);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    if (this.config.debug) {
      console.log("Performance metric recorded:", metrics);
    }
  }

  /**
   * Send metrics to backend
   */
  private sendMetrics(data: any, useBeacon = false): void {
    try {
      const payload = {
        ...data,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      };

      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(this.config.endpoint, JSON.stringify(payload));
      } else {
        fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "X-API-Key": this.config.apiKey }),
          },
          body: JSON.stringify(payload),
          keepalive: true, // Ensure request completes even if page is unloading
        }).catch((error) => {
          if (this.config.debug) {
            console.error("Failed to send performance metrics:", error);
          }
        });
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("Failed to send metrics:", error);
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Manually record a custom metric
   */
  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.sendMetrics({
      type: "custom-metric",
      name,
      value,
      tags,
      timestamp: Date.now(),
    });
  }

  /**
   * Record user interaction timing
   */
  recordInteraction(name: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.sendMetrics({
      type: "user-interaction",
      name,
      duration,
      timestamp: Date.now(),
    });
  }

  /**
   * Record component render time
   */
  recordComponentRender(componentName: string, renderTime: number): void {
    this.sendMetrics({
      type: "component-render",
      component: componentName,
      renderTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Record API request timing
   */
  recordApiRequest(url: string, method: string, duration: number, status: number): void {
    this.sendMetrics({
      type: "api-request",
      url,
      method,
      duration,
      status,
      timestamp: Date.now(),
    });
  }

  /**
   * Get performance score based on metrics
   */
  getPerformanceScore(): number {
    const latest = this.getCurrentMetrics();
    if (!latest) return 0;

    let score = 100;

    // Deduct points for poor metrics
    if (latest.lcp && latest.lcp > 4000) score -= 20;
    if (latest.fid && latest.fid > 300) score -= 20;
    if (latest.cls && latest.cls > 0.25) score -= 20;
    if (latest.fcp && latest.fcp > 3000) score -= 15;
    if (latest.ttfb && latest.ttfb > 1800) score -= 15;
    if (latest.loadComplete > 5000) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const latest = this.getCurrentMetrics();
    if (!latest) return "No performance data available";

    const report = `
Performance Report - ${new Date().toISOString()}

Core Web Vitals:
- Largest Contentful Paint (LCP): ${latest.lcp?.toFixed(0) || "N/A"}ms
- First Input Delay (FID): ${latest.fid?.toFixed(0) || "N/A"}ms
- Cumulative Layout Shift (CLS): ${latest.cls?.toFixed(3) || "N/A"}
- First Contentful Paint (FCP): ${latest.fcp?.toFixed(0) || "N/A"}ms
- Time to First Byte (TTFB): ${latest.ttfb?.toFixed(0) || "N/A"}ms

Page Load Metrics:
- DOM Content Loaded: ${latest.domContentLoaded.toFixed(0)}ms
- Load Complete: ${latest.loadComplete.toFixed(0)}ms
- First Paint: ${latest.firstPaint.toFixed(0)}ms

Resource Metrics:
- Total Resources: ${latest.resourceCount}
- Total Size: ${(latest.totalResourceSize / 1024 / 1024).toFixed(2)}MB

Network Metrics:
- DNS Time: ${latest.dnsTime.toFixed(0)}ms
- TCP Time: ${latest.tcpTime.toFixed(0)}ms
- SSL Time: ${latest.sslTime.toFixed(0)}ms
- Request Time: ${latest.requestTime.toFixed(0)}ms
- Response Time: ${latest.responseTime.toFixed(0)}ms

Performance Score: ${this.getPerformanceScore()}/100
    `;

    return report;
  }
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  React.useEffect(() => {
    performanceMonitoringService.init();
  }, []);

  return {
    recordCustomMetric: performanceMonitoringService.recordCustomMetric.bind(performanceMonitoringService),
    recordInteraction: performanceMonitoringService.recordInteraction.bind(performanceMonitoringService),
    recordComponentRender: performanceMonitoringService.recordComponentRender.bind(performanceMonitoringService),
    recordApiRequest: performanceMonitoringService.recordApiRequest.bind(performanceMonitoringService),
    getCurrentMetrics: performanceMonitoringService.getCurrentMetrics.bind(performanceMonitoringService),
    getPerformanceScore: performanceMonitoringService.getPerformanceScore.bind(performanceMonitoringService),
    generateReport: performanceMonitoringService.generateReport.bind(performanceMonitoringService),
  };
};

export default performanceMonitoringService;