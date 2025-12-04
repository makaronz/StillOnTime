import { Response } from "express"
import { AppRequest } from "@/types/requests";
import { SecureAuthService } from "@/services/secure-auth.service";
import { UserRepository } from "@/repositories/user.repository";
import { logger } from "@/utils/logger";
import { OAuth2Service } from "@/services/oauth2.service";

/**
 * Enhanced Secure Authentication Controller
 * Implements secure cookie-based authentication replacing localStorage approach
 */
export class SecureAuthController {
  private secureAuthService: SecureAuthService;
  private oauth2Service: OAuth2Service;

  constructor() {
    const userRepository = new UserRepository();
    this.secureAuthService = new SecureAuthService(userRepository);
    this.oauth2Service = new OAuth2Service(userRepository);
  }

  /**
   * Initiate OAuth login flow with secure cookies
   */
  async login(req: AppRequest, res: Response): Promise<void> {
    try {
      const { state } = req.query;

      // Generate OAuth URL and state
      const { authUrl, state: generatedState } = await this.oauth2Service.getAuthUrl(
        state as string
      );

      // Set up secure cookies for OAuth flow
      this.secureAuthService.setupOAuthCookies(res, generatedState);

      logger.info("OAuth login initiated with secure cookies", {
        state: generatedState,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({
        success: true,
        authUrl,
        state: generatedState,
        expiresIn: 600, // 10 minutes
      });
    } catch (error) {
      logger.error("OAuth login initiation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to initiate authentication",
        code: "OAUTH_INIT_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle OAuth callback with secure cookies
   */
  async callback(req: AppRequest, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.body;

      // Handle OAuth errors
      if (error) {
        logger.warn("OAuth callback error", {
          error,
          state,
          ip: req.ip,
        });

        res.status(400).json({
          error: "Bad Request",
          message: "OAuth authorization failed",
          code: "OAUTH_ERROR",
          details: error,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!code || !state) {
        res.status(400).json({
          error: "Bad Request",
          message: "Missing authorization code or state parameter",
          code: "MISSING_OAUTH_PARAMS",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate OAuth state using secure comparison
      if (!this.secureAuthService.validateOAuthState(req, state)) {
        logger.warn("OAuth state validation failed - potential CSRF attack", {
          providedState: state,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        });

        res.status(403).json({
          error: "Forbidden",
          message: "Invalid state parameter",
          code: "INVALID_OAUTH_STATE",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Handle OAuth callback with secure cookies
      const result = await this.secureAuthService.handleOAuthCallback(req, res, code, state);

      if (!result.success) {
        res.status(401).json({
          error: "Unauthorized",
          message: result.message || "Authentication failed",
          code: "OAUTH_CALLBACK_FAILED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Clear temporary OAuth state cookie
      res.clearCookie("oauth_state", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      res.json({
        success: true,
        user: result.user,
        expiresIn: result.expiresIn,
        message: "Authentication successful",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("OAuth callback handling failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Authentication failed",
        code: "OAUTH_CALLBACK_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Refresh JWT token using secure cookies
   */
  async refresh(req: AppRequest, res: Response): Promise<void> {
    try {
      const result = await this.secureAuthService.refreshToken(req, res);

      if (!result.success) {
        res.status(401).json({
          error: "Unauthorized",
          message: result.message || "Token refresh failed",
          code: "TOKEN_REFRESH_FAILED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        user: result.user,
        expiresIn: result.expiresIn,
        message: "Token refreshed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Token refresh failed",
        code: "TOKEN_REFRESH_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Secure logout that clears all authentication cookies
   */
  async logout(req: AppRequest, res: Response): Promise<void> {
    try {
      const result = await this.secureAuthService.logout(req, res);

      res.json({
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Logout failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Logout failed",
        code: "LOGOUT_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Force OAuth re-authentication
   */
  async reauth(req: AppRequest, res: Response): Promise<void> {
    try {
      // Clear current authentication cookies
      const { clearAuthCookies } = require("@/utils/cookies");
      clearAuthCookies(res);

      // Generate new OAuth URL
      const { authUrl, state } = await this.oauth2Service.getAuthUrl();

      // Set up secure cookies for new OAuth flow
      this.secureAuthService.setupOAuthCookies(res, state);

      logger.info("OAuth re-authentication initiated", {
        userId: (req as any).user?.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        authUrl,
        state,
        expiresIn: 600, // 10 minutes
        message: "Re-authentication required",
      });
    } catch (error) {
      logger.error("Re-authentication initiation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req as any).user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to initiate re-authentication",
        code: "REAUTH_INIT_FAILED",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get authentication status from secure cookies
   */
  async status(req: AppRequest, res: Response): Promise<void> {
    try {
      const result = await this.secureAuthService.validateSession(req);

      // Include additional security context
      const securityContext = {
        isAuthenticated: result.success,
        hasCSRFToken: !!req.cookies?.stillontime_csrf,
        hasAuthStatus: req.cookies?.auth_status === "active",
        secureCookies: Object.keys(req.cookies || {}).filter(key =>
          key.startsWith("stillontime_") || key === "auth_status"
        ),
      };

      res.json({
        success: true,
        authenticated: result.success,
        user: result.user,
        security: securityContext,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Status check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Status check failed",
        code: "STATUS_CHECK_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get user profile with secure authentication
   */
  async profile(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!(req as any).user) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { userId } = (req as any).user;

      // Get user from database
      const user = await new UserRepository().findById(userId);
      if (!user) {
        res.status(404).json({
          error: "Not Found",
          message: "User not found",
          code: "USER_NOT_FOUND",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get OAuth status
      const oauthStatus = await this.oauth2Service.getOAuthStatus(userId);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        oauth: {
          isAuthenticated: oauthStatus.isAuthenticated,
          scopes: oauthStatus.scopes,
          expiresAt: oauthStatus.expiresAt,
          needsReauth: oauthStatus.needsReauth,
        },
        security: {
          lastActivity: new Date().toISOString(),
          sessionType: "secure_cookies",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Profile retrieval failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: (req as any).user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Profile retrieval failed",
        code: "PROFILE_RETRIEVAL_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get CSRF token for frontend
   */
  async getCSRFToken(req: AppRequest, res: Response): Promise<void> {
    try {
      const csrfToken = this.secureAuthService.getCSRFToken();

      // Set CSRF token in both cookie and header
      const { SecureCookieManager } = require("@/utils/cookies");
      SecureCookieManager.setCSRFToken(res, csrfToken);

      res.json({
        success: true,
        csrfToken,
        expiresIn: 3600, // 1 hour
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("CSRF token generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "CSRF token generation failed",
        code: "CSRF_TOKEN_GENERATION_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const secureAuthController = new SecureAuthController();