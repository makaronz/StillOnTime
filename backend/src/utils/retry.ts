/**
 * Retry mechanism with exponential backoff and jitter
 * Implements resilient retry patterns for external API calls
 */

import { logger } from "./logger";
import { SystemError, ErrorCode } from "./errors";

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: any) => void;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTime: number;
}

export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [
      "ECONNRESET",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "NETWORK_ERROR",
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
    ],
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName: string = "unknown"
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...RetryManager.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        logger.debug("Executing operation with retry", {
          operationName,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
        });

        const result = await operation();
        const totalTime = Date.now() - startTime;

        logger.info("Operation succeeded", {
          operationName,
          attempt,
          totalTime,
          success: true,
        });

        return {
          result,
          attempts: attempt,
          totalTime,
        };
      } catch (error) {
        lastError = error;

        logger.warn("Operation failed", {
          operationName,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.code,
        });

        // Check if error is retryable
        if (
          !RetryManager.isRetryableError(error, finalConfig.retryableErrors)
        ) {
          logger.error("Non-retryable error encountered", {
            operationName,
            attempt,
            error: error instanceof Error ? error.message : String(error),
            errorCode: (error as any)?.code,
          });
          throw error;
        }

        // Don't delay after the last attempt
        if (attempt < finalConfig.maxAttempts) {
          const delay = RetryManager.calculateDelay(
            attempt,
            finalConfig.baseDelay,
            finalConfig.maxDelay,
            finalConfig.backoffMultiplier,
            finalConfig.jitterFactor
          );

          logger.debug("Waiting before retry", {
            operationName,
            attempt,
            delay,
            nextAttempt: attempt + 1,
          });

          // Call onRetry callback if provided
          if (finalConfig.onRetry) {
            try {
              finalConfig.onRetry(attempt, error);
            } catch (callbackError) {
              logger.warn("Retry callback failed", {
                operationName,
                attempt,
                callbackError:
                  callbackError instanceof Error
                    ? callbackError.message
                    : String(callbackError),
              });
            }
          }

          await RetryManager.sleep(delay);
        }
      }
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;

    logger.error("All retry attempts failed", {
      operationName,
      attempts: finalConfig.maxAttempts,
      totalTime,
      lastError: lastError.message,
    });

    throw new SystemError(
      `${operationName} failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
      ErrorCode.RETRY_LIMIT_EXCEEDED,
      operationName,
      503,
      false,
      {
        attempts: finalConfig.maxAttempts,
        totalTime,
        originalError: lastError.message,
        originalErrorCode: lastError.code,
      }
    );
  }

  private static isRetryableError(
    error: any,
    retryableErrors?: string[]
  ): boolean {
    if (!retryableErrors) return true;

    const errorCode = error.code || error.name || "UNKNOWN";
    const errorMessage = error.message || "";

    // Check if error code or message is in retryable list
    if (
      retryableErrors.includes(errorCode) ||
      retryableErrors.includes(errorMessage)
    ) {
      return true;
    }

    // Check for HTTP status codes that are retryable
    if (error.status || error.statusCode) {
      const statusCode = error.status || error.statusCode;
      // Retry on 5xx errors and specific 4xx errors
      if (statusCode >= 500 || statusCode === 429 || statusCode === 408) {
        return true;
      }
    }

    // Check for specific error messages
    const retryableMessages = [
      "timeout",
      "network error",
      "connection reset",
      "rate limit",
      "service unavailable",
      "internal server error",
    ];

    return retryableMessages.some((msg) =>
      errorMessage.toLowerCase().includes(msg)
    );
  }

  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    backoffMultiplier: number,
    jitterFactor: number
  ): number {
    // Calculate exponential backoff
    const exponentialDelay =
      baseDelay * Math.pow(backoffMultiplier, attempt - 1);

    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, cappedDelay + jitter);

    return Math.round(finalDelay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Decorator for automatic retry functionality
export function withRetry(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const operationName = `${target.constructor.name}.${propertyName}`;

      return RetryManager.executeWithRetry(
        () => method.apply(this, args),
        config,
        operationName
      );
    };

    return descriptor;
  };
}

// Enhanced retry configurations for different services with improved jitter
export const RETRY_CONFIGS = {
  OAUTH: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableErrors: [
      "OAUTH_TOKEN_EXPIRED",
      "OAUTH_RATE_LIMITED",
      "NETWORK_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  GMAIL_API: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2.5,
    jitterFactor: 0.3,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "NETWORK_ERROR",
      "QUOTA_EXCEEDED",
      "BACKEND_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ],
  },

  CALENDAR_API: {
    maxAttempts: 4,
    baseDelay: 1500,
    maxDelay: 25000,
    backoffMultiplier: 2.2,
    jitterFactor: 0.25,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "NETWORK_ERROR",
      "QUOTA_EXCEEDED",
      "BACKEND_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  MAPS_API: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "QUOTA_EXCEEDED",
      "NETWORK_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  WEATHER_API: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 3,
    jitterFactor: 0.4,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "NETWORK_ERROR",
      "API_KEY_INVALID",
      "QUOTA_EXCEEDED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ],
  },

  DATABASE: {
    maxAttempts: 4,
    baseDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    retryableErrors: [
      "CONNECTION_ERROR",
      "TIMEOUT_ERROR",
      "TRANSACTION_ERROR",
      "DEADLOCK_DETECTED",
      "CONNECTION_LOST",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  CACHE: {
    maxAttempts: 3,
    baseDelay: 300,
    maxDelay: 3000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [
      "CONNECTION_ERROR",
      "TIMEOUT_ERROR",
      "NETWORK_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  SMS_SERVICE: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 20000,
    backoffMultiplier: 2.5,
    jitterFactor: 0.3,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "NETWORK_ERROR",
      "QUOTA_EXCEEDED",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  PUSH_SERVICE: {
    maxAttempts: 3,
    baseDelay: 1500,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.25,
    retryableErrors: [
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "NETWORK_ERROR",
      "ECONNRESET",
      "ETIMEDOUT",
    ],
  },

  PDF_PROCESSOR: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: ["PROCESSING_ERROR", "MEMORY_ERROR", "TIMEOUT_ERROR"],
  },
};
