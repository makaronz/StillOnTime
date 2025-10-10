import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import { db } from "@/config/database";
import { sql } from "kysely";
import { getRedisClient } from "@/config/redis";

/**
 * System Controller
 * Handles system status and API connection monitoring
 */
export class SystemController {
  /**
   * Get system status
   * GET /api/system/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Check database connection
      let databaseConnected = false;
      try {
        await sql`SELECT 1`.execute(db);
        databaseConnected = true;
      } catch (error) {
        logger.error("Database health check failed", { error });
      }

      // Check Redis connection
      let cacheConnected = false;
      try {
        const redis = await getRedisClient();
        await redis.ping();
        cacheConnected = true;
      } catch (error) {
        logger.error("Redis health check failed", { error });
      }

      // Get user's token status
      const user = await db
        .selectFrom("users")
        .select(["tokenExpiry", "refreshToken"])
        .where("id", "=", req.user.userId)
        .executeTakeFirst();

      const now = new Date();
      const tokenValid = user?.tokenExpiry
        ? new Date(user.tokenExpiry) > now
        : false;

      res.json({
        success: true,
        data: {
          status: "operational",
          timestamp: new Date().toISOString(),
          services: {
            database: {
              status: databaseConnected ? "healthy" : "unhealthy",
              connected: databaseConnected,
            },
            cache: {
              status: cacheConnected ? "healthy" : "unhealthy",
              connected: cacheConnected,
            },
            oauth: {
              status: tokenValid ? "healthy" : "expired",
              tokenValid,
              hasRefreshToken: !!user?.refreshToken,
            },
          },
        },
        message: "System status retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get system status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve system status",
        code: "SYSTEM_STATUS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get API connection status
   * GET /api/system/connections
   */
  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const user = await db
        .selectFrom("users")
        .select(["tokenExpiry", "refreshToken", "accessToken"])
        .where("id", "=", req.user.userId)
        .executeTakeFirst();

      const now = new Date();
      const tokenValid = user?.tokenExpiry
        ? new Date(user.tokenExpiry) > now
        : false;

      // Gmail API connection status
      let gmailConnected = false;
      let gmailError: string | undefined;
      if (tokenValid && user?.accessToken) {
        gmailConnected = true;
      } else {
        gmailError = "OAuth token expired or missing";
      }

      // Calendar API connection status
      let calendarConnected = false;
      let calendarError: string | undefined;
      try {
        if (tokenValid && user?.accessToken) {
          // Calendar uses same OAuth token as Gmail
          calendarConnected = gmailConnected;
          calendarError = gmailError;
        } else {
          calendarError = "OAuth token expired or missing";
        }
      } catch (error) {
        calendarError =
          error instanceof Error ? error.message : "Connection test failed";
      }

      // Maps API connection status (API key based, not OAuth)
      let mapsConnected = false;
      let mapsError: string | undefined;
      try {
        // Maps API uses API key, so it's either configured or not
        const hasApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
        mapsConnected = hasApiKey;
        if (!hasApiKey) {
          mapsError = "Google Maps API key not configured";
        }
      } catch (error) {
        mapsError =
          error instanceof Error ? error.message : "Connection test failed";
      }

      // Weather API connection status (API key based)
      let weatherConnected = false;
      let weatherError: string | undefined;
      try {
        const hasApiKey = !!process.env.OPENWEATHER_API_KEY;
        weatherConnected = hasApiKey;
        if (!hasApiKey) {
          weatherError = "OpenWeather API key not configured";
        }
      } catch (error) {
        weatherError =
          error instanceof Error ? error.message : "Connection test failed";
      }

      res.json({
        success: true,
        data: {
          gmail: {
            connected: gmailConnected,
            lastCheck: new Date().toISOString(),
            error: gmailError,
          },
          calendar: {
            connected: calendarConnected,
            lastCheck: new Date().toISOString(),
            error: calendarError,
          },
          maps: {
            connected: mapsConnected,
            lastCheck: new Date().toISOString(),
            error: mapsError,
          },
          weather: {
            connected: weatherConnected,
            lastCheck: new Date().toISOString(),
            error: weatherError,
          },
        },
        message: "API connections status retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get API connections status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve API connections status",
        code: "CONNECTIONS_STATUS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Test API connection
   * POST /api/system/test-connection/:service
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { service } = req.params;

      let success = false;
      let error: string | undefined;

      switch (service) {
        case "gmail":
          try {
            const user = await db
              .selectFrom("users")
              .select(["tokenExpiry", "accessToken"])
              .where("id", "=", req.user.userId)
              .executeTakeFirst();
            const tokenValid = user?.tokenExpiry
              ? new Date(user.tokenExpiry) > new Date()
              : false;
            success = tokenValid && !!user?.accessToken;
            if (!success) {
              error = "OAuth token expired or missing";
            }
          } catch (err) {
            error = err instanceof Error ? err.message : "Connection failed";
          }
          break;

        case "calendar":
          try {
            const user = await db
              .selectFrom("users")
              .select(["tokenExpiry", "accessToken"])
              .where("id", "=", req.user.userId)
              .executeTakeFirst();
            const tokenValid = user?.tokenExpiry
              ? new Date(user.tokenExpiry) > new Date()
              : false;
            success = tokenValid && !!user?.accessToken;
            if (!success) {
              error = "OAuth token expired or missing";
            }
          } catch (err) {
            error = err instanceof Error ? err.message : "Connection failed";
          }
          break;

        case "maps":
          try {
            // Test Maps API (basic check)
            const hasApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
            success = hasApiKey;
            if (!hasApiKey) {
              error = "Google Maps API key not configured";
            }
          } catch (err) {
            error = err instanceof Error ? err.message : "Connection failed";
          }
          break;

        case "weather":
          try {
            // Test Weather API (basic check)
            const hasApiKey = !!process.env.OPENWEATHER_API_KEY;
            success = hasApiKey;
            if (!hasApiKey) {
              error = "OpenWeather API key not configured";
            }
          } catch (err) {
            error = err instanceof Error ? err.message : "Connection failed";
          }
          break;

        default:
          res.status(400).json({
            error: "Bad Request",
            message: "Invalid service name",
            code: "INVALID_SERVICE",
            timestamp: new Date().toISOString(),
            path: req.path,
          });
          return;
      }

      logger.info("API connection test completed", {
        userId: req.user.userId,
        service,
        success,
        error,
      });

      res.json({
        success: true,
        data: {
          success,
          error,
        },
        message: `${service} connection test completed`,
      });
    } catch (error) {
      logger.error("Failed to test API connection", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
        service: req.params.service,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to test API connection",
        code: "CONNECTION_TEST_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const systemController = new SystemController();
