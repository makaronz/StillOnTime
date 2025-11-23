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

// Update sync preferences
router.put("/preferences", authenticateToken, async (req: any, res) => {
  try {
    const preferences = req.body;
    const userId = req.user?.id;

    // TODO: Save preferences to database
    // For now, just return success

    res.json({
      success: true,
      message: "Preferences updated successfully"
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({
      error: "Failed to update preferences",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get Gmail folders/labels
router.get("/folders", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    // TODO: Fetch folders from Gmail API
    // For now, return default folders
    const folders = [
      "INBOX",
      "SENT",
      "DRAFTS",
      "SPAM",
      "TRASH",
      "STARRED",
      "IMPORTANT"
    ];

    res.json({
      data: { folders }
    });
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({
      error: "Failed to fetch folders",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get Google calendars
router.get("/calendars", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    // TODO: Fetch calendars from Google Calendar API
    // For now, return default calendar
    const calendars = [
      { id: "primary", name: "Primary Calendar" }
    ];

    res.json({
      data: { calendars }
    });
  } catch (error) {
    console.error("Error fetching calendars:", error);
    res.status(500).json({
      error: "Failed to fetch calendars",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export { router as oauthSettingsRoutes };
