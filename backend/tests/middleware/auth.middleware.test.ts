import { Request, Response, NextFunction } from "express";
import {
  authenticateToken,
  optionalAuth,
  requireValidOAuth,
  authRateLimit,
  validateApiKey,
  authErrorHandler,
} from "@/middleware/auth.middleware";
import { services } from "@/services";

// Mock services
jest.mock("@/services", () => ({
  services: {
    oauth2: {
      verifyJWT: jest.fn(),
      getOAuthStatus: jest.fn(),
      getAuthUrl: jest.fn(),
    },
  },
}));

const mockServices = services as jest.Mocked<typeof services>;

describe("Authentication Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      path: "/test",
      ip: "127.0.0.1",
      get: jest.fn(),
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("authenticateToken", () => {
    it("should authenticate valid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };
      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockServices.oauth2.verifyJWT).toHaveBeenCalledWith("valid-token");
      expect(mockRequest.user).toEqual({
        userId: "user-id",
        email: "test@example.com",
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject request without authorization header", async () => {
      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Access token is required",
        code: "MISSING_TOKEN",
        timestamp: expect.any(String),
        path: "/test",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };
      mockServices.oauth2.verifyJWT.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid or expired token",
        code: "INVALID_TOKEN",
        timestamp: expect.any(String),
        path: "/test",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle malformed authorization header", async () => {
      mockRequest.headers = {
        authorization: "InvalidFormat",
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Access token is required",
        code: "MISSING_TOKEN",
        timestamp: expect.any(String),
        path: "/test",
      });
    });
  });

  describe("optionalAuth", () => {
    it("should authenticate valid token when provided", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };
      mockServices.oauth2.verifyJWT.mockReturnValue({
        userId: "user-id",
        email: "test@example.com",
        iat: 123456789,
        exp: 123456789 + 3600,
      });

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        userId: "user-id",
        email: "test@example.com",
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should continue without authentication when no token provided", async () => {
      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should continue when invalid token provided", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };
      mockServices.oauth2.verifyJWT.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe("requireValidOAuth", () => {
    beforeEach(() => {
      mockRequest.user = {
        userId: "user-id",
        email: "test@example.com",
      };
    });

    it("should continue when user has valid OAuth", async () => {
      mockServices.oauth2.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail", "calendar"],
        needsReauth: false,
      });

      await requireValidOAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject when user not authenticated", async () => {
      mockRequest.user = undefined;

      await requireValidOAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
        code: "NOT_AUTHENTICATED",
        timestamp: expect.any(String),
        path: "/test",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject when OAuth not authenticated", async () => {
      mockServices.oauth2.getOAuthStatus.mockResolvedValue({
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      });
      mockServices.oauth2.getAuthUrl.mockResolvedValue("https://auth.url");

      await requireValidOAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Google OAuth authentication required",
        code: "OAUTH_REQUIRED",
        timestamp: expect.any(String),
        path: "/test",
        authUrl: "https://auth.url",
      });
    });

    it("should reject when OAuth needs reauth", async () => {
      mockServices.oauth2.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail"],
        needsReauth: true,
      });
      mockServices.oauth2.getAuthUrl.mockResolvedValue("https://auth.url");

      await requireValidOAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Google OAuth re-authentication required",
        code: "OAUTH_REAUTH_REQUIRED",
        timestamp: expect.any(String),
        path: "/test",
        authUrl: "https://auth.url",
      });
    });
  });

  describe("authRateLimit", () => {
    it("should allow requests within rate limit", () => {
      const rateLimitMiddleware = authRateLimit(5, 60000); // 5 requests per minute

      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should block requests exceeding rate limit", () => {
      const rateLimitMiddleware = authRateLimit(2, 60000); // 2 requests per minute

      // First two requests should pass
      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(2);

      // Third request should be blocked
      jest.clearAllMocks();
      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Too Many Requests",
          code: "RATE_LIMIT_EXCEEDED",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("validateApiKey", () => {
    beforeEach(() => {
      process.env.WEBHOOK_API_KEY = "valid-api-key";
    });

    afterEach(() => {
      delete process.env.WEBHOOK_API_KEY;
    });

    it("should allow requests with valid API key", () => {
      mockRequest.headers = {
        "x-api-key": "valid-api-key",
      };

      validateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject requests without API key", () => {
      validateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "API key is required",
        code: "MISSING_API_KEY",
        timestamp: expect.any(String),
        path: "/test",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with invalid API key", () => {
      mockRequest.headers = {
        "x-api-key": "invalid-api-key",
      };

      validateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid API key",
        code: "INVALID_API_KEY",
        timestamp: expect.any(String),
        path: "/test",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("authErrorHandler", () => {
    it("should handle JWT errors", () => {
      const error = new Error("Invalid token");
      error.name = "JsonWebTokenError";

      authErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid token format",
        code: "MALFORMED_TOKEN",
        timestamp: expect.any(String),
        path: "/test",
      });
    });

    it("should handle token expired errors", () => {
      const error = new Error("Token expired");
      error.name = "TokenExpiredError";

      authErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Token has expired",
        code: "EXPIRED_TOKEN",
        timestamp: expect.any(String),
        path: "/test",
      });
    });

    it("should handle generic errors", () => {
      const error = new Error("Generic error");

      authErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Authentication system error",
        code: "AUTH_SYSTEM_ERROR",
        timestamp: expect.any(String),
        path: "/test",
      });
    });

    it("should call next if response already sent", () => {
      const error = new Error("Test error");
      mockResponse.headersSent = true;

      authErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
