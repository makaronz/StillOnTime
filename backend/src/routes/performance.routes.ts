import { Router, Response } from "express";
import { structuredLogger } from "@/utils/logger";

const router = Router();

/**
 * Performance Routes
 * For collecting frontend performance metrics (Web Vitals)
 */

interface WebVitalsMetrics {
  // Core Web Vitals
  LCP?: number;  // Largest Contentful Paint
  FID?: number;  // First Input Delay
  CLS?: number;  // Cumulative Layout Shift

  // Additional metrics
  FCP?: number;  // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number;  // Interaction to Next Paint

  // Context
  url?: string;
  userAgent?: string;
  timestamp?: number;
  type?: string;
  referrer?: string;
  screenResolution?: string;
  viewportSize?: string;
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;

  // Custom metrics
  [key: string]: any;
}

// POST /api/performance/web-vitals - Record Web Vitals metrics
router.post("/web-vitals", async (req: any, res: Response) => {
  try {
    const metrics: WebVitalsMetrics = req.body;

    // Log metrics for monitoring
    structuredLogger.info("Web Vitals received", {
      category: "performance",
      url: metrics.url,
      LCP: metrics.LCP,
      FID: metrics.FID,
      CLS: metrics.CLS,
      FCP: metrics.FCP,
      TTFB: metrics.TTFB,
      INP: metrics.INP,
      userAgent: metrics.userAgent?.substring(0, 100), // Truncate for logging
      timestamp: metrics.timestamp || Date.now()
    });

    // TODO: Store metrics in database or send to monitoring service
    // Options:
    // - Store in PostgreSQL for historical analysis
    // - Send to Prometheus/Grafana
    // - Send to external monitoring service (DataDog, New Relic, etc.)

    // Return 204 No Content (success, no body)
    res.status(204).send();
  } catch (error) {
    console.error("Error recording web vitals:", error);
    // Still return 204 to not block frontend
    res.status(204).send();
  }
});

// POST /api/performance/metrics - Record custom performance metrics
router.post("/metrics", async (req: any, res: Response) => {
  try {
    const { name, value, unit, tags, description } = req.body;

    structuredLogger.info("Custom metric received", {
      category: "performance",
      metricName: name,
      value,
      unit,
      tags,
      description
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error recording custom metric:", error);
    res.status(204).send();
  }
});

// GET /api/performance/health - Health check for performance service
router.get("/health", (req: any, res: Response) => {
  res.json({
    status: "healthy",
    service: "performance",
    timestamp: new Date().toISOString()
  });
});

export { router as performanceRoutes };
