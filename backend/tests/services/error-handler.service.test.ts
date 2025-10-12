/**
 * Tests for ErrorHandlerService
 * Comprehensive testing of error recovery mechanisms and fallback strategies
 */

import {
  ErrorHandlerService,
  ErrorRecoveryResult,
  FallbackOptions,
} from "../../src/services/error-handler.service";
import { OAuth2Service } from "../../src/services/oauth2.service";
import { CacheService } from "../../src/services/cache.service";
import { NotificationService } from "../../src/services/notification.service";
import {
  OAuthError,
  APIError,
  PDFProcessingError,
  DatabaseError,
  SystemError,
  ErrorCode,
} from "../../src/utils/errors";
import { CircuitBreakerRegistry } from "../../src/utils/circuit-breaker";

// Mock dependencies
jest.mock("../../src/services/oauth2.service");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/services/notification.service");
jest.mock("../../src/utils/circuit-breaker");

describe("ErrorHandlerService", () => {
  let errorHandlerService: ErrorHandlerService;
  let mockOAuth2Service: jest.Mocked<OAuth2Service>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockCircuitBreakerRegistry: jest.Mocked<CircuitBreakerRegistry>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockOAuth2Service = new OAuth2Service() as jest.Mocked<OAuth2Service>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockNotificationService = new NotificationService(
      null as any,
      null as any
    ) as jest.Mocked<NotificationService>;

    // Mock CircuitBreakerRegistry
    mockCircuitBreakerRegistry = {
      getInstance: jest.fn().mockReturnThis(),
      get: jest.fn(),
      getAllStats: jest.fn().mockReturnValue({}),
      resetAll: jest.fn(),
    } as any;

    (CircuitBreakerRegistry.getInstance as jest.Mock).mockReturnValue(
      mockCircuitBreakerRegistry
    );

    // Create service instance
    errorHandlerService = new ErrorHandlerService(
      mockOAuth2Service,
      mockCacheService,
      mockNotificationService
    );
  });

  describe("OAuth Error Handling", () => {
    it("should handle token expiration with automatic refresh", async () => {
      const userId = "test-user-id";
      const mockOperation = jest.fn().mockResolvedValue("success");
      const oauthError = new OAuthError(
        "Token expired",
        ErrorCode.OAUTH_TOKEN_EXPIRED,
        401,
        { userId }
      );

      // Mock successful token refresh
      mockOAuth2Service.getGoogleClient.mockResolvedValue({} as any);

      const result = await errorHandlerService.handleOAuthError(
        oauthError,
        userId,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.recoveryAction).toBe("token_refreshed");
      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(mockOperation).toHaveBeenCalled();
    });

    it("should handle invalid grant by revoking tokens", async () => {
      const userId = "test-user-id";
      const mockOperation = jest.fn();
      const oauthError = new OAuthError(
        "Invalid grant",
        ErrorCode.OAUTH_INVALID_GRANT,
        401,
        { userId }
      );

      mockOAuth2Service.revokeTokens.mockResolvedValue();

      const result = await errorHandlerService.handleOAuthError(
        oauthError,
        userId,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("reauthorization_required");
      expect(mockOAuth2Service.revokeTokens).toHaveBeenCalledWith(userId);
    });

    it("should handle insufficient scope error", async () => {
      const userId = "test-user-id";
      const mockOperation = jest.fn();
      const oauthError = new OAuthError(
        "Insufficient scope",
        ErrorCode.OAUTH_INSUFFICIENT_SCOPE,
        403,
        { userId, requiredScopes: ["calendar"] }
      );

      const result = await errorHandlerService.handleOAuthError(
        oauthError,
        userId,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("scope_expansion_required");
      expect(result.error).toBeInstanceOf(OAuthError);
    });
  });

  describe("API Error Handling", () => {
    it("should retry retryable API errors", async () => {
      const apiError = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "gmail_api",
        503,
        true
      );

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValue("success");

      // Mock circuit breaker as closed
      const mockCircuitBreaker = {
        getStats: jest.fn().mockReturnValue({ state: "CLOSED" }),
      };
      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker as any);

      const result = await errorHandlerService.handleAPIFailure(
        apiError,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.recoveryAction).toContain("retry_succeeded_after");
    });

    it("should use fallback when circuit breaker is open", async () => {
      const apiError = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "gmail_api",
        503,
        true
      );

      const mockOperation = jest.fn();

      // Mock circuit breaker as open
      const mockCircuitBreaker = {
        getStats: jest.fn().mockReturnValue({ state: "OPEN" }),
      };
      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker as any);

      const fallbackOptions: FallbackOptions = {
        useCachedData: true,
        cacheKey: "test-cache-key",
      };

      // Mock cached data
      mockCacheService.get.mockResolvedValue("cached-data");

      const result = await errorHandlerService.handleAPIFailure(
        apiError,
        mockOperation,
        fallbackOptions
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("cached-data");
      expect(result.fallbackUsed).toBe(true);
      expect(result.recoveryAction).toBe("advanced_cached_data_used");
    });
  });

  describe("PDF Processing Error Handling", () => {
    it("should handle corrupted PDF by storing for manual processing", async () => {
      const pdfError = new PDFProcessingError(
        "PDF is corrupted",
        ErrorCode.PDF_CORRUPTED,
        422,
        "pdf-hash-123",
        0,
        { emailId: "email-123" }
      );

      const pdfBuffer = Buffer.from("corrupted-pdf-data");
      const emailId = "email-123";

      mockCacheService.set.mockResolvedValue();

      const result = await errorHandlerService.handlePDFProcessingError(
        pdfError,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("manual_processing_queued");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `corrupted_pdf:${emailId}`,
        pdfBuffer,
        { ttl: 86400 }
      );
    });

    it("should handle OCR failure by storing for manual entry", async () => {
      const pdfError = new PDFProcessingError(
        "OCR failed",
        ErrorCode.PDF_OCR_FAILED,
        422,
        "pdf-hash-123",
        0.2,
        { emailId: "email-123" }
      );

      const pdfBuffer = Buffer.from("scanned-pdf-data");
      const emailId = "email-123";

      mockCacheService.set.mockResolvedValue();

      const result = await errorHandlerService.handlePDFProcessingError(
        pdfError,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("manual_entry_required");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `ocr_failed_pdf:${emailId}`,
        pdfBuffer,
        { ttl: 86400 }
      );
    });
  });

  describe("Database Error Handling", () => {
    it("should retry database connection errors", async () => {
      const dbError = new DatabaseError(
        "Connection failed",
        ErrorCode.DATABASE_CONNECTION_ERROR,
        "user_query",
        500,
        true
      );

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockResolvedValue("database-result");

      const result = await errorHandlerService.handleDatabaseError(
        dbError,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("database-result");
      expect(result.recoveryAction).toContain("database_retry_succeeded_after");
    });

    it("should not retry constraint errors", async () => {
      const dbError = new DatabaseError(
        "Constraint violation",
        ErrorCode.DATABASE_CONSTRAINT_ERROR,
        "user_insert",
        500,
        false
      );

      const mockOperation = jest.fn();

      const result = await errorHandlerService.handleDatabaseError(
        dbError,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe(
        "constraint_violation_manual_fix_required"
      );
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe("Comprehensive Error Recovery", () => {
    it("should handle error with comprehensive recovery strategy", async () => {
      const apiError = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "weather_api",
        503,
        true
      );

      const mockOperation = jest.fn().mockResolvedValue("operation-result");
      const serviceName = "weather_api";
      const fallbackOptions: FallbackOptions = {
        gracefulDegradation: true,
      };

      // Mock circuit breaker as closed
      const mockCircuitBreaker = {
        getStats: jest.fn().mockReturnValue({ state: "CLOSED" }),
      };
      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker as any);

      const result = await errorHandlerService.handleErrorWithRecovery(
        apiError,
        mockOperation,
        serviceName,
        fallbackOptions
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("operation-result");
    });

    it("should record error metrics during recovery", async () => {
      const systemError = new SystemError(
        "System failure",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service",
        503,
        true
      );

      const mockOperation = jest.fn().mockResolvedValue("result");
      const serviceName = "test_service";

      await errorHandlerService.handleErrorWithRecovery(
        systemError,
        mockOperation,
        serviceName
      );

      // Check that error metrics are recorded
      const metrics = errorHandlerService.getErrorMetrics();
      expect(Object.keys(metrics)).toContain(
        `${serviceName}:${systemError.code}`
      );
    });
  });

  describe("Error Metrics", () => {
    it("should track error metrics correctly", async () => {
      const error1 = new APIError(
        "Error 1",
        ErrorCode.API_RATE_LIMITED,
        "service1",
        429
      );
      const error2 = new APIError(
        "Error 2",
        ErrorCode.API_RATE_LIMITED,
        "service1",
        429
      );
      const mockOperation = jest.fn().mockResolvedValue("result");

      // Trigger multiple errors for the same service/code
      await errorHandlerService.handleErrorWithRecovery(
        error1,
        mockOperation,
        "service1"
      );
      await errorHandlerService.handleErrorWithRecovery(
        error2,
        mockOperation,
        "service1"
      );

      const metrics = errorHandlerService.getErrorMetrics();
      const key = `service1:${ErrorCode.API_RATE_LIMITED}`;

      expect(metrics[key]).toBeDefined();
      expect(metrics[key].errorCount).toBe(2);
    });

    it("should reset error metrics", () => {
      errorHandlerService.resetErrorMetrics();
      const metrics = errorHandlerService.getErrorMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe("Critical Failure Detection", () => {
    it("should detect critical failures and send notifications", async () => {
      const criticalError = new DatabaseError(
        "Database connection lost",
        ErrorCode.DATABASE_CONNECTION_ERROR,
        "user_query",
        500,
        true
      );

      const mockOperation = jest.fn().mockRejectedValue(criticalError);
      mockNotificationService.sendSystemAlert.mockResolvedValue();

      // Trigger multiple errors to reach critical threshold
      for (let i = 0; i < 15; i++) {
        try {
          await errorHandlerService.handleErrorWithRecovery(
            criticalError,
            mockOperation,
            "database"
          );
        } catch (error) {
          // Expected to fail
        }
      }

      const criticalFailures = errorHandlerService.getCriticalFailures();
      expect(criticalFailures.length).toBeGreaterThan(0);
      expect(mockNotificationService.sendSystemAlert).toHaveBeenCalled();
    });
  });

  describe("Advanced Fallback Mechanisms", () => {
    it("should use graceful degradation for weather service", async () => {
      const weatherError = new APIError(
        "Weather API unavailable",
        ErrorCode.WEATHER_API_ERROR,
        "weather_api",
        503,
        true
      );

      const mockOperation = jest.fn().mockRejectedValue(weatherError);
      const fallbackOptions: FallbackOptions = {
        gracefulDegradation: true,
      };

      const result = await errorHandlerService.handleErrorWithRecovery(
        weatherError,
        mockOperation,
        "weather_api",
        fallbackOptions
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.data).toHaveProperty("fallback", true);
      expect(result.recoveryAction).toBe("graceful_degradation_applied");
    });

    it("should skip operation when requested", async () => {
      const error = new SystemError(
        "Non-critical service failure",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "optional_service",
        503,
        true
      );

      const mockOperation = jest.fn();
      const fallbackOptions: FallbackOptions = {
        skipOperation: true,
      };

      const result = await errorHandlerService.handleErrorWithRecovery(
        error,
        mockOperation,
        "optional_service",
        fallbackOptions
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.data).toBeUndefined(); // Fixed: expects undefined, not null
      expect(result.recoveryAction).toBe("operation_skipped");
    });
  });
});
