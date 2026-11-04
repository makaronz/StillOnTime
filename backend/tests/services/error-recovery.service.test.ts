/**
 * Tests for ErrorRecoveryService
 * Comprehensive testing of error recovery coordination and mechanisms
 */

import type {
  ErrorRecoveryService as ErrorRecoveryServiceType,
  RecoveryOptions,
  RecoveryContext,
} from "../../src/services/error-recovery.service";
import type { FallbackService } from "../../src/services/fallback.service";
import type { MonitoringService } from "../../src/services/monitoring.service";
import type { NotificationService } from "../../src/services/notification.service";
import type { CacheService } from "../../src/services/cache.service";
import type * as Errors from "../../src/utils/errors";
import type { CircuitBreakerRegistry as CircuitBreakerRegistryType } from "../../src/utils/circuit-breaker";

// Mock dependencies
jest.mock("../../src/services/fallback.service");
jest.mock("../../src/services/monitoring.service");
jest.mock("../../src/services/notification.service");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/utils/circuit-breaker");

describe("ErrorRecoveryService", () => {
  let errorRecoveryService: ErrorRecoveryServiceType;
  let mockFallbackService: jest.Mocked<FallbackService>;
  let mockMonitoringService: jest.Mocked<MonitoringService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockCircuitBreakerRegistry: jest.Mocked<CircuitBreakerRegistryType>;
  let SystemError: typeof Errors.SystemError;
  let APIError: typeof Errors.APIError;
  let ErrorCode: typeof Errors.ErrorCode;

  const mockContext: RecoveryContext = {
    serviceName: "test_service",
    operation: "test_operation",
    userId: "test-user-123",
    requestId: "req-123",
    metadata: { test: "data" },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockFallbackService = {
      executeFallback: jest.fn(),
      getFallbackUsageStats: jest.fn(),
      resetFallbackUsageStats: jest.fn(),
    } as any;

    mockMonitoringService = {
      recordRequest: jest.fn(),
    } as any;

    mockNotificationService = {
      sendSystemAlert: jest.fn(),
    } as any;

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock CircuitBreakerRegistry: a CLOSED breaker that runs the operation
    const mockCircuitBreaker = {
      execute: jest.fn((op: () => Promise<unknown>) => op()),
      getStats: jest.fn().mockReturnValue({ state: "CLOSED" }),
      reset: jest.fn(),
    };

    mockCircuitBreakerRegistry = {
      getInstance: jest.fn().mockReturnThis(),
      getOrCreate: jest.fn().mockReturnValue(mockCircuitBreaker),
      get: jest.fn().mockReturnValue(mockCircuitBreaker),
      getAllStats: jest.fn().mockReturnValue({}),
      resetAll: jest.fn(),
    } as any;

    // tests/setup.ts imports the whole route graph, which already loaded
    // error-recovery.service bound to the REAL circuit-breaker registry. Load a
    // fresh copy so it uses the mocked registry, and take the error classes
    // (checked with instanceof) from the same module registry.
    jest.isolateModules(() => {
      ({ SystemError, APIError, ErrorCode } = require("../../src/utils/errors"));
      const { CircuitBreakerRegistry } = require("../../src/utils/circuit-breaker");
      (CircuitBreakerRegistry.getInstance as jest.Mock).mockReturnValue(
        mockCircuitBreakerRegistry
      );
      const { ErrorRecoveryService } = require("../../src/services/error-recovery.service");

      errorRecoveryService = new ErrorRecoveryService(
        mockFallbackService,
        mockMonitoringService,
        mockNotificationService,
        mockCacheService
      );
    });

    // Retry backoff waits real seconds; skip the waiting, keep the logic.
    jest
      .spyOn(errorRecoveryService as any, "sleep")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("executeWithRecovery", () => {
    it("should execute operation successfully on first attempt", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");
      const options: RecoveryOptions = {
        enableRetry: true,
        enableFallback: true,
        enableCircuitBreaker: true,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.recoveryMethod).toBe("direct");
      expect(result.attempts).toBe(1);
      expect(result.degraded).toBe(false);
      expect(result.fallbackUsed).toBe(false);
      expect(result.circuitBreakerTripped).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "test_service:test_operation",
        expect.any(Number),
        false
      );
    });

    it("should retry operation on retryable failure", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(
          new APIError(
            "Temporary failure",
            ErrorCode.API_RATE_LIMITED,
            "test_service",
            503,
            true
          )
        )
        .mockResolvedValueOnce("success");

      const options: RecoveryOptions = {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 3,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.recoveryMethod).toBe("retry");
      expect(result.attempts).toBe(2);
      expect(result.degraded).toBe(false);
      expect(result.fallbackUsed).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should use fallback when all retries fail", async () => {
      const mockError = new APIError(
        "Persistent failure",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service",
        503,
        true
      );

      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: true,
        data: "fallback_data",
        strategy: "cache",
        degraded: true,
        warnings: ["Using cached data"],
      });

      const options: RecoveryOptions = {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 2,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("fallback_data");
      expect(result.recoveryMethod).toBe("fallback_cache");
      expect(result.degraded).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.warnings).toContain("Using cached data");
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(mockFallbackService.executeFallback).toHaveBeenCalledWith(
        "test_service",
        mockError,
        "test_operation",
        { test: "data" }
      );
    });

    it("should handle circuit breaker open state", async () => {
      const mockCircuitBreaker = {
        execute: jest.fn(),
        getStats: jest.fn().mockReturnValue({ state: "OPEN" }),
        reset: jest.fn(),
      };

      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: true,
        data: "fallback_data",
        strategy: "cache",
        degraded: true,
        warnings: ["Circuit breaker is open"],
      });

      const mockOperation = jest.fn();
      const options: RecoveryOptions = {
        enableCircuitBreaker: true,
        enableFallback: true,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(true);
      expect(result.circuitBreakerTripped).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockOperation).not.toHaveBeenCalled();
      expect(mockFallbackService.executeFallback).toHaveBeenCalled();
    });

    it("should fail when circuit breaker is open and fallback is disabled", async () => {
      const mockCircuitBreaker = {
        execute: jest.fn(),
        getStats: jest.fn().mockReturnValue({ state: "OPEN" }),
        reset: jest.fn(),
      };

      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker);

      const mockOperation = jest.fn();
      const options: RecoveryOptions = {
        enableCircuitBreaker: true,
        enableFallback: false,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(false);
      expect(result.recoveryMethod).toBe("circuit_breaker_open");
      expect(result.circuitBreakerTripped).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should not retry non-retryable errors", async () => {
      const mockError = new SystemError(
        "Invalid grant",
        ErrorCode.OAUTH_INVALID_GRANT,
        "oauth2",
        401,
        false
      );

      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: true,
        data: "fallback_data",
        strategy: "alternative",
        degraded: true,
        warnings: ["Using alternative authentication"],
      });

      const options: RecoveryOptions = {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 3,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
      expect(mockFallbackService.executeFallback).toHaveBeenCalled();
    });

    it("should cache failure data when enabled", async () => {
      const mockError = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service"
      );

      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: true,
        data: { cached: "data" },
        strategy: "cache",
        degraded: true,
        warnings: [],
      });

      const options: RecoveryOptions = {
        enableRetry: false,
        enableFallback: true,
        cacheFailureData: true,
      };

      await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(mockCacheService.set).toHaveBeenCalledWith(
        "failure_cache:test_service:test_operation",
        { cached: "data" },
        { ttl: 3600 }
      );
    });

    it("should send notifications for user-facing operations", async () => {
      const mockError = new APIError(
        "Service failure",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service"
      );

      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: false,
        strategy: "none",
        degraded: false,
        warnings: ["No fallback available"],
      });

      const options: RecoveryOptions = {
        enableRetry: false,
        enableFallback: true,
        notifyOnFailure: true,
        userFacingOperation: true,
      };

      await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      // payload shape of NotificationService.sendSystemAlert
      expect(mockNotificationService.sendSystemAlert).toHaveBeenCalledWith({
        type: "operation_failure",
        serviceName: "test_service",
        errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        impact: "high",
        affectedOperations: ["test_operation"],
        estimatedRecoveryTime: 0,
        timestamp: expect.any(Date),
      });
    });

    it("should handle fallback failure gracefully", async () => {
      const mockError = new APIError(
        "Service failure",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service"
      );

      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockFallbackService.executeFallback.mockResolvedValue({
        success: false,
        strategy: "cache",
        degraded: false,
        warnings: ["Cache miss", "No default data available"],
      });

      const options: RecoveryOptions = {
        enableRetry: false,
        enableFallback: true,
        maxRecoveryAttempts: 1,
      };

      const result = await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        options
      );

      expect(result.success).toBe(false);
      expect(result.recoveryMethod).toBe("fallback_failed");
      expect(result.fallbackUsed).toBe(false);
      expect(result.warnings).toContain("Cache miss");
      expect(result.warnings).toContain("No default data available");
      expect(result.errors).toContain("Fallback recovery failed");
    });
  });

  describe("recovery statistics", () => {
    it("should track recovery statistics", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        {}
      );

      const stats = errorRecoveryService.getRecoveryStats();
      expect(stats).toHaveProperty("test_service");
      expect(stats.test_service.successes).toBe(1);
      expect(stats.test_service.failures).toBe(0);
      expect(stats.test_service.attempts).toBe(1);
    });

    it("should reset recovery statistics", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await errorRecoveryService.executeWithRecovery(
        mockOperation,
        mockContext,
        {}
      );

      errorRecoveryService.resetRecoveryStats();
      const stats = errorRecoveryService.getRecoveryStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe("circuit breaker management", () => {
    it("should get circuit breaker status", () => {
      const mockStats = {
        test_service: { state: "CLOSED", failureCount: 0 },
      };

      mockCircuitBreakerRegistry.getAllStats.mockReturnValue(mockStats);

      const status = errorRecoveryService.getCircuitBreakerStatus();
      expect(status).toEqual(mockStats);
    });

    it("should reset individual circuit breaker", () => {
      const mockCircuitBreaker = {
        reset: jest.fn(),
        getStats: jest.fn(),
        execute: jest.fn(),
      };

      mockCircuitBreakerRegistry.get.mockReturnValue(mockCircuitBreaker);

      const result = errorRecoveryService.resetCircuitBreaker("test_service");
      expect(result).toBe(true);
      expect(mockCircuitBreaker.reset).toHaveBeenCalled();
    });

    it("should handle reset of non-existent circuit breaker", () => {
      mockCircuitBreakerRegistry.get.mockReturnValue(undefined);

      const result = errorRecoveryService.resetCircuitBreaker("non_existent");
      expect(result).toBe(false);
    });

    it("should reset all circuit breakers", () => {
      errorRecoveryService.resetAllCircuitBreakers();
      expect(mockCircuitBreakerRegistry.resetAll).toHaveBeenCalled();
    });
  });
});
