import { Router, Request, Response } from "express";
import { structuredLogger } from "@/utils/logger";

const router = Router();

type MetricsPayload = Record<string, unknown>;

const getPayload = (req: Request): MetricsPayload => {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body as MetricsPayload;
  }
  return {};
};

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

// POST /api/performance/web-vitals
router.post("/web-vitals", (req: Request, res: Response): void => {
  const payload = getPayload(req);

  structuredLogger.info("Web vitals received", {
    category: "performance",
    metricType: getString(payload.type) ?? "web-vitals",
    url: getString(payload.url),
    lcp: getNumber(payload.lcp),
    fid: getNumber(payload.fid),
    cls: getNumber(payload.cls),
    ttfb: getNumber(payload.ttfb),
  });

  res.status(204).send();
});

// POST /api/performance/metrics
router.post("/metrics", (req: Request, res: Response): void => {
  const payload = getPayload(req);

  structuredLogger.info("Performance metric received", {
    category: "performance",
    metricType: getString(payload.type) ?? "custom",
    name: getString(payload.name),
    value: getNumber(payload.value),
    unit: getString(payload.unit),
  });

  res.status(204).send();
});

// POST /api/performance/component-render
router.post("/component-render", (req: Request, res: Response): void => {
  const payload = getPayload(req);

  structuredLogger.debug("Component render metric received", {
    category: "performance",
    component: getString(payload.component),
    renderTime: getNumber(payload.renderTime),
  });

  res.status(204).send();
});

// GET /api/performance/dashboard
router.get("/dashboard", (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      hourlyStats: [],
      recentAlerts: [],
    },
  });
});

// GET /api/performance/health
router.get("/health", (_req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "performance",
    timestamp: new Date().toISOString(),
  });
});

export { router as performanceRoutes };
