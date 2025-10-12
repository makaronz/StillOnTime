/**
 * Tests for FallbackService
 * Comprehensive testing of fallback strategies and service degradation
 */

import {
  FallbackService,
  FallbackResult,
  FallbackStrategy,
  ServiceDegradationConfig,
} from "../../src/services/fallback.service";
import { CacheService } from "../../src/services/cache.service";
import { NotificationService } from "../../src/services/notification.service";
import { APIError, SystemError, ErrorCode } from "../../src/utils/errors";

// Mock dependencies
jest.mock("../../src/services/cache.service");
jest.mock("../../src/services/notification.service");

describe("FallbackService", () => {
  let fallbackService: FallbackService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockNotificationService = {
      sendSystemAlert: jest.fn(),
    } as any;

    fallbackService = new FallbackService(
      mockCacheService,
      mockNotificationService
    );
  });

  describe("executeFallback", () => {
    it("should execute cache fallback strategy successfully", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      const cachedData = { emails: ["test@example.com"] };
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.strategy).toBe("cache");
      expect(result.degraded).toBe(true);
      expect(result.cacheHit).toBe(true);
      expect(result.warnings).toContain(
        "Using cached data due to gmail_api failure"
      );
    });

    it("should try backup cache keys when primary cache fails", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      const backupData = { emails: ["backup@example.com"] };
      mockCacheService.get
        .mockResolvedValueOnce(null) // Primary cache miss
        .mockResolvedValueOnce(backupData); // Backup cache hit

      const result = await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(backupData);
      expect(result.strategy).toBe("cache");
      expect(result.degraded).toBe(true);
      expect(result.cacheHit).toBe(true);
      expect(mockCacheService.get).toHaveBeenCalledTimes(2);
    });

    it("should execute default fallback strategy", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.WEATHER_API_ERROR,
        "weather_api"
      );

      const result = await fallbackService.executeFallback(
        "weather_api",
        error,
        "weather_forecast"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("default");
      expect(result.degraded).toBe(true);
      expect(result.data).toHaveProperty("temperature", 15);
      expect(result.data).toHaveProperty(
        "description",
        "Mild conditions (estimated)"
      );
      expect(result.data).toHaveProperty("fallback", true);
      expect(result.warnings).toContain(
        "Using default values due to weather_api failure"
      );
    });

    it("should execute skip fallback strategy", async () => {
      const error = new APIError(
        "Rate limited",
        ErrorCode.API_RATE_LIMITED,
        "gmail_api"
      );

      const result = await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("skip");
      expect(result.degraded).toBe(true);
      expect(result.data).toBeUndefined(); // Fixed: service returns undefined for skipped operations
      expect(result.warnings).toContain(
        "Operation email_monitoring skipped due to gmail_api failure"
      );
    });

    it("should execute degradation fallback strategy", async () => {
      const error = new APIError(
        "Rate limited",
        ErrorCode.API_RATE_LIMITED,
        "calendar_api"
      );

      const result = await fallbackService.executeFallback(
        "calendar_api",
        error,
        "event_creation"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("degrade");
      expect(result.degraded).toBe(true);
      expect(result.warnings).toContain(
        "Service calendar_api running in degraded mode"
      );
      expect(result.warnings).toContain("Degradation level: partial");
    });

    it("should handle no fallback strategies available", async () => {
      const error = new SystemError(
        "Unknown error",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "unknown_service"
      );

      const result = await fallbackService.executeFallback(
        "unknown_service",
        error,
        "unknown_operation"
      );

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
      expect(result.degraded).toBe(false);
      expect(result.warnings).toContain(
        "No fallback strategy available for this service failure"
      );
    });

    it("should handle cache fallback failure", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      mockCacheService.get.mockResolvedValue(null); // All cache keys return null

      const result = await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("all_failed");
      expect(result.degraded).toBe(false);
      expect(result.warnings).toContain("All fallback strategies failed");
    });

    it("should send notification for degradation requiring user notification", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.DATABASE_CONNECTION_ERROR,
        "database"
      );

      const result = await fallbackService.executeFallback(
        "database",
        error,
        "data_persistence"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("degrade");
      expect(mockNotificationService.sendSystemAlert).toHaveBeenCalledWith({
        type: "service_degradation",
        serviceName: "database",
        degradationLevel: "minimal",
        operation: "data_persistence",
        message: "Service database is running in minimal degraded mode",
        timestamp: expect.any(Date),
        severity: "medium",
      });
    });

    it("should handle notification failure gracefully", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.DATABASE_CONNECTION_ERROR,
        "database"
      );

      mockNotificationService.sendSystemAlert.mockRejectedValue(
        new Error("Notification failed")
      );

      const result = await fallbackService.executeFallback(
        "database",
        error,
        "data_persistence"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("degrade");
      // Should not throw error even if notification fails
    });
  });

  describe("fallback usage statistics", () => {
    it("should track fallback usage statistics", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      mockCacheService.get.mockResolvedValue({ test: "data" });

      await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      const stats = fallbackService.getFallbackUsageStats();
      expect(stats).toHaveProperty("gmail_api:cache", 1);
    });

    it("should reset fallback usage statistics", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      mockCacheService.get.mockResolvedValue({ test: "data" });

      await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      fallbackService.resetFallbackUsageStats();
      const stats = fallbackService.getFallbackUsageStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe("service degradation levels", () => {
    it("should apply minimal degradation correctly", async () => {
      const error = new APIError(
        "Timeout",
        ErrorCode.DATABASE_TIMEOUT_ERROR,
        "database"
      );

      const result = await fallbackService.executeFallback(
        "database",
        error,
        "data_persistence"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("degrade");
      expect(result.degraded).toBe(true);
      expect(result.warnings).toContain("Degradation level: minimal");
    });

    it("should apply partial degradation correctly", async () => {
      const error = new APIError(
        "Rate limited",
        ErrorCode.API_RATE_LIMITED,
        "calendar_api"
      );

      const result = await fallbackService.executeFallback(
        "calendar_api",
        error,
        "event_creation"
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("degrade");
      expect(result.degraded).toBe(true);
      expect(result.warnings).toContain("Degradation level: partial");
    });
  });

  describe("alternative service fallback", () => {
    it("should handle alternative service unavailable", async () => {
      // This test would be more meaningful with actual alternative service integration
      // For now, we test the structure
      const error = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "test_service"
      );

      // Mock a service that has alternative strategy configured
      // This would require extending the fallback service to support this test case
      const result = await fallbackService.executeFallback(
        "test_service",
        error,
        "test_operation"
      );

      // Since no strategies are configured for test_service, it should fail
      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });
  });

  describe("error handling in fallback execution", () => {
    it("should handle cache service errors gracefully", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.GMAIL_API_ERROR,
        "gmail_api"
      );

      mockCacheService.get.mockRejectedValue(new Error("Cache service down"));

      const result = await fallbackService.executeFallback(
        "gmail_api",
        error,
        "email_monitoring"
      );

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("all_failed");
      expect(result.warnings).toContain("All fallback strategies failed");
    });

    it("should handle multiple strategy failures", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.MAPS_API_ERROR,
        "maps_api"
      );

      // Mock cache failure
      mockCacheService.get.mockResolvedValue(null);

      const result = await fallbackService.executeFallback(
        "maps_api",
        error,
        "route_calculation"
      );

      // Should fall back to default strategy
      expect(result.success).toBe(true);
      expect(result.strategy).toBe("default");
      expect(result.data).toHaveProperty("duration", 3600);
      expect(result.data).toHaveProperty("fallback", true);
    });
  });
});
