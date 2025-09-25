import { Request, Response } from "express";
import { services } from "@/services";
import { logger } from "@/utils/logger";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";

/**
 * Authentication Controller
 * Handles OAuth 2.0 authentication flow with Google
 */
export class AuthController {
  /**
   * Initiate OAuth 2.0 authentication flow
   * GET /auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const state = req.query.state as string;
      const authUrl = await services.oauth2.getAuthUrl(state);

      logger.info("OAuth login initiated", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        state,
      });

      res.json({
        success: true,
        authUrl,
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
  async callback(req: Request, res: Response): Promise<void> {
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
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
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
      const userRepository = new (
        await import("@/repositories/user.repository")
      ).UserRepository();
      const user = await userRepository.findById(req.user.userId);

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
        userId: req.user?.userId,
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
  async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Revoke OAuth tokens
      await services.oauth2.revokeTokens(req.user.userId);

      logger.info("User logged out successfully", {
        userId: req.user.userId,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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
  async status(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
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
      const oauthStatus = await services.oauth2.getOAuthStatus(req.user.userId);

      // Get user details
      const userRepository = new (
        await import("@/repositories/user.repository")
      ).UserRepository();
      const user = await userRepository.findById(req.user.userId);

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
      logger.error("Failed to get auth status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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
  async reauth(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
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
        userId: req.user.userId,
        email: req.user.email,
      });

      res.json({
        success: true,
        authUrl,
        message: "Re-authentication URL generated",
      });
    } catch (error) {
      logger.error("Re-authentication failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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
  async profile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "NOT_AUTHENTICATED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const userRepository = new (
        await import("@/repositories/user.repository")
      ).UserRepository();
      const user = await userRepository.findWithRelations(req.user.userId);

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
      const stats = await userRepository.getUserStats(req.user.userId);

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
      logger.error("Failed to get user profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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
}

// Export singleton instance
export const authController = new AuthController();
