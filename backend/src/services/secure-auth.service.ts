import { Request, Response } from "express";
import { OAuth2Service, JWTPayload } from "./oauth2.service";
import { UserRepository } from "@/repositories/user.repository";
import { SecureCookieManager } from "@/utils/cookies";
import { logger } from "@/utils/logger";
import { config } from "@/config/config";

export interface SecureAuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  message?: string;
  expiresIn?: number;
}

export interface TokenRefreshResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  expiresIn?: number;
  message?: string;
}

/**
 * Secure Authentication Service
 * Implements secure cookie-based authentication replacing localStorage approach
 */
export class SecureAuthService {
  private oauth2Service: OAuth2Service;
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    this.oauth2Service = new OAuth2Service(userRepository);
  }

  /**
   * Secure login that sets JWT token in HttpOnly cookie
   */
  async loginWithToken(res: Response, token: string): Promise<SecureAuthResponse> {
    try {
      // Verify JWT token
      const decoded = this.oauth2Service.verifyJWT(token);

      // Get user information
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Set JWT token in secure cookie
      SecureCookieManager.setJWTToken(res, token, 24 * 60 * 60 * 1000); // 24 hours

      logger.info("User logged in successfully with secure cookies", {
        userId: user.id,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        },
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      };
    } catch (error) {
      logger.error("Secure login failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Clear any existing cookies on failure
      SecureCookieManager.clearAuthCookies(res);

      return {
        success: false,
        message: "Authentication failed",
      };
    }
  }

  /**
   * OAuth callback handler that sets secure cookies
   */
  async handleOAuthCallback(
    req: Request,
    res: Response,
    code: string,
    state: string
  ): Promise<SecureAuthResponse> {
    try {
      // Exchange authorization code for tokens
      const tokens = await this.oauth2Service.exchangeCodeForTokens(code);

      // Get user info from Google
      const userInfo = await this.oauth2Service.getUserInfo(tokens.access_token);

      // Store user tokens in database
      const user = await this.oauth2Service.storeUserTokens(
        userInfo.id,
        userInfo.email,
        userInfo.name,
        tokens
      );

      // Generate JWT token
      const jwtToken = this.oauth2Service.generateJWT(user);

      // Set JWT token in secure cookie
      const expiresIn = 24 * 60 * 60 * 1000; // 24 hours
      SecureCookieManager.setJWTToken(res, jwtToken, expiresIn);

      // Set CSRF token for additional security
      const csrfToken = require("crypto").randomBytes(32).toString("hex");
      SecureCookieManager.setCSRFToken(res, csrfToken);

      logger.info("OAuth callback handled successfully with secure cookies", {
        userId: user.id,
        email: user.email,
        hasRefreshToken: !!tokens.refresh_token,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        },
        expiresIn: Math.floor(expiresIn / 1000), // Convert to seconds
      };
    } catch (error) {
      logger.error("OAuth callback handling failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Clear any existing cookies on failure
      SecureCookieManager.clearAuthCookies(res);

      return {
        success: false,
        message: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Refresh JWT token using refresh token from secure cookie
   */
  async refreshToken(req: Request, res: Response): Promise<TokenRefreshResponse> {
    try {
      const refreshToken = SecureCookieManager.getRefreshToken(req);

      if (!refreshToken) {
        return {
          success: false,
          message: "No refresh token available",
        };
      }

      // Get current user from refresh token
      const currentToken = SecureCookieManager.getJWTToken(req);
      if (!currentToken) {
        return {
          success: false,
          message: "No current session found",
        };
      }

      const decoded = this.oauth2Service.verifyJWT(currentToken);
      const user = await this.userRepository.findById(decoded.userId);

      if (!user || !user.refreshToken) {
        SecureCookieManager.clearAuthCookies(res);
        return {
          success: false,
          message: "User session invalid",
        };
      }

      // Refresh the Google OAuth tokens
      const newTokens = await this.oauth2Service.refreshAccessToken(refreshToken);

      // Update user tokens in database
      await this.userRepository.update(user.id, {
        accessToken: this.oauth2Service.encryptToken(newTokens.access_token),
        refreshToken: newTokens.refresh_token
          ? this.oauth2Service.encryptToken(newTokens.refresh_token)
          : user.refreshToken,
        tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
      });

      // Generate new JWT token
      const newJwtToken = this.oauth2Service.generateJWT(user);

      // Set new JWT token in secure cookie
      const expiresIn = 24 * 60 * 60 * 1000; // 24 hours
      SecureCookieManager.setJWTToken(res, newJwtToken, expiresIn);

      // Update refresh token cookie if new one provided
      if (newTokens.refresh_token) {
        const refreshExpiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
        SecureCookieManager.setRefreshToken(res, newTokens.refresh_token, refreshExpiresIn);
      }

      logger.info("Token refreshed successfully", {
        userId: user.id,
        email: user.email,
      });

      return {
        success: true,
        token: newJwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        },
        expiresIn: Math.floor(expiresIn / 1000), // Convert to seconds
      };
    } catch (error) {
      logger.error("Token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Clear all cookies on refresh failure
      SecureCookieManager.clearAuthCookies(res);

      return {
        success: false,
        message: "Token refresh failed - please login again",
      };
    }
  }

  /**
   * Secure logout that clears all authentication cookies
   */
  async logout(req: Request, res: Response): Promise<{ success: boolean; message: string }> {
    try {
      const token = SecureCookieManager.getJWTToken(req);

      if (token) {
        try {
          const decoded = this.oauth2Service.verifyJWT(token);

          // Revoke OAuth tokens
          await this.oauth2Service.revokeTokens(decoded.userId);

          logger.info("User logged out successfully", {
            userId: decoded.userId,
          });
        } catch (error) {
          logger.warn("Failed to verify token during logout", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Clear all authentication cookies
      SecureCookieManager.clearAuthCookies(res);

      return {
        success: true,
        message: "Logged out successfully",
      };
    } catch (error) {
      logger.error("Logout failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Still clear cookies even if logout fails
      SecureCookieManager.clearAuthCookies(res);

      return {
        success: true,
        message: "Logged out successfully",
      };
    }
  }

  /**
   * Validate current session from secure cookies
   */
  async validateSession(req: Request): Promise<SecureAuthResponse> {
    try {
      const token = SecureCookieManager.getJWTToken(req);

      if (!token) {
        return {
          success: false,
          message: "No active session found",
        };
      }

      const decoded = this.oauth2Service.verifyJWT(token);
      const user = await this.userRepository.findById(decoded.userId);

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        },
      };
    } catch (error) {
      logger.error("Session validation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        message: "Invalid session",
      };
    }
  }

  /**
   * Get CSRF token for frontend
   */
  getCSRFToken(): string {
    return require("crypto").randomBytes(32).toString("hex");
  }

  /**
   * Set up secure authentication cookies for OAuth flow
   */
  setupOAuthCookies(res: Response, state: string): void {
    // Store OAuth state temporarily
    res.cookie("oauth_state", state, {
      maxAge: 10 * 60 * 1000, // 10 minutes
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "strict",
      path: "/",
    });

    // Set CSRF token for OAuth flow
    const csrfToken = this.getCSRFToken();
    SecureCookieManager.setCSRFToken(res, csrfToken);
  }

  /**
   * Validate OAuth state from secure cookie
   */
  validateOAuthState(req: Request, state: string): boolean {
    const storedState = req.cookies?.oauth_state;

    if (!storedState) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
      const crypto = require("crypto");
      return crypto.timingSafeEqual(
        Buffer.from(state, "utf8"),
        Buffer.from(storedState, "utf8")
      );
    } catch (error) {
      return false;
    }
  }
}