/**
 * Health check routes for monitoring and observability
 */

import { Router } from "express";
import { HealthController } from "../controllers/health.controller";
import { CacheService } from "../services/cache.service";
import { OAuth2Service } from "../services/oauth2.service";

const router = Router();

// Initialize dependencies
const cacheService = new CacheService();
const oauth2Service = new OAuth2Service();
const healthController = new HealthController(cacheService, oauth2Service);

/**
 * @route GET /health
 * @desc Basic health check
 * @access Public
 */
router.get("/", healthController.getHealth.bind(healthController));

/**
 * @route GET /health/detailed
 * @desc Detailed health check with all services
 * @access Public
 */
router.get(
  "/detailed",
  healthController.getDetailedHealth.bind(healthController)
);

/**
 * @route GET /health/ready
 * @desc Kubernetes readiness probe
 * @access Public
 */
router.get("/ready", healthController.getReadiness.bind(healthController));

/**
 * @route GET /health/live
 * @desc Kubernetes liveness probe
 * @access Public
 */
router.get("/live", healthController.getLiveness.bind(healthController));

export default router;
