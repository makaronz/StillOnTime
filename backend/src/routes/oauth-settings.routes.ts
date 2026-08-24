import { Router } from "express";
import { oauthSettingsController } from "@/controllers/oauth-settings.controller";
import { authenticateToken } from "@/middleware/auth.middleware";
import { Response } from "express";
import { AppRequest } from "@/types/requests";

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

/**
 * Ponizsze trzy trasy sa wywolywane przez frontend/src/services/oauth.service.ts,
 * ale nie maja jeszcze implementacji. Zwracaja 501, a nie zaslepkowy sukces,
 * zeby nie sprawialy wrazenia dzialajacych:
 *
 *  - PUT /preferences : tabela user_configs nie ma kolumn na SyncPreferences
 *    (gmailEnabled, gmailSyncFrequency, gmailFolders, calendarEnabled,
 *    selectedCalendars, autoSync) — zapis wymaga decyzji o schemacie.
 *  - GET /folders     : GmailService nie ma metody listowania etykiet.
 *  - GET /calendars   : CalendarService nie ma metody listowania kalendarzy.
 *
 * Zadna z nich nie jest obecnie wolana z zadnego komponentu UI.
 */
const notImplemented = (feature: string, reason: string) =>
  (req: AppRequest, res: Response): void => {
    res.status(501).json({
      error: "Not Implemented",
      message: `${feature} is not implemented yet`,
      reason,
      code: "NOT_IMPLEMENTED",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  };

router.put(
  "/preferences",
  authenticateToken,
  notImplemented(
    "Sync preferences",
    "user_configs has no columns for SyncPreferences; persisting them requires a schema change"
  )
);

router.get(
  "/folders",
  authenticateToken,
  notImplemented(
    "Gmail folder listing",
    "GmailService exposes no label-listing method"
  )
);

router.get(
  "/calendars",
  authenticateToken,
  notImplemented(
    "Calendar listing",
    "CalendarService exposes no calendar-listing method"
  )
);

export { router as oauthSettingsRoutes };
