/**
 * Tests for retry mechanism with exponential backoff
 */

import { RetryManager, withRetry, RETRY_CONFIGS } from "../../src/utils/retry";
import { SystemError, ErrorCode } from "../../src/utils/errors";

// Mock logger
jest.mock("../../src/utils/logger");

describe("RetryManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("executeWithRetry", () => {
    it("should succeed on first attempt", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      const result = await RetryManager.executeWithRetry(
        mockOperation,
        { maxAttempts: 3 },
        "test-operation"
      );

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockRejectedValueOnce(new Error("RATE_LIMITED"))
        .mockResolvedValue("success");

      const result = await RetryManager.executeWithRetry(
        mockOperation,
        { maxAttempts: 3, baseDelay: 10 },
        "test-operation"
      );

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("should fail after max attempts", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("NETWORK_ERROR"));

      await expect(
        RetryManager.executeWithRetry(
          mockOperation,
          { maxAttempts: 2, baseDelay: 10 },
          "test-operation"
        )
      ).rejects.toThrow(SystemError);

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should not retry non-retryable errors", async () => {
      const nonRetryableError = new Error("VALIDATION_ERROR");
      const mockOperation = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(
        RetryManager.executeWithRetry(
          mockOperation,
          {
            maxAttempts: 3,
            retryableErrors: ["NETWORK_ERROR"], // Only network errors are retryable
          },
          "test-operation"
        )
      ).rejects.toThrow("VALIDATION_ERROR");

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should retry on HTTP 5xx status codes", async () => {
      const error500 = new Error("Internal Server Error");
      (error500 as any).status = 500;

      const error429 = new Error("Too Many Requests");
      (error429 as any).status = 429;

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(error500)
        .mockRejectedValueOnce(error429)
        .mockResolvedValue("success");

      const result = await RetryManager.executeWithRetry(
        mockOperation,
        { maxAttempts: 3, baseDelay: 10 },
        "test-operation"
      );

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(3);
    });

    it("should not retry on HTTP 4xx status codes (except specific ones)", async () => {
      const error400 = new Error("Bad Request");
      (error400 as any).status = 400;

      const mockOperation = jest.fn().mockRejectedValue(error400);

      await expect(
        RetryManager.executeWithRetry(
          mockOperation,
          { maxAttempts: 3, baseDelay: 10 },
          "test-operation"
        )
      ).rejects.toThrow("Bad Request");

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should call onRetry callback", async () => {
      const onRetryCallback = jest.fn();
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockResolvedValue("success");

      await RetryManager.executeWithRetry(
        mockOperation,
        {
          maxAttempts: 2,
          baseDelay: 10,
          onRetry: onRetryCallback,
        },
        "test-operation"
      );

      expect(onRetryCallback).toHaveBeenCalledTimes(1);
      expect(onRetryCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it("should handle onRetry callback errors gracefully", async () => {
      const onRetryCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockResolvedValue("success");

      const result = await RetryManager.executeWithRetry(
        mockOperation,
        {
          maxAttempts: 2,
          baseDelay: 10,
          onRetry: onRetryCallback,
        },
        "test-operation"
      );

      expect(result.result).toBe("success");
      expect(onRetryCallback).toHaveBeenCalled();
    });

    it("should apply exponential backoff with jitter", async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      }) as any;

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockResolvedValue("success");

      await RetryManager.executeWithRetry(
        mockOperation,
        {
          maxAttempts: 3,
          baseDelay: 100,
          backoffMultiplier: 2,
          jitterFactor: 0.1,
        },
        "test-operation"
      );

      expect(delays).toHaveLength(2);
      expect(delays[0]).toBeGreaterThan(90); // ~100ms with jitter
      expect(delays[0]).toBeLessThan(220);
      expect(delays[1]).toBeGreaterThan(180); // ~200ms with jitter
      expect(delays[1]).toBeLessThan(440);

      global.setTimeout = originalSetTimeout;
    });

    it("should respect max delay limit", async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockResolvedValue("success");

      await RetryManager.executeWithRetry(
        mockOperation,
        {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 1500,
          backoffMultiplier: 3,
          jitterFactor: 0,
        },
        "test-operation"
      );

      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(1000); // First delay: base delay
      expect(delays[1]).toBe(1500); // Second delay: capped at max delay

      global.setTimeout = originalSetTimeout;
    });
  });

  describe("withRetry decorator", () => {
    it("should retry decorated method", async () => {
      class TestService {
        private callCount = 0;

        @withRetry({ maxAttempts: 3, baseDelay: 10 })
        async testMethod(): Promise<string> {
          this.callCount++;
          if (this.callCount < 3) {
            throw new Error("NETWORK_ERROR");
          }
          return "success";
        }

        getCallCount(): number {
          return this.callCount;
        }
      }

      const service = new TestService();
      const result = await service.testMethod();

      expect((result as any).result).toBe("success");
      expect((result as any).attempts).toBe(3);
      expect(service.getCallCount()).toBe(3);
    });

    it("should use method name in operation name", async () => {
      class TestService {
        @withRetry({ maxAttempts: 2 })
        async failingMethod(): Promise<string> {
          throw new Error("NETWORK_ERROR");
        }
      }

      const service = new TestService();

      await expect(service.failingMethod()).rejects.toThrow(SystemError);
      await expect(service.failingMethod()).rejects.toThrow(
        "TestService.failingMethod"
      );
    });
  });

  describe("RETRY_CONFIGS", () => {
    it("should have predefined configurations for different services", () => {
      expect(RETRY_CONFIGS.OAUTH).toBeDefined();
      expect(RETRY_CONFIGS.GMAIL_API).toBeDefined();
      expect(RETRY_CONFIGS.CALENDAR_API).toBeDefined();
      expect(RETRY_CONFIGS.MAPS_API).toBeDefined();
      expect(RETRY_CONFIGS.WEATHER_API).toBeDefined();
      expect(RETRY_CONFIGS.DATABASE).toBeDefined();
    });

    it("should have reasonable default values", () => {
      expect(RETRY_CONFIGS.OAUTH.maxAttempts).toBe(2);
      expect(RETRY_CONFIGS.GMAIL_API.maxAttempts).toBe(3);
      expect(RETRY_CONFIGS.DATABASE.baseDelay).toBe(500);
      expect(RETRY_CONFIGS.WEATHER_API.maxDelay).toBe(15000);
    });

    it("should have appropriate retryable errors for each service", () => {
      expect(RETRY_CONFIGS.OAUTH.retryableErrors).toContain(
        "OAUTH_TOKEN_EXPIRED"
      );
      expect(RETRY_CONFIGS.GMAIL_API.retryableErrors).toContain("RATE_LIMITED");
      expect(RETRY_CONFIGS.DATABASE.retryableErrors).toContain(
        "CONNECTION_ERROR"
      );
    });
  });

  describe("error classification", () => {
    it("should identify retryable errors by message content", async () => {
      const timeoutError = new Error("Request timeout occurred");
      const networkError = new Error("Network error detected");
      const rateLimit = new Error("Rate limit exceeded");

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(rateLimit)
        .mockResolvedValue("success");

      const result = await RetryManager.executeWithRetry(
        mockOperation,
        { maxAttempts: 4, baseDelay: 10 },
        "test-operation"
      );

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(4);
    });

    it("should not retry validation errors", async () => {
      const validationError = new Error("Invalid input provided");
      const mockOperation = jest.fn().mockRejectedValue(validationError);

      await expect(
        RetryManager.executeWithRetry(
          mockOperation,
          { maxAttempts: 3, baseDelay: 10 },
          "test-operation"
        )
      ).rejects.toThrow("Invalid input provided");

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});
