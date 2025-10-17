import { Request, Response } from "express";
import * as crypto from "crypto";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";

export interface SecureCookieOptions {
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  domain?: string;
}

/**
 * Secure Cookie Manager for JWT tokens
 * Implements HttpOnly, secure, and SameSite cookies for maximum security
 */
export class SecureCookieManager {
  private static readonly JWT_COOKIE_NAME = "stillontime_jwt";
  private static readonly REFRESH_COOKIE_NAME = "stillontime_refresh";
  private static readonly CSRF_COOKIE_NAME = "stillontime_csrf";

  private static readonly DEFAULT_OPTIONS: SecureCookieOptions = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
  };

  /**
   * Set JWT token in secure HttpOnly cookie
   */
  static setJWTToken(res: Response, token: string, expiresIn?: number): void {
    try {
      const options = {
        ...this.DEFAULT_OPTIONS,
        maxAge: expiresIn || this.DEFAULT_OPTIONS.maxAge,
      };

      // Validate token format
      if (!token || typeof token !== "string") {
        throw new Error("Invalid JWT token format");
      }

      // Set token in HttpOnly cookie
      res.cookie(this.JWT_COOKIE_NAME, token, options);

      // Also set non-HttpOnly indicator for frontend to know token exists
      // (without exposing the actual token)
      res.cookie("auth_status", "active", {
        maxAge: options.maxAge,
        httpOnly: false,
        secure: options.secure,
        sameSite: options.sameSite,
        path: "/",
      });

      logger.debug("JWT token set in secure cookie", {
        tokenLength: token.length,
        expiresIn: options.maxAge,
        secure: options.secure,
      });
    } catch (error) {
      logger.error("Failed to set JWT token in cookie", { error });
      throw new Error("Failed to set authentication token");
    }
  }

  /**
   * Set refresh token in secure HttpOnly cookie
   */
  static setRefreshToken(res: Response, refreshToken: string, expiresIn?: number): void {
    try {
      const options = {
        ...this.DEFAULT_OPTIONS,
        maxAge: expiresIn || 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      if (!refreshToken || typeof refreshToken !== "string") {
        throw new Error("Invalid refresh token format");
      }

      res.cookie(this.REFRESH_COOKIE_NAME, refreshToken, options);

      logger.debug("Refresh token set in secure cookie", {
        tokenLength: refreshToken.length,
        expiresIn: options.maxAge,
        secure: options.secure,
      });
    } catch (error) {
      logger.error("Failed to set refresh token in cookie", { error });
      throw new Error("Failed to set refresh token");
    }
  }

  /**
   * Get JWT token from secure cookie
   */
  static getJWTToken(req: Request): string | null {
    try {
      const token = req.cookies?.[this.JWT_COOKIE_NAME];

      if (!token) {
        logger.debug("JWT token not found in cookies");
        return null;
      }

      // Validate token format
      if (typeof token !== "string" || token.length < 10) {
        logger.warn("Invalid JWT token format in cookie");
        return null;
      }

      return token;
    } catch (error) {
      logger.error("Failed to get JWT token from cookie", { error });
      return null;
    }
  }

  /**
   * Get refresh token from secure cookie
   */
  static getRefreshToken(req: Request): string | null {
    try {
      const refreshToken = req.cookies?.[this.REFRESH_COOKIE_NAME];

      if (!refreshToken) {
        logger.debug("Refresh token not found in cookies");
        return null;
      }

      // Validate token format
      if (typeof refreshToken !== "string" || refreshToken.length < 10) {
        logger.warn("Invalid refresh token format in cookie");
        return null;
      }

      return refreshToken;
    } catch (error) {
      logger.error("Failed to get refresh token from cookie", { error });
      return null;
    }
  }

  /**
   * Clear all authentication cookies
   */
  static clearAuthCookies(res: Response): void {
    try {
      // Clear JWT token
      res.clearCookie(this.JWT_COOKIE_NAME, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
      });

      // Clear refresh token
      res.clearCookie(this.REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
      });

      // Clear auth status indicator
      res.clearCookie("auth_status", {
        httpOnly: false,
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
      });

      // Clear any old CSRF token
      res.clearCookie(this.CSRF_COOKIE_NAME, {
        httpOnly: false,
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
      });

      logger.debug("Authentication cookies cleared");
    } catch (error) {
      logger.error("Failed to clear authentication cookies", { error });
    }
  }

  /**
   * Check if user is authenticated based on cookie presence
   */
  static isAuthenticated(req: Request): boolean {
    const token = this.getJWTToken(req);
    return !!token;
  }

  /**
   * Generate secure fingerprint for additional security
   */
  static generateFingerprint(req: Request): string {
    const userAgent = req.get("User-Agent") || "";
    const acceptLanguage = req.get("Accept-Language") || "";
    const acceptEncoding = req.get("Accept-Encoding") || "";

    // Create fingerprint from stable request headers
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;

    return crypto
      .createHash("sha256")
      .update(fingerprintData)
      .digest("hex")
      .substring(0, 32);
  }

  /**
   * Validate request fingerprint against stored fingerprint
   */
  static validateFingerprint(req: Request, storedFingerprint: string): boolean {
    const currentFingerprint = this.generateFingerprint(req);
    return crypto.timingSafeEqual(
      Buffer.from(currentFingerprint, "hex"),
      Buffer.from(storedFingerprint, "hex")
    );
  }

  /**
   * Set CSRF token in non-HttpOnly cookie for frontend access
   */
  static setCSRFToken(res: Response, token: string): void {
    try {
      res.cookie(this.CSRF_COOKIE_NAME, token, {
        maxAge: 3600000, // 1 hour
        httpOnly: false, // Frontend needs to read this
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
      });

      // Also set in header for additional security
      res.setHeader("X-CSRF-Token", token);
    } catch (error) {
      logger.error("Failed to set CSRF token", { error });
    }
  }

  /**
   * Get CSRF token from cookie or header
   */
  static getCSRFToken(req: Request): string | null {
    return req.cookies?.[this.CSRF_COOKIE_NAME] || req.get("X-CSRF-Token") || null;
  }
}