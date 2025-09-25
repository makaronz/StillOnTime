/**
 * Tests for circuit breaker implementation
 */

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerRegistry,
} from "../../src/utils/circuit-breaker";
import { SystemError, ErrorCode } from "../../src/utils/errors";

// Mock logger
jest.mock("../../src/utils/logger");

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  const serviceName = "test-service";
  const config = {
    failureThreshold: 3,
    recoveryTimeout: 1000,
    monitoringPeriod: 5000,
    expectedErrors: ["EXPECTED_ERROR"],
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(serviceName, config);
  });

  describe("CLOSED state", () => {
    it("should execute operation successfully", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalled();
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it("should record failures but stay closed below threshold", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));

      // Fail twice (below threshold of 3)
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "test error"
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "test error"
      );

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(2);
    });

    it("should open circuit when failure threshold is reached", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));

      // Fail 3 times (at threshold)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
          "test error"
        );
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failureCount).toBe(3);
      expect(stats.nextAttemptTime).toBeDefined();
    });

    it("should not count expected errors towards failure threshold", async () => {
      const expectedError = new Error("EXPECTED_ERROR");
      expectedError.name = "EXPECTED_ERROR";
      const mockOperation = jest.fn().mockRejectedValue(expectedError);

      // Fail 5 times with expected error
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
          "EXPECTED_ERROR"
        );
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0); // Expected errors don't count
    });
  });

  describe("OPEN state", () => {
    beforeEach(async () => {
      // Force circuit to open
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
    });

    it("should reject calls immediately when circuit is open", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        SystemError
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN"
      );

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should transition to HALF_OPEN after recovery timeout", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe("success");
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });
  });

  describe("HALF_OPEN state", () => {
    beforeEach(async () => {
      // Force circuit to open
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }

      // Wait for recovery timeout to transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should close circuit on successful operation", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe("success");
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats().failureCount).toBe(0);
    });

    it("should reopen circuit on failed operation", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "test error"
      );

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe("reset", () => {
    it("should reset circuit breaker to initial state", async () => {
      // Force circuit to open
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("test error"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

      circuitBreaker.reset();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
      expect(stats.nextAttemptTime).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return current circuit breaker statistics", () => {
      const stats = circuitBreaker.getStats();

      expect(stats).toHaveProperty("state");
      expect(stats).toHaveProperty("failureCount");
      expect(stats).toHaveProperty("successCount");
      expect(stats).toHaveProperty("lastFailureTime");
      expect(stats).toHaveProperty("nextAttemptTime");
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = CircuitBreakerRegistry.getInstance();
  });

  afterEach(() => {
    registry.resetAll();
  });

  it("should create and return circuit breakers", () => {
    const config = {
      failureThreshold: 5,
      recoveryTimeout: 2000,
      monitoringPeriod: 10000,
    };

    const breaker1 = registry.getOrCreate("service1", config);
    const breaker2 = registry.getOrCreate("service2", config);
    const breaker1Again = registry.getOrCreate("service1", config);

    expect(breaker1).toBeDefined();
    expect(breaker2).toBeDefined();
    expect(breaker1).toBe(breaker1Again); // Should return same instance
    expect(breaker1).not.toBe(breaker2);
  });

  it("should get existing circuit breaker", () => {
    const config = {
      failureThreshold: 5,
      recoveryTimeout: 2000,
      monitoringPeriod: 10000,
    };

    const breaker = registry.getOrCreate("service1", config);
    const retrieved = registry.get("service1");

    expect(retrieved).toBe(breaker);
  });

  it("should return undefined for non-existent circuit breaker", () => {
    const retrieved = registry.get("non-existent");

    expect(retrieved).toBeUndefined();
  });

  it("should return all circuit breaker stats", () => {
    const config = {
      failureThreshold: 5,
      recoveryTimeout: 2000,
      monitoringPeriod: 10000,
    };

    registry.getOrCreate("service1", config);
    registry.getOrCreate("service2", config);

    const allStats = registry.getAllStats();

    expect(allStats).toHaveProperty("service1");
    expect(allStats).toHaveProperty("service2");
    expect(allStats.service1).toHaveProperty("state");
    expect(allStats.service2).toHaveProperty("state");
  });

  it("should reset all circuit breakers", async () => {
    const config = {
      failureThreshold: 2,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
    };

    const breaker1 = registry.getOrCreate("reset-test-service1", config);
    const breaker2 = registry.getOrCreate("reset-test-service2", config);

    // Force both breakers to open
    const mockOperation = jest.fn().mockRejectedValue(new Error("test error"));
    for (let i = 0; i < 3; i++) {
      await expect(breaker1.execute(mockOperation)).rejects.toThrow();
      await expect(breaker2.execute(mockOperation)).rejects.toThrow();
    }

    expect(breaker1.getStats().state).toBe(CircuitState.OPEN);
    expect(breaker2.getStats().state).toBe(CircuitState.OPEN);

    registry.resetAll();

    expect(breaker1.getStats().state).toBe(CircuitState.CLOSED);
    expect(breaker2.getStats().state).toBe(CircuitState.CLOSED);
  });

  it("should be a singleton", () => {
    const registry1 = CircuitBreakerRegistry.getInstance();
    const registry2 = CircuitBreakerRegistry.getInstance();

    expect(registry1).toBe(registry2);
  });
});
