import request from "supertest";
import express from "express";
import { authRoutes } from "@/routes/auth.routes";
import { services } from "@/services";
import { UserRepository } from "@/repositories/user.repository";

// Mock services and repositories
jest.mock("@/services");
jest.mock("@/repositories/user.repository");

const mockServices = services as jest.Mocked<typeof services>;
const mockUserRepository = UserRepository as jest.MockedClass<
  typeof UserRepository
>;

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

describe("AuthController Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /auth/login", () => {
    it("should return authorization URL", async () => {
      const authUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test";
      mockServices.oauth2.getAuthUrl.mockResolvedValue(authUrl);

      const response = await request(app)
        .get("/auth/login")
        .query({ state: "test-state" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        authUrl,
        message: "Redirect to Google OAuth for authentication",
      });
      expect(mockServices.oauth2.getAuthUrl).toHaveBeenCalledWith("test-state");
    });

    it("should handle service errors", async () => {
      mockServices.oauth2.getAuthUrl.mockRejectedValue(
        new Error("Service error")
      );

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

      mockServices.oauth2.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockServices.oauth2.getUserInfo.mockResolvedValue(mockUserInfo);
      mockServices.oauth2.storeUserTokens.mockResolvedValue(mockUser as any);
      mockServices.oauth2.generateJWT.mockReturnValue(mockJWT);

      const response = await request(app)
        .post("/auth/callback")
        .send({ code: "auth-code", state: "test-state" });

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

      expect(mockServices.oauth2.exchangeCodeForTokens).toHaveBeenCalledWith(
        "auth-code"
      );
      expect(mockServices.oauth2.getUserInfo).toHaveBeenCalledWith(
        "access-token"
      );
      expect(mockServices.oauth2.storeUserTokens).toHaveBeenCalledWith(
        "google-id",
        "test@example.com",
        "Test User",
        mockTokens
      );
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
      mockServices.oauth2.exchangeCodeForTokens.mockRejectedValue(
        new Error("Invalid code")
      );

      const response = await request(app)
        .post("/auth/callback")
        .send({ code: "invalid-code" });

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
      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      // Mock user repository
      const mockUserRepoInstance = {
        findById: jest.fn().mockResolvedValue(mockUser),
      };
      mockUserRepository.mockImplementation(() => mockUserRepoInstance as any);

      mockServices.oauth2.generateJWT.mockReturnValue(newToken);

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
      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });
      mockServices.oauth2.revokeTokens.mockResolvedValue();

      const response = await request(app)
        .post("/auth/logout")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Logged out successfully",
      });
      expect(mockServices.oauth2.revokeTokens).toHaveBeenCalledWith("user-id");
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

      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      const mockUserRepoInstance = {
        findById: jest.fn().mockResolvedValue(mockUser),
      };
      mockUserRepository.mockImplementation(() => mockUserRepoInstance as any);

      mockServices.oauth2.getOAuthStatus.mockResolvedValue(mockOAuthStatus);

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

      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });
      mockServices.oauth2.getAuthUrl.mockResolvedValue(authUrl);

      const response = await request(app)
        .post("/auth/reauth")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        authUrl,
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

      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      const mockUserRepoInstance = {
        findWithRelations: jest.fn().mockResolvedValue(mockUser),
        getUserStats: jest.fn().mockResolvedValue(mockStats),
      };
      mockUserRepository.mockImplementation(() => mockUserRepoInstance as any);

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
