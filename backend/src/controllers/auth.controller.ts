import express, { Response } from "express";
import { services } from "@/services";
import { logger } from "@/utils/logger";
import { AppRequest } from "@/types/requests";

/**
 * Authentication Controller
 * Handles OAuth 2.0 authentication flow with Google
 */
export class AuthController {
  /**
   * Initiate OAuth 2.0 authentication flow
   * GET /auth/login
   */
  async login(req: any, res: Response): Promise<void> {
    try {
      const state = req.query.state as string;
      const { authUrl, state: generatedState } = await services.oauth2.getAuthUrl(state);

      logger.info("OAuth login initiated", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        state: generatedState,
      });

      res.json({
        success: true,
        authUrl,
        state: generatedState,
        message: "Redirect to Google OAuth for authentication",
      });
    } catch (error) {
      logger.error("Failed to initiate OAuth login", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to initiate authentication",
        code: "AUTH_INIT_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Handle OAuth 2.0 callback from Google
   * POST /auth/callback
   */
  async callback(req: any, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.body;

      // Handle OAuth error from Google
      if (error) {
        logger.warn("OAuth callback received error from Google", {
          error,
          state,
          ip: req.ip,
        });

        res.status(400).json({
          error: "Bad Request",
          message: `OAuth authentication failed: ${error}`,
          code: "OAUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (!code) {
        res.status(400).json({
          error: "Bad Request",
          message: "Authorization code is required",
          code: "MISSING_AUTH_CODE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Validate state parameter for CSRF protection
      // Note: In production, state should be validated against a session/cookie value
      // For now, we verify it exists and has the expected format
      if (!state || typeof state !== 'string' || state.length < 16) {
        logger.warn("OAuth callback received invalid state parameter", {
          state: state ? `${state.substring(0, 10)}...` : 'missing',
          ip: req.ip,
        });

        res.status(400).json({
          error: "Bad Request",
          message: "Invalid state parameter - possible CSRF attack",
          code: "INVALID_STATE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Exchange code for tokens
      const tokens = await services.oauth2.exchangeCodeForTokens(code);

      // Get user info from Google
      const userInfo = await services.oauth2.getUserInfo(tokens.access_token);

      // Store user and tokens in database
      const user = await services.oauth2.storeUserTokens(
        userInfo.id,
        userInfo.email,
        userInfo.name,
        tokens
      );

      // Generate JWT for session management
      const sessionToken = services.oauth2.generateJWT(user);

      logger.info("OAuth authentication successful", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token: sessionToken,
        message: "Authentication successful",
      });
    } catch (error) {
      logger.error("OAuth callback failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Authentication failed",
        code: "AUTH_CALLBACK_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Refresh JWT session token
   * POST /auth/refresh
   */
  async refresh(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Get user from database to generate new JWT
      const { userRepository } = await import("@/repositories/user.repository");
      const user = await userRepository.findById((req as any).user.userId);

      if (!user) {
        res.status(404).json({
          error: "Not Found",
          message: "User not found",
          code: "USER_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Generate new JWT
      const newToken = services.oauth2.generateJWT(user);

      logger.info("JWT token refreshed", {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        message: "Token refreshed successfully",
      });
    } catch (error) {
      logger.error("Token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req as any).user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to refresh token",
        code: "TOKEN_REFRESH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Logout user and revoke tokens
   * POST /auth/logout
   */
  async logout(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // In a real-world scenario, you would invalidate the token and HttpOnly cookie
      const userId = ((req as any).user as any)?.userId;

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      await services.oauth2.revokeTokens(userId);

      logger.info("User logged out successfully", {
        userId,
        // email: (req as any).user.email,
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      const userId = ((req as any).user as any)?.userId;
      logger.error("Logout failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to logout",
        code: "LOGOUT_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get current user's authentication status
   * GET /auth/status
   */
  async status(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.json({
          isAuthenticated: false,
          user: null,
          oauth: {
            isAuthenticated: false,
            scopes: [],
            needsReauth: true,
          },
        });
        return;
      }

      // Get OAuth status
      const oauthStatus = await services.oauth2.getOAuthStatus(
        ((req as any).user as any).userId
      );

      // Get user details
      const { userRepository } = await import("@/repositories/user.repository");
      const user = await userRepository.findById(((req as any).user as any).userId);

      res.json({
        isAuthenticated: true,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              createdAt: user.createdAt,
            }
          : null,
        oauth: oauthStatus,
      });
    } catch (error) {
      const userId = ((req as any).user as any)?.userId;
      logger.error("Failed to get auth status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get authentication status",
        code: "AUTH_STATUS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Force OAuth re-authentication
   * POST /auth/reauth
   */
  async reauth(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Generate new auth URL with force consent
      const authUrl = await services.oauth2.getAuthUrl();

      logger.info("OAuth re-authentication initiated", {
        userId: ((req as any).user as any).userId,
        // email: (req as any).user.email,
      });

      res.json({
        success: true,
        authUrl,
        message: "Re-authentication URL generated",
      });
    } catch (error) {
      const userId = ((req as any).user as any)?.userId;
      logger.error("Re-authentication failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to initiate re-authentication",
        code: "REAUTH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get user profile information
   * GET /auth/profile
   */
  async profile(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const { userRepository } = await import("@/repositories/user.repository");
      const user = await userRepository.findWithRelations(
        ((req as any).user as any).userId
      );

      if (!user) {
        res.status(404).json({
          error: "Not Found",
          message: "User profile not found",
          code: "PROFILE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Get user statistics
      const stats = await userRepository.getUserStats(((req as any).user as any).userId);

      res.json({
        success: true,
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        statistics: stats,
        recentActivity: {
          emails: user.processedEmails.slice(0, 5),
          schedules: user.schedules.slice(0, 5),
        },
        configuration: user.userConfig,
      });
    } catch (error) {
      const userId = ((req as any).user as any)?.userId;
      logger.error("Failed to get user profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get user profile",
        code: "PROFILE_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Test OAuth connection by making a simple Gmail API call
   * GET /auth/test
   */
  async testConnection(req: any, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const userId = ((req as any).user as any).userId;

      logger.info("Testing OAuth connection", { userId });

      // Get OAuth status first
      const oauthStatus = await services.oauth2.getOAuthStatus(userId);

      if (!oauthStatus.isAuthenticated) {
        res.status(401).json({
          success: false,
          connection: "failed",
          error: "OAuth not authenticated",
          message: "User needs to authenticate with Google",
          code: "OAUTH_NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
          oauth: oauthStatus,
        });
        return;
      }

      // Test Gmail API connection with a simple profile call
      try {
        const oauth2Client = await services.oauth2.getGoogleClient(userId);
        const { google } = await import("googleapis");
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Make a simple API call to test the connection
        const profile = await gmail.users.getProfile({ userId: "me" });

        logger.info("OAuth connection test successful", {
          userId,
          emailAddress: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
        });

        res.json({
          success: true,
          connection: "active",
          message: "OAuth connection is working correctly",
          gmail: {
            emailAddress: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
            threadsTotal: profile.data.threadsTotal,
          },
          oauth: {
            isAuthenticated: oauthStatus.isAuthenticated,
            scopes: oauthStatus.scopes,
            tokenExpiry: oauthStatus.tokenExpiry,
            needsReauth: oauthStatus.needsReauth,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (gmailError) {
        const errorMessage =
          gmailError instanceof Error ? gmailError.message : "Unknown error";

        logger.error("Gmail API connection test failed", {
          userId,
          error: errorMessage,
        });

        // Check if error indicates token expiry or revocation
        const needsReauth =
          errorMessage.includes("invalid_grant") ||
          errorMessage.includes("Token has been expired or revoked") ||
          errorMessage.includes("re-authenticate");

        res.status(needsReauth ? 401 : 500).json({
          success: false,
          connection: needsReauth ? "expired" : "error",
          error: errorMessage,
          message: needsReauth
            ? "OAuth tokens expired or revoked - re-authentication required"
            : "Failed to connect to Gmail API",
          code: needsReauth ? "OAUTH_EXPIRED" : "GMAIL_API_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
          oauth: {
            ...oauthStatus,
            needsReauth: true,
          },
        });
      }
    } catch (error) {
      const userId = ((req as any).user as any)?.userId;
      logger.error("OAuth connection test failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to test OAuth connection",
        code: "CONNECTION_TEST_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
