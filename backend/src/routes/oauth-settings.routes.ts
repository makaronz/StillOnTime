import { Router } from "express";
import { oauthSettingsController } from "@/controllers/oauth-settings.controller";
import { authenticateToken } from "@/middleware/auth.middleware";

const router = Router();

/**
 * OAuth Settings Routes
 * All routes require authentication
 * Prefix: /api/oauth
 */

// Get current OAuth status
router.get("/status", authenticateToken, (req, res) =>
  oauthSettingsController.getStatus(req, res)
);

// Manually refresh access token
router.post("/refresh", authenticateToken, (req, res) =>
  oauthSettingsController.refreshToken(req, res)
);

// Disconnect OAuth account
router.post("/disconnect", authenticateToken, (req, res) =>
  oauthSettingsController.disconnect(req, res)
);

// Get reconnection URL
router.get("/reconnect", authenticateToken, (req, res) =>
  oauthSettingsController.reconnect(req, res)
);

// Test OAuth connection
router.get("/test", authenticateToken, (req, res) =>
  oauthSettingsController.testConnection(req, res)
);

export { router as oauthSettingsRoutes };
