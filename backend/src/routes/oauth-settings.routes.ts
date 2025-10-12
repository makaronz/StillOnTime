import { Router } from "express";
import { oauthSettingsController } from "@/controllers/oauth-settings.controller";
import { authenticate } from "@/middleware/auth";

const router = Router();

/**
 * OAuth Settings Routes
 * All routes require authentication
 * Prefix: /api/oauth
 */

// Get current OAuth status
router.get("/status", authenticate, (req, res) =>
  oauthSettingsController.getStatus(req, res)
);

// Manually refresh access token
router.post("/refresh", authenticate, (req, res) =>
  oauthSettingsController.refreshToken(req, res)
);

// Disconnect OAuth account
router.post("/disconnect", authenticate, (req, res) =>
  oauthSettingsController.disconnect(req, res)
);

// Get reconnection URL
router.get("/reconnect", authenticate, (req, res) =>
  oauthSettingsController.reconnect(req, res)
);

// Test OAuth connection
router.get("/test", authenticate, (req, res) =>
  oauthSettingsController.testConnection(req, res)
);

export { router as oauthSettingsRoutes };
