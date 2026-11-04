import request from "supertest";
import express from "express";
import { authRoutes } from "@/routes/auth.routes";
import { services } from "@/services";
import { userRepository } from "@/repositories/user.repository";
import { issueOAuthState, verifyOAuthState } from "@/utils/oauth-state";

// tests/setup.ts imports the whole route graph (`@/routes`) before this file
// runs, so the controller/middleware already hold the real `services` and
// `userRepository` singletons. Module-level jest.mock() would only produce a
// disconnected copy; spy on the shared singletons instead.
const oauth2 = services.oauth2;
const spyOAuth2 = <K extends keyof typeof oauth2>(method: K): jest.SpyInstance =>
  jest.spyOn(oauth2, method as any);

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

describe("AuthController Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /auth/login", () => {
    it("should return authorization URL", async () => {
      const authUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test";
      const getAuthUrl = spyOAuth2("getAuthUrl").mockResolvedValue({
        authUrl,
        state: "server-issued-state",
      });

      const response = await request(app)
        .get("/auth/login")
        .query({ state: "test-state" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        authUrl,
        state: "server-issued-state",
        message: "Redirect to Google OAuth for authentication",
      });
      // The caller-supplied state is ignored; the server mints its own (BUG-008).
      expect(getAuthUrl).toHaveBeenCalledTimes(1);
      const passedState = getAuthUrl.mock.calls[0][0];
      expect(passedState).not.toBe("test-state");
      expect(verifyOAuthState(passedState)).toBe(true);
    });

    it("should handle service errors", async () => {
      spyOAuth2("getAuthUrl").mockRejectedValue(new Error("Service error"));

      const response = await request(app).get("/auth/login");

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "Internal Server Error",
        message: "Failed to initiate authentication",
        code: "AUTH_INIT_FAILED",
      });
    });

    it("should validate state parameter", async () => {
      const response = await request(app)
        .get("/auth/login")
        .query({ state: "a".repeat(300) }); // Too long

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("POST /auth/callback", () => {
    it("should handle successful OAuth callback", async () => {
      const mockTokens = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      };
      const mockUserInfo = {
        id: "google-id",
        email: "test@example.com",
        name: "Test User",
      };
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
      };
      const mockJWT = "jwt-token";

      const exchangeCodeForTokens = spyOAuth2(
        "exchangeCodeForTokens"
      ).mockResolvedValue(mockTokens);
      const getUserInfo = spyOAuth2("getUserInfo").mockResolvedValue(
        mockUserInfo
      );
      const storeUserTokens = spyOAuth2("storeUserTokens").mockResolvedValue(
        mockUser as any
      );
      const generateJWT = spyOAuth2("generateJWT").mockReturnValue(mockJWT);

      const response = await request(app)
        .post("/auth/callback")
        .send({ code: "auth-code", state: issueOAuthState() });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
        },
        token: "jwt-token",
        message: "Authentication successful",
      });

      expect(exchangeCodeForTokens).toHaveBeenCalledWith("auth-code");
      expect(getUserInfo).toHaveBeenCalledWith("access-token");
      expect(storeUserTokens).toHaveBeenCalledWith(
        "google-id",
        "test@example.com",
        "Test User",
        mockTokens
      );
      expect(generateJWT).toHaveBeenCalledWith(mockUser);
    });

    it("should handle OAuth error from Google", async () => {
      const response = await request(app)
        .post("/auth/callback")
        .send({ error: "access_denied", state: "test-state" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "OAuth authentication failed: access_denied",
        code: "OAUTH_ERROR",
      });
    });

    it("should require authorization code", async () => {
      const response = await request(app)
        .post("/auth/callback")
        .send({ state: "test-state" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "Authorization code is required",
        code: "MISSING_AUTH_CODE",
      });
    });

    it("should handle token exchange errors", async () => {
      spyOAuth2("exchangeCodeForTokens").mockRejectedValue(
        new Error("Invalid code")
      );

      const response = await request(app)
        .post("/auth/callback")
        .send({ code: "invalid-code", state: issueOAuthState() });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "Internal Server Error",
        message: "Authentication failed",
        code: "AUTH_CALLBACK_FAILED",
      });
    });
  });

  describe("POST /auth/refresh", () => {
    it("should refresh JWT token for authenticated user", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
      };
      const newToken = "new-jwt-token";

      // Mock JWT verification
      spyOAuth2("verifyJWT").mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      const findById = jest
        .spyOn(userRepository, "findById")
        .mockResolvedValue(mockUser as any);

      const generateJWT = spyOAuth2("generateJWT").mockReturnValue(newToken);

      const response = await request(app)
        .post("/auth/refresh")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        token: newToken,
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
        },
        message: "Token refreshed successfully",
      });
      expect(findById).toHaveBeenCalledWith("user-id");
      expect(generateJWT).toHaveBeenCalledWith(mockUser);
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/auth/refresh");

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: "Unauthorized",
        message: "Access token is required",
        code: "MISSING_TOKEN",
      });
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout authenticated user", async () => {
      spyOAuth2("verifyJWT").mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });
      const revokeTokens = spyOAuth2("revokeTokens").mockResolvedValue(
        undefined
      );

      const response = await request(app)
        .post("/auth/logout")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Logged out successfully",
      });
      expect(revokeTokens).toHaveBeenCalledWith("user-id");
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/auth/logout");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/status", () => {
    it("should return status for authenticated user", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date(),
      };
      const mockOAuthStatus = {
        isAuthenticated: true,
        scopes: ["gmail", "calendar"],
        needsReauth: false,
      };

      spyOAuth2("verifyJWT").mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      const findById = jest
        .spyOn(userRepository, "findById")
        .mockResolvedValue(mockUser as any);

      const getOAuthStatus = spyOAuth2("getOAuthStatus").mockResolvedValue(
        mockOAuthStatus
      );

      const response = await request(app)
        .get("/auth/status")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        isAuthenticated: true,
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
          createdAt: mockUser.createdAt.toISOString(),
        },
        oauth: mockOAuthStatus,
      });
      expect(getOAuthStatus).toHaveBeenCalledWith("user-id");
      expect(findById).toHaveBeenCalledWith("user-id");
    });

    it("should return unauthenticated status without token", async () => {
      const response = await request(app).get("/auth/status");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        isAuthenticated: false,
        user: null,
        oauth: {
          isAuthenticated: false,
          scopes: [],
          needsReauth: true,
        },
      });
    });
  });

  describe("POST /auth/reauth", () => {
    it("should generate reauth URL for authenticated user", async () => {
      const authUrl =
        "https://accounts.google.com/oauth/authorize?prompt=consent";

      spyOAuth2("verifyJWT").mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });
      spyOAuth2("getAuthUrl").mockResolvedValue({
        authUrl,
        state: "reauth-state",
      });

      const response = await request(app)
        .post("/auth/reauth")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        authUrl,
        state: "reauth-state",
        message: "Re-authentication URL generated",
      });
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/auth/reauth");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/profile", () => {
    it("should return user profile with statistics", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
        processedEmails: [],
        schedules: [],
        userConfig: null,
      };
      const mockStats = {
        totalEmails: 10,
        processedEmails: 8,
        totalSchedules: 5,
        upcomingSchedules: 2,
      };

      spyOAuth2("verifyJWT").mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      const findWithRelations = jest
        .spyOn(userRepository, "findWithRelations")
        .mockResolvedValue(mockUser);
      const getUserStats = jest
        .spyOn(userRepository, "getUserStats")
        .mockResolvedValue(mockStats as any);

      const response = await request(app)
        .get("/auth/profile")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        profile: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
        },
        statistics: mockStats,
        recentActivity: {
          emails: [],
          schedules: [],
        },
        configuration: null,
      });
      expect(findWithRelations).toHaveBeenCalledWith("user-id");
      expect(getUserStats).toHaveBeenCalledWith("user-id");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/auth/profile");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/auth/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        service: "authentication",
        version: "1.0.0",
      });
    });
  });
});
