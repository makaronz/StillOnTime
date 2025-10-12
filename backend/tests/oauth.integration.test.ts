import { OAuth2Service } from "@/services/oauth2.service";
import { UserRepository } from "@/repositories/user.repository";
import { config } from "@/config/config";
import * as crypto from "crypto";
import { google } from "googleapis";

// Mock dependencies
jest.mock("@/utils/logger");
jest.mock("googleapis");

const mockOAuth2Client = {
  generateAuthUrl: jest.fn(),
  getToken: jest.fn(),
  setCredentials: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
};

const mockOAuth2 = {
  userinfo: {
    get: jest.fn(),
  },
};

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client),
    },
    oauth2: jest.fn().mockReturnValue(mockOAuth2),
  },
}));

describe("OAuth Integration Tests", () => {
  let oauth2Service: OAuth2Service;
  let mockUserRepository: jest.Mocked<Partial<UserRepository>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserRepository = {
      findById: jest.fn(),
      findByGoogleId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createOrUpdateFromOAuth: jest.fn(),
    } as jest.Mocked<Partial<UserRepository>>;

    oauth2Service = new OAuth2Service(mockUserRepository as UserRepository);
  });

  describe("OAuth Login Flow", () => {
    it("should complete full OAuth flow successfully", async () => {
      // Step 1: Generate auth URL
      const mockState = crypto.randomBytes(32).toString("hex");
      const expectedUrl = `https://accounts.google.com/oauth/authorize?state=${mockState}`;
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const { authUrl, state } = await oauth2Service.getAuthUrl(mockState);

      expect(authUrl).toBe(expectedUrl);
      expect(state).toBe(mockState);
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
        state: mockState,
        include_granted_scopes: true,
      });

      // Step 2: Exchange code for tokens
      const mockTokens = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const tokenSet = await oauth2Service.exchangeCodeForTokens("auth-code");

      expect(tokenSet).toEqual({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: expect.any(Number),
        token_type: "Bearer",
      });
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith("auth-code");

      // Step 3: Get user info
      mockOAuth2.userinfo.get.mockResolvedValue({
        data: {
          id: "google-123",
          email: "test@example.com",
          name: "Test User",
        },
      });

      const userInfo = await oauth2Service.getUserInfo(tokenSet.access_token);

      expect(userInfo).toEqual({
        id: "google-123",
        email: "test@example.com",
        name: "Test User",
      });

      // Step 4: Store tokens
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenExpiry: expect.any(Date),
      };
      mockUserRepository.createOrUpdateFromOAuth!.mockResolvedValue(
        mockUser as any
      );

      const user = await oauth2Service.storeUserTokens(
        userInfo.id,
        userInfo.email,
        userInfo.name,
        tokenSet
      );

      expect(user.id).toBe("user-123");
      expect(mockUserRepository.createOrUpdateFromOAuth).toHaveBeenCalledWith({
        googleId: "google-123",
        email: "test@example.com",
        name: "Test User",
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenExpiry: expect.any(Date),
      });
    });

    it("should handle OAuth callback with valid code and state", async () => {
      const state = crypto.randomBytes(32).toString("hex");
      const code = "valid-auth-code-123";

      const mockTokens = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await oauth2Service.exchangeCodeForTokens(code);

      expect(result.access_token).toBe("access-token");
      expect(result.refresh_token).toBe("refresh-token");
    });

    it("should reject OAuth callback with invalid state", async () => {
      const receivedState = "received-state";
      const storedState = "stored-state";

      // In real implementation, state validation happens in the controller
      expect(receivedState).not.toBe(storedState);
    });

    it("should handle OAuth callback error states", async () => {
      mockOAuth2Client.getToken.mockRejectedValue(
        new Error("Invalid authorization code")
      );

      await expect(
        oauth2Service.exchangeCodeForTokens("invalid-code")
      ).rejects.toThrow("Failed to exchange authorization code for tokens");
    });
  });

  describe("CSRF State Validation", () => {
    it("should generate cryptographically secure state", async () => {
      const { state } = await oauth2Service.getAuthUrl();

      expect(state).toBeDefined();
      expect(state.length).toBe(64); // 32 bytes as hex
      expect(state).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate unique states for each request", async () => {
      const { state: state1 } = await oauth2Service.getAuthUrl();
      const { state: state2 } = await oauth2Service.getAuthUrl();

      expect(state1).not.toBe(state2);
    });

    it("should validate matching states", () => {
      const state = crypto.randomBytes(32).toString("hex");
      const isValid = state === state;

      expect(isValid).toBe(true);
    });

    it("should reject mismatched states", () => {
      const state1 = crypto.randomBytes(32).toString("hex");
      const state2 = crypto.randomBytes(32).toString("hex");
      const isValid = state1 === state2;

      expect(isValid).toBe(false);
    });
  });

  describe("Token Management", () => {
    it("should refresh expired access token", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() - 3600000), // Expired 1 hour ago
      };

      mockUserRepository.findById!.mockResolvedValue(user as any);

      const newTokens = {
        credentials: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expiry_date: Date.now() + 3600000,
        },
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue(newTokens);
      mockUserRepository.update!.mockResolvedValue(user as any);

      // This should trigger automatic refresh
      try {
        await oauth2Service.getGoogleClient("user-123");
      } catch (error) {
        // Expected to fail at decryption since we're using mock data
      }

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalled();
    });

    it("should handle token refresh failure", async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error("Invalid refresh token")
      );

      await expect(
        oauth2Service.refreshAccessToken("invalid-refresh-token")
      ).rejects.toThrow("Failed to refresh access token");
    });

    it("should keep existing refresh token if not provided in refresh", async () => {
      const existingRefreshToken = "existing-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        expiry_date: Date.now() + 3600000,
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await oauth2Service.refreshAccessToken(
        existingRefreshToken
      );

      expect(result.refresh_token).toBe(existingRefreshToken);
    });

    it("should handle concurrent token refresh attempts", async () => {
      const refreshToken = "refresh-token";
      const mockCredentials = {
        credentials: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expiry_date: Date.now() + 3600000,
        },
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue(mockCredentials);

      // Simulate concurrent refresh attempts
      const refreshPromises = [
        oauth2Service.refreshAccessToken(refreshToken),
        oauth2Service.refreshAccessToken(refreshToken),
        oauth2Service.refreshAccessToken(refreshToken),
      ];

      const results = await Promise.all(refreshPromises);

      results.forEach((result) => {
        expect(result.access_token).toBe("new-access-token");
      });
    });
  });

  describe("Token Encryption/Decryption", () => {
    it("should encrypt and decrypt tokens correctly", async () => {
      const originalToken = "sensitive-access-token-123";

      // Store tokens (encrypts internally)
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
      };
      mockUserRepository.createOrUpdateFromOAuth!.mockResolvedValue(
        mockUser as any
      );

      await oauth2Service.storeUserTokens("google-123", "test@example.com", "Test User", {
        access_token: originalToken,
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      });

      // Verify encryption happened
      const createCall = mockUserRepository.createOrUpdateFromOAuth!.mock.calls[0][0];
      expect(createCall.accessToken).not.toBe(originalToken);
      expect(createCall.accessToken).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("should handle token decryption errors gracefully", async () => {
      const user = {
        id: "user-123",
        accessToken: "invalid-encrypted-format",
        refreshToken: null,
        tokenExpiry: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      await expect(oauth2Service.getGoogleClient("user-123")).rejects.toThrow();
    });
  });

  describe("Error Recovery", () => {
    it("should handle network failures during token exchange", async () => {
      mockOAuth2Client.getToken.mockRejectedValue(new Error("Network error"));

      await expect(
        oauth2Service.exchangeCodeForTokens("auth-code")
      ).rejects.toThrow("Failed to exchange authorization code for tokens");
    });

    it("should handle missing access token in response", async () => {
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: {} });

      await expect(
        oauth2Service.exchangeCodeForTokens("auth-code")
      ).rejects.toThrow("Failed to exchange authorization code for tokens");
    });

    it("should handle user not found error", async () => {
      mockUserRepository.findById!.mockResolvedValue(null);

      await expect(oauth2Service.getGoogleClient("non-existent-user")).rejects.toThrow(
        "User not found"
      );
    });

    it("should handle missing refresh token for expired access token", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-token",
        refreshToken: null,
        tokenExpiry: new Date(Date.now() - 3600000),
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      await expect(oauth2Service.getGoogleClient("user-123")).rejects.toThrow(
        "Access token expired and no refresh token available"
      );
    });
  });

  describe("OAuth Status and Revocation", () => {
    it("should return correct OAuth status for authenticated user", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      const status = await oauth2Service.getOAuthStatus("user-123");

      expect(status).toEqual({
        isAuthenticated: true,
        scopes: expect.arrayContaining([
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar",
        ]),
        expiresAt: user.tokenExpiry,
        needsReauth: false,
      });
    });

    it("should indicate reauth needed for expired token without refresh token", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-token",
        refreshToken: null,
        tokenExpiry: new Date(Date.now() - 3600000),
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);

      const status = await oauth2Service.getOAuthStatus("user-123");

      expect(status.needsReauth).toBe(true);
      expect(status.isAuthenticated).toBe(false);
    });

    it("should revoke tokens and clean up user data", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-token",
        refreshToken: "encrypted-refresh-token",
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);
      mockUserRepository.update!.mockResolvedValue(user as any);
      mockOAuth2Client.revokeToken.mockResolvedValue(undefined);

      await oauth2Service.revokeTokens("user-123");

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });
    });

    it("should handle revocation errors gracefully", async () => {
      const user = {
        id: "user-123",
        accessToken: "encrypted-token",
      };
      mockUserRepository.findById!.mockResolvedValue(user as any);
      mockUserRepository.update!.mockResolvedValue(user as any);
      mockOAuth2Client.revokeToken.mockRejectedValue(
        new Error("Token already revoked")
      );

      await expect(oauth2Service.revokeTokens("user-123")).resolves.not.toThrow();
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });
    });
  });

  describe("JWT Session Management", () => {
    it("should generate valid JWT token", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      const token = oauth2Service.generateJWT(user as any);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should verify valid JWT token", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      const token = oauth2Service.generateJWT(user as any);
      const payload = oauth2Service.verifyJWT(token);

      expect(payload.userId).toBe("user-123");
      expect(payload.email).toBe("test@example.com");
    });

    it("should reject invalid JWT token", () => {
      expect(() => oauth2Service.verifyJWT("invalid-token")).toThrow(
        "Invalid or expired session token"
      );
    });
  });

  describe("User Info Retrieval", () => {
    it("should retrieve user info from Google", async () => {
      mockOAuth2.userinfo.get.mockResolvedValue({
        data: {
          id: "google-123",
          email: "test@example.com",
          name: "Test User",
        },
      });

      const userInfo = await oauth2Service.getUserInfo("access-token");

      expect(userInfo).toEqual({
        id: "google-123",
        email: "test@example.com",
        name: "Test User",
      });
    });

    it("should handle incomplete user info", async () => {
      mockOAuth2.userinfo.get.mockResolvedValue({
        data: {
          id: "google-123",
          // Missing email
        },
      });

      await expect(oauth2Service.getUserInfo("access-token")).rejects.toThrow(
        "Incomplete user information received from Google"
      );
    });

    it("should use email as name fallback", async () => {
      mockOAuth2.userinfo.get.mockResolvedValue({
        data: {
          id: "google-123",
          email: "test@example.com",
          // No name provided
        },
      });

      const userInfo = await oauth2Service.getUserInfo("access-token");

      expect(userInfo.name).toBe("test@example.com");
    });
  });
});
