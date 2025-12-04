import { Response } from "express"
import { AppRequest } from "@/types/requests";
import { services } from "@/services";
import { logger } from "@/utils/logger";

/**
 * OAuth Settings Controller
 * Handles OAuth configuration management, token refresh, and connection testing
 */
export class OAuthSettingsController {
  /**
   * Get OAuth connection status and details
   * GET /api/oauth/status
   */
  async getStatus(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = (req.user as any).userId;

      // Get OAuth status
      const oauthStatus = await services.oauth2.getOAuthStatus(userId);

      // Get user details for account info
      const { userRepository } = await import("@/repositories/user.repository");
      const user = await userRepository.findById(userId);

      if (!user) {
        res.status(404).json({
          error: "Not Found",
          message: "User not found",
          code: "USER_NOT_FOUND",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        status: {
          connected: oauthStatus.isAuthenticated,
          accountEmail: user.email,
          accountName: user.name,
          scopes: oauthStatus.scopes,
          tokenExpiry: oauthStatus.expiresAt,
          lastSync: user.updatedAt,
          needsReauth: oauthStatus.needsReauth,
        },
      });
    } catch (error) {
      logger.error("Failed to get OAuth status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req.user as any)?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve OAuth status",
        code: "OAUTH_STATUS_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Manually refresh OAuth access token
   * POST /api/oauth/refresh
   */
  async refreshToken(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = (req.user as any).userId;

      // Get user with tokens
      const { userRepository } = await import("@/repositories/user.repository");
      const user = await userRepository.findById(userId);

      if (!user || !user.refreshToken) {
        res.status(400).json({
          error: "Bad Request",
          message: "No refresh token available - please re-authenticate",
          code: "NO_REFRESH_TOKEN",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Decrypt refresh token and refresh
      const decryptedRefreshToken = (services.oauth2 as any).decryptToken(
        user.refreshToken
      );
      const newTokens = await services.oauth2.refreshAccessToken(
        decryptedRefreshToken
      );

      // Update user with new tokens
      await userRepository.update(userId, {
        accessToken: (services.oauth2 as any).encryptToken(
          newTokens.access_token
        ),
        refreshToken: newTokens.refresh_token
          ? (services.oauth2 as any).encryptToken(newTokens.refresh_token)
          : user.refreshToken,
        tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
      });

      logger.info("OAuth token manually refreshed", { userId });

      res.json({
        success: true,
        message: "Access token refreshed successfully",
        expiresIn: newTokens.expires_in,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    } catch (error) {
      logger.error("Failed to refresh OAuth token", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req.user as any)?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to refresh access token",
        code: "TOKEN_REFRESH_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Disconnect OAuth account and revoke tokens
   * POST /api/oauth/disconnect
   */
  async disconnect(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = (req.user as any).userId;

      // Revoke tokens
      await services.oauth2.revokeTokens(userId);

      logger.info("OAuth account disconnected", { userId });

      res.json({
        success: true,
        message: "OAuth account disconnected successfully",
      });
    } catch (error) {
      logger.error("Failed to disconnect OAuth account", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req.user as any)?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to disconnect OAuth account",
        code: "OAUTH_DISCONNECT_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate new OAuth authorization URL for reconnection
   * GET /api/oauth/reconnect
   */
  async reconnect(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Generate new auth URL
      const { authUrl, state } = await services.oauth2.getAuthUrl();

      logger.info("OAuth reconnection URL generated", {
        userId: (req.user as any).userId,
      });

      res.json({
        success: true,
        authUrl,
        state,
        message: "Redirect to this URL to reconnect your account",
      });
    } catch (error) {
      logger.error("Failed to generate reconnection URL", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req.user as any)?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to generate reconnection URL",
        code: "RECONNECT_URL_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test OAuth connection by making an API call
   * GET /api/oauth/test
   */
  async testConnection(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = (req.user as any).userId;

      // Try to get Google client (will refresh token if needed)
      const googleClient = await services.oauth2.getGoogleClient(userId);

      // Make a simple API call to verify connection
      const { google } = await import("googleapis");
      const oauth2 = google.oauth2({ version: "v2", auth: googleClient });
      const { data } = await oauth2.userinfo.get();

      logger.info("OAuth connection test successful", { userId });

      res.json({
        success: true,
        connected: true,
        message: "OAuth connection is working correctly",
        userInfo: {
          email: data.email,
          name: data.name,
          verified: data.verified_email,
        },
      });
    } catch (error) {
      logger.error("OAuth connection test failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req.user as any)?.userId,
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const needsReauth = errorMessage.includes("re-authenticate");

      res.status(needsReauth ? 401 : 500).json({
        error: needsReauth ? "Unauthorized" : "Internal Server Error",
        message: needsReauth
          ? "Authentication expired - please reconnect your account"
          : "OAuth connection test failed",
        code: needsReauth ? "REAUTH_REQUIRED" : "CONNECTION_TEST_FAILED",
        needsReauth,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// Export singleton instance
export const oauthSettingsController = new OAuthSettingsController();
