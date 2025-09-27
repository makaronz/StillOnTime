/**
 * Health check routes for monitoring and observability
 */

import { Router } from "express";
import { HealthController } from "../controllers/health.controller";
import { CacheService } from "../services/cache.service";
import { OAuth2Service } from "../services/oauth2.service";
import { MonitoringService } from "../services/monitoring.service";
import { ErrorHandlerService } from "../services/error-handler.service";
import { NotificationService } from "../services/notification.service";
import { UserRepository } from "../repositories/user.repository";
import { NotificationRepository } from "../repositories/notification.repository";

const router = Router();

// Initialize dependencies in correct order
const cacheService = new CacheService();
const userRepository = new UserRepository();
const oauth2Service = new OAuth2Service(userRepository);
const notificationRepository = new NotificationRepository();
const notificationService = new NotificationService(
  notificationRepository,
  userRepository
);
const errorHandlerService = new ErrorHandlerService(
  oauth2Service,
  cacheService,
  notificationService
);
const monitoringService = new MonitoringService(
  errorHandlerService,
  cacheService,
  notificationService
);
const healthController = new HealthController(
  cacheService,
  oauth2Service,
  monitoringService,
  errorHandlerService
);

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
