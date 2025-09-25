/**
 * Circuit Breaker pattern implementation for external API calls
 * Prevents cascading failures by temporarily disabling failing services
 */

import { logger } from "./logger";
import { SystemError, ErrorCode } from "./errors";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private readonly config: CircuitBreakerConfig;
  private readonly serviceName: string;

  constructor(serviceName: string, config: CircuitBreakerConfig) {
    this.serviceName = serviceName;
    const defaultConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
    };
    this.config = { ...defaultConfig, ...config };

    logger.info("Circuit breaker initialized", {
      serviceName: this.serviceName,
      config: this.config,
    });
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info("Circuit breaker transitioning to HALF_OPEN", {
          serviceName: this.serviceName,
        });
      } else {
        throw new SystemError(
          `Circuit breaker is OPEN for service: ${this.serviceName}`,
          ErrorCode.CIRCUIT_BREAKER_OPEN,
          this.serviceName,
          503,
          false,
          {
            nextAttemptTime: this.nextAttemptTime,
            failureCount: this.failureCount,
          }
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      logger.info("Circuit breaker reset to CLOSED", {
        serviceName: this.serviceName,
        successCount: this.successCount,
      });
    }
  }

  private onFailure(error: any): void {
    // Check if this is an expected error that shouldn't trigger circuit breaker
    if (this.isExpectedError(error)) {
      logger.debug("Expected error, not counting towards circuit breaker", {
        serviceName: this.serviceName,
        error: error.message,
      });
      return;
    }

    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.warn("Circuit breaker failure recorded", {
      serviceName: this.serviceName,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      error: error.message,
    });

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);

      logger.error("Circuit breaker opened", {
        serviceName: this.serviceName,
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  private isExpectedError(error: any): boolean {
    if (!this.config.expectedErrors) return false;

    const errorCode = error.code || error.name;
    return this.config.expectedErrors.includes(errorCode);
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;

    logger.info("Circuit breaker manually reset", {
      serviceName: this.serviceName,
    });
  }
}

// Circuit breaker registry for managing multiple service breakers
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: Map<string, CircuitBreaker> = new Map();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  getOrCreate(
    serviceName: string,
    config: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  get(serviceName: string): CircuitBreaker | undefined {
    return this.breakers.get(serviceName);
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [serviceName, breaker] of this.breakers) {
      stats[serviceName] = breaker.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info("All circuit breakers reset");
  }
}
