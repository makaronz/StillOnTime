import { OAuth2Service } from "@/services/oauth2.service";
import { UserRepository } from "@/repositories/user.repository";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";
import * as jwt from "jsonwebtoken";

// Mock dependencies
jest.mock("@/repositories/user.repository");
jest.mock("@/utils/logger");
jest.mock("googleapis");
jest.mock("@/config/config", () => ({
  config: {
    google: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/auth/callback",
    },
    jwtSecret: "test-jwt-secret",
  },
}));

const mockUserRepository = {
  findById: jest.fn(),
  findByGoogleId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as jest.Mocked<Partial<UserRepository>>;

const mockOAuth2Client = {
  generateAuthUrl: jest.fn(),
  getToken: jest.fn(),
  setCredentials: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
};

// Mock googleapis
jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client),
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn(),
      },
    }),
  },
}));

describe("OAuth2Service", () => {
  let oauth2Service: OAuth2Service;

  beforeEach(() => {
    jest.clearAllMocks();
    oauth2Service = new OAuth2Service(mockUserRepository as UserRepository);
  });

  describe("getAuthUrl", () => {
    it("should generate authorization URL with correct parameters", async () => {
      const expectedUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test";
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = await oauth2Service.getAuthUrl("test-state");

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
        prompt: "consent",
        state: "test-state",
        include_granted_scopes: true,
      });
      expect(result).toBe(expectedUrl);
    });

    it("should generate random state if not provided", async () => {
      const expectedUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test";
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      await oauth2Service.getAuthUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(String),
        })
      );
    });

    it("should throw error if URL generation fails", async () => {
      mockOAuth2Client.generateAuthUrl.mockImplementation(() => {
        throw new Error("OAuth client error");
      });

      await expect(oauth2Service.getAuthUrl()).rejects.toThrow(
        "Failed to generate authorization URL"
      );
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange authorization code for tokens", async () => {
      const mockTokens = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await oauth2Service.exchangeCodeForTokens("auth-code");

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith("auth-code");
      expect(result).toEqual({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: expect.any(Number),
        token_type: "Bearer",
      });
    });

    it("should throw error if no access token received", async () => {
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: {} });

      await expect(
        oauth2Service.exchangeCodeForTokens("auth-code")
      ).rejects.toThrow("Failed to exchange authorization code for tokens");
    });

    it("should handle token exchange errors", async () => {
      mockOAuth2Client.getToken.mockRejectedValue(new Error("Invalid code"));

      await expect(
        oauth2Service.exchangeCodeForTokens("invalid-code")
      ).rejects.toThrow("Failed to exchange authorization code for tokens");
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token using refresh token", async () => {
      const mockCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await oauth2Service.refreshAccessToken("refresh-token");

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: "refresh-token",
      });
      expect(result).toEqual({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: expect.any(Number),
        token_type: "Bearer",
      });
    });

    it("should keep existing refresh token if not provided", async () => {
      const mockCredentials = {
        access_token: "new-access-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await oauth2Service.refreshAccessToken("refresh-token");

      expect(result.refresh_token).toBe("refresh-token");
    });

    it("should throw error if refresh fails", async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error("Invalid refresh token")
      );

      await expect(
        oauth2Service.refreshAccessToken("invalid-token")
      ).rejects.toThrow("Failed to refresh access token");
    });
  });

  describe("storeUserTokens", () => {
    it("should create new user if not exists", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-id",
      };
      mockUserRepository.findByGoogleId!.mockResolvedValue(null);
      mockUserRepository.create!.mockResolvedValue(mockUser as any);

      const tokens = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      };

      const result = await oauth2Service.storeUserTokens(
        "google-id",
        "test@example.com",
        "Test User",
        tokens
      );

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        googleId: "google-id",
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenExpiry: expect.any(Date),
      });
      expect(result).toEqual(mockUser);
    });

    it("should update existing user if found", async () => {
      const existingUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-id",
      };
      const updatedUser = { ...existingUser, name: "Updated User" };

      mockUserRepository.findByGoogleId!.mockResolvedValue(existingUser as any);
      mockUserRepository.update!.mockResolvedValue(updatedUser as any);

      const tokens = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      };

      const result = await oauth2Service.storeUserTokens(
        "google-id",
        "test@example.com",
        "Updated User",
        tokens
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-id", {
        email: "test@example.com",
        name: "Updated User",
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenExpiry: expect.any(Date),
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe("generateJWT", () => {
    it("should generate valid JWT token", () => {
      const user = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
      };

      const token = oauth2Service.generateJWT(user as any);

      expect(typeof token).toBe("string");

      // Verify token can be decoded
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      expect(decoded.userId).toBe("user-id");
      expect(decoded.email).toBe("test@example.com");
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe("verifyJWT", () => {
    it("should verify and decode valid JWT token", () => {
      const payload = {
        userId: "user-id",
        email: "test@example.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = jwt.sign(payload, config.jwtSecret);

      const result = oauth2Service.verifyJWT(token);

      expect(result.userId).toBe("user-id");
      expect(result.email).toBe("test@example.com");
    });

    it("should throw error for invalid token", () => {
      expect(() => oauth2Service.verifyJWT("invalid-token")).toThrow(
        "Invalid or expired session token"
      );
    });

    it("should throw error for expired token", () => {
      const payload = {
        userId: "user-id",
        email: "test@example.com",
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };
      const token = jwt.sign(payload, config.jwtSecret);

      expect(() => oauth2Service.verifyJWT(token)).toThrow(
        "Invalid or expired session token"
      );
    });
  });

  describe("getOAuthStatus", () => {
    it("should return unauthenticated status for user without tokens", async () => {
      mockUserRepository.findById!.mockResolvedValue(null);

      const result = await oauth2Service.getOAuthStatus("user-id");

      expect(result).toEqual({
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      });
    });

    it("should return authenticated status for user with valid tokens", async () => {
      const user = {
        id: "user-id",
        accessToken: "encrypted-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      const result = await oauth2Service.getOAuthStatus("user-id");

      expect(result).toEqual({
        isAuthenticated: true,
        scopes: expect.arrayContaining([
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar",
        ]),
        expiresAt: user.tokenExpiry,
        needsReauth: false,
      });
    });

    it("should return needs reauth for expired token without refresh token", async () => {
      const user = {
        id: "user-id",
        accessToken: "encrypted-token",
        refreshToken: null,
        tokenExpiry: new Date(Date.now() - 3600000), // 1 hour ago
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      const result = await oauth2Service.getOAuthStatus("user-id");

      expect(result).toEqual({
        isAuthenticated: false,
        scopes: expect.any(Array),
        expiresAt: user.tokenExpiry,
        needsReauth: true,
      });
    });
  });

  describe("revokeTokens", () => {
    it("should revoke tokens and clear from database", async () => {
      const user = {
        id: "user-id",
        accessToken: "encrypted-token",
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);
      mockUserRepository.update!.mockResolvedValue(user as any);
      mockOAuth2Client.revokeToken.mockResolvedValue(undefined);

      await oauth2Service.revokeTokens("user-id");

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-id", {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });
    });

    it("should handle revocation errors gracefully", async () => {
      const user = {
        id: "user-id",
        accessToken: "encrypted-token",
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);
      mockUserRepository.update!.mockResolvedValue(user as any);
      mockOAuth2Client.revokeToken.mockRejectedValue(
        new Error("Token already revoked")
      );

      // Should not throw error
      await expect(
        oauth2Service.revokeTokens("user-id")
      ).resolves.not.toThrow();

      // Should still clear tokens from database
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-id", {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });
    });
  });
});
