import { google, Auth } from "googleapis";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";
import { TokenSet, User } from "@/types";
import { UserRepository } from "@/repositories/user.repository";

export interface OAuthStatus {
  isAuthenticated: boolean;
  scopes: string[];
  expiresAt?: Date;
  needsReauth: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export class OAuth2Service {
  private oauth2Client: Auth.OAuth2Client;
  private userRepository: UserRepository;

  // Required scopes for StillOnTime functionality
  private readonly REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  /**
   * Generate authorization URL with required scopes and PKCE
   */
  async getAuthUrl(state?: string): Promise<{ authUrl: string; state: string }> {
    try {
      const generatedState = state || crypto.randomBytes(32).toString("hex");
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: this.REQUIRED_SCOPES,
        prompt: "consent", // Force consent to get refresh token
        state: generatedState,
        include_granted_scopes: true,
      });

      logger.info("Generated OAuth authorization URL", {
        scopes: this.REQUIRED_SCOPES,
        state: generatedState,
      });

      return { authUrl, state: generatedState };
    } catch (error) {
      logger.error("Failed to generate auth URL", { error });
      throw new Error("Failed to generate authorization URL");
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error("No access token received");
      }

      const tokenSet: TokenSet = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_in: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : 3600,
        token_type: "Bearer",
      };

      logger.info("Successfully exchanged code for tokens", {
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokenSet.expires_in,
      });

      return tokenSet;
    } catch (error) {
      logger.error("Failed to exchange code for tokens", {
        error,
        code: code.substring(0, 10) + "...",
      });
      throw new Error("Failed to exchange authorization code for tokens");
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error("No access token received during refresh");
      }

      const tokenSet: TokenSet = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken, // Keep existing if not provided
        expires_in: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
        token_type: "Bearer",
      };

      logger.info("Successfully refreshed access token", {
        expiresIn: tokenSet.expires_in,
      });

      return tokenSet;
    } catch (error) {
      logger.error("Failed to refresh access token", { error });
      throw new Error("Failed to refresh access token");
    }
  }

  /**
   * Get authenticated Google client for a user
   */
  async getGoogleClient(userId: string): Promise<Auth.OAuth2Client> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.accessToken) {
        throw new Error("User has no access token");
      }

      // Check if token needs refresh
      const now = new Date();
      const tokenExpiry = user.tokenExpiry;

      if (tokenExpiry && tokenExpiry <= now) {
        if (!user.refreshToken) {
          throw new Error(
            "Access token expired and no refresh token available"
          );
        }

        // Refresh the token
        const newTokens = await this.refreshAccessToken(user.refreshToken);

        // Update user with new tokens
        await this.userRepository.update(userId, {
          accessToken: this.encryptToken(newTokens.access_token),
          refreshToken: newTokens.refresh_token
            ? this.encryptToken(newTokens.refresh_token)
            : user.refreshToken,
          tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
        });

        // Set credentials on client
        this.oauth2Client.setCredentials({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expiry_date: Date.now() + newTokens.expires_in * 1000,
        });
      } else {
        // Use existing token
        const decryptedAccessToken = this.decryptToken(user.accessToken);
        const decryptedRefreshToken = user.refreshToken
          ? this.decryptToken(user.refreshToken)
          : undefined;

        this.oauth2Client.setCredentials({
          access_token: decryptedAccessToken,
          refresh_token: decryptedRefreshToken,
          expiry_date: tokenExpiry?.getTime(),
        });
      }

      return this.oauth2Client;
    } catch (error) {
      logger.error("Failed to get Google client for user", { userId, error });
      throw error;
    }
  }

  /**
   * Store tokens for a user after successful authentication
   */
  async storeUserTokens(
    googleId: string,
    email: string,
    name: string,
    tokens: TokenSet
  ): Promise<User> {
    try {
      const encryptedAccessToken = this.encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? this.encryptToken(tokens.refresh_token)
        : undefined;

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      // Use atomic upsert to prevent race conditions
      const user = await this.userRepository.createOrUpdateFromOAuth({
        googleId,
        email,
        name,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
      });

      logger.info("Successfully stored user tokens", {
        userId: user.id,
        email: user.email,
        hasRefreshToken: !!tokens.refresh_token,
      });

      return user;
    } catch (error) {
      logger.error("Failed to store user tokens", { 
        googleId, 
        email, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw new Error("Failed to store user authentication tokens");
    }
  }

  /**
   * Revoke tokens and clear user authentication
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.accessToken) {
        logger.warn("Attempted to revoke tokens for user without tokens", {
          userId,
        });
        return;
      }

      const decryptedAccessToken = this.decryptToken(user.accessToken);

      // Revoke token with Google
      try {
        await this.oauth2Client.revokeToken(decryptedAccessToken);
      } catch (revokeError) {
        logger.warn(
          "Failed to revoke token with Google (token may already be invalid)",
          {
            userId,
            error: revokeError,
          }
        );
      }

      // Clear tokens from database
      await this.userRepository.update(userId, {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });

      logger.info("Successfully revoked tokens for user", { userId });
    } catch (error) {
      logger.error("Failed to revoke tokens", { userId, error });
      throw new Error("Failed to revoke authentication tokens");
    }
  }

  /**
   * Get OAuth status for a user
   */
  async getOAuthStatus(userId: string): Promise<OAuthStatus> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user || !user.accessToken) {
        return {
          isAuthenticated: false,
          scopes: [],
          needsReauth: true,
        };
      }

      const now = new Date();
      const isExpired = user.tokenExpiry ? user.tokenExpiry <= now : true;
      const hasRefreshToken = !!user.refreshToken;

      return {
        isAuthenticated: !isExpired || hasRefreshToken,
        scopes: this.REQUIRED_SCOPES,
        expiresAt: user.tokenExpiry || undefined,
        needsReauth: isExpired && !hasRefreshToken,
      };
    } catch (error) {
      logger.error("Failed to get OAuth status", { userId, error });
      return {
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      };
    }
  }

  /**
   * Generate JWT token for session management
   */
  generateJWT(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(payload, config.jwtSecret);
  }

  /**
   * Verify and decode JWT token
   */
  verifyJWT(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch (error) {
      logger.error("Failed to verify JWT token", { error });
      throw new Error("Invalid or expired session token");
    }
  }

  /**
   * Encrypt sensitive token data using AES-256-GCM with unique salt
   * Format: salt:iv:authTag:encrypted
   */
  private encryptToken(token: string): string {
    const algorithm = "aes-256-gcm";
    
    // Generate unique salt per token (not hardcoded)
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(config.jwtSecret, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get authentication tag for GCM mode
    const authTag = cipher.getAuthTag();

    // Store: salt:iv:authTag:encrypted
    return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt sensitive token data using AES-256-GCM
   * Expected format: salt:iv:authTag:encrypted
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const algorithm = "aes-256-gcm";

      const parts = encryptedToken.split(":");
      
      // Support both old format (iv:encrypted) and new format (salt:iv:authTag:encrypted)
      if (parts.length === 2) {
        // Old format - fallback to old decryption for backward compatibility
        logger.warn("Decrypting token using legacy format - token should be re-encrypted");
        const key = crypto.scryptSync(config.jwtSecret, "salt", 32);
        const iv = Buffer.from(parts[0], "hex");
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      }
      
      if (parts.length !== 4) {
        throw new Error("Invalid encrypted token format (expected salt:iv:authTag:encrypted)");
      }

      const salt = Buffer.from(parts[0], "hex");
      const iv = Buffer.from(parts[1], "hex");
      const authTag = Buffer.from(parts[2], "hex");
      const encrypted = parts[3];

      // Derive key using the same salt that was used for encryption
      const key = crypto.scryptSync(config.jwtSecret, salt, 32);

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error("Failed to decrypt token", { error });
      throw new Error("Failed to decrypt authentication token");
    }
  }

  /**
   * Get user info from Google using access token
   */
  async getUserInfo(
    accessToken: string
  ): Promise<{ id: string; email: string; name: string }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      if (!data.id || !data.email) {
        throw new Error("Incomplete user information received from Google");
      }

      return {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
      };
    } catch (error) {
      logger.error("Failed to get user info from Google", { error });
      throw new Error("Failed to retrieve user information from Google");
    }
  }
}
