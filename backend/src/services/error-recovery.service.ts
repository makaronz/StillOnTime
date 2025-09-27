/**
 * Comprehensive error recovery coordinator
 * Orchestrates circuit breakers, retries, fallbacks, and monitoring
 */

import { logger, structuredLogger } from "../utils/logger";
import { CircuitBreakerRegistry } from "../utils/circuit-breaker";
import { RetryManager, RETRY_CONFIGS } from "../utils/retry";
import { FallbackService, FallbackResult } from "./fallback.service";
import { MonitoringService } from "./monitoring.service";
import { NotificationService } from "./notification.service";
import { CacheService } from "./cache.service";
import {
  BaseError,
  ErrorCode,
  ErrorContext,
  FallbackData,
  APIError,
  OAuthError,
  DatabaseError,
  SystemError,
} from "../utils/errors";
import { getCircuitBreakerConfig } from "../config/circuit-breaker-config";

export interface RecoveryOptions {
  enableRetry?: boolean;
  enableFallback?: boolean;
  enableCircuitBreaker?: boolean;
  maxRecoveryAttempts?: number;
  notifyOnFailure?: boolean;
  cacheFailureData?: boolean;
  gracefulDegradation?: boolean;
  userFacingOperation?: boolean;
}

export interface RecoveryResult<T = any> {
  success: boolean;
  data?: T;
  recoveryMethod: string;
  attempts: number;
  totalTime: number;
  degraded: boolean;
  warnings: string[];
  errors: string[];
  fallbackUsed: boolean;
  circuitBreakerTripped: boolean;
}

export interface RecoveryContext {
  serviceName: string;
  operation: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export class ErrorRecoveryService {
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private fallbackService: FallbackService;
  private monitoringService: MonitoringService;
  private notificationService: NotificationService;
  private cacheService: CacheService;

  private recoveryStats: Map<
    string,
    {
      attempts: number;
      successes: number;
      failures: number;
      averageRecoveryTime: number;
    }
  > = new Map();

  constructor(
    fallbackService: FallbackService,
    monitoringService: MonitoringService,
    notificationService: NotificationService,
    cacheService: CacheService
  ) {
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.fallbackService = fallbackService;
    this.monitoringService = monitoringService;
    this.notificationService = notificationService;
    this.cacheService = cacheService;

    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for all services
   */
  private initializeCircuitBreakers(): void {
    const services = [
      "oauth2",
      "gmail_api",
      "calendar_api",
      "maps_api",
      "weather_api",
      "database",
      "cache",
      "sms_service",
      "push_service",
      "pdf_processor",
    ];

    services.forEach((serviceName) => {
      const config = getCircuitBreakerConfig(serviceName);
      this.circuitBreakerRegistry.getOrCreate(serviceName, config);
    });

    structuredLogger.info("Circuit breakers initialized for error recovery", {
      servicesCount: services.length,
    });
  }

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: RecoveryContext,
    options: RecoveryOptions = {}
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    const defaultOptions: RecoveryOptions = {
      enableRetry: true,
      enableFallback: true,
      enableCircuitBreaker: true,
      maxRecoveryAttempts: 3,
      notifyOnFailure: true,
      cacheFailureData: true,
      gracefulDegradation: true,
      userFacingOperation: false,
    };

    const finalOptions = { ...defaultOptions, ...options };
    const warnings: string[] = [];
    const errors: string[] = [];
    let attempts = 0;
    let circuitBreakerTripped = false;
    let fallbackUsed = false;

    structuredLogger.info("Starting operation with error recovery", {
      serviceName: context.serviceName,
      operation: context.operation,
      userId: context.userId,
      requestId: context.requestId,
      options: finalOptions,
    });

    // Check circuit breaker first
    if (finalOptions.enableCircuitBreaker) {
      const circuitBreaker = this.circuitBreakerRegistry.get(
        context.serviceName
      );
      if (circuitBreaker?.getStats().state === "OPEN") {
        circuitBreakerTripped = true;
        warnings.push(`Circuit breaker is OPEN for ${context.serviceName}`);

        if (finalOptions.enableFallback) {
          return await this.executeFallbackRecovery<T>(
            context,
            new SystemError(
              "Circuit breaker is open",
              ErrorCode.CIRCUIT_BREAKER_OPEN,
              context.serviceName
            ),
            finalOptions,
            startTime,
            warnings,
            errors,
            true,
            true
          );
        }

        return this.createFailureResult<T>(
          "circuit_breaker_open",
          0,
          Date.now() - startTime,
          warnings,
          errors,
          false,
          true
        );
      }
    }

    // Execute operation with retry and circuit breaker
    for (
      attempts = 1;
      attempts <= finalOptions.maxRecoveryAttempts!;
      attempts++
    ) {
      try {
        let result: T;

        if (finalOptions.enableCircuitBreaker) {
          const circuitBreaker = this.circuitBreakerRegistry.get(
            context.serviceName
          );
          if (circuitBreaker) {
            result = await circuitBreaker.execute(operation);
          } else {
            result = await operation();
          }
        } else {
          result = await operation();
        }

        // Success - record metrics and return
        this.recordRecoverySuccess(
          context.serviceName,
          attempts,
          Date.now() - startTime
        );
        this.monitoringService.recordRequest(
          `${context.serviceName}:${context.operation}`,
          Date.now() - startTime,
          false
        );

        structuredLogger.info("Operation succeeded", {
          serviceName: context.serviceName,
          operation: context.operation,
          attempts,
          totalTime: Date.now() - startTime,
        });

        return {
          success: true,
          data: result,
          recoveryMethod: attempts > 1 ? "retry" : "direct",
          attempts,
          totalTime: Date.now() - startTime,
          degraded: false,
          warnings,
          errors,
          fallbackUsed: false,
          circuitBreakerTripped: false,
        };
      } catch (error) {
        const baseError = this.normalizeError(error);
        errors.push(`Attempt ${attempts}: ${baseError.message}`);

        structuredLogger.warn("Operation attempt failed", {
          serviceName: context.serviceName,
          operation: context.operation,
          attempt: attempts,
          errorCode: baseError.code,
          errorMessage: baseError.message,
        });

        // Record error metrics
        this.monitoringService.recordRequest(
          `${context.serviceName}:${context.operation}`,
          Date.now() - startTime,
          true
        );

        // Check if we should retry
        if (
          attempts < finalOptions.maxRecoveryAttempts! &&
          this.shouldRetry(baseError, finalOptions)
        ) {
          if (finalOptions.enableRetry) {
            const retryConfig = this.getRetryConfig(context.serviceName);
            const delay = this.calculateRetryDelay(attempts, retryConfig);

            warnings.push(`Retrying in ${delay}ms after attempt ${attempts}`);
            await this.sleep(delay);
            continue;
          }
        }

        // All retries exhausted or non-retryable error
        if (finalOptions.enableFallback) {
          return await this.executeFallbackRecovery<T>(
            context,
            baseError,
            finalOptions,
            startTime,
            warnings,
            errors,
            false,
            circuitBreakerTripped
          );
        }

        // No fallback available
        this.recordRecoveryFailure(
          context.serviceName,
          attempts,
          Date.now() - startTime
        );

        if (finalOptions.notifyOnFailure && finalOptions.userFacingOperation) {
          await this.notifyOperationFailure(context, baseError, attempts);
        }

        return this.createFailureResult<T>(
          "all_recovery_failed",
          attempts,
          Date.now() - startTime,
          warnings,
          errors,
          false,
          circuitBreakerTripped
        );
      }
    }

    // This should never be reached, but included for completeness
    return this.createFailureResult<T>(
      "unexpected_failure",
      attempts,
      Date.now() - startTime,
      warnings,
      errors,
      false,
      circuitBreakerTripped
    );
  }

  /**
   * Execute fallback recovery
   */
  private async executeFallbackRecovery<T>(
    context: RecoveryContext,
    error: BaseError,
    options: RecoveryOptions,
    startTime: number,
    warnings: string[],
    errors: string[],
    fallbackUsed: boolean,
    circuitBreakerTripped: boolean
  ): Promise<RecoveryResult<T>> {
    structuredLogger.info("Attempting fallback recovery", {
      serviceName: context.serviceName,
      operation: context.operation,
      errorCode: error.code,
    });

    try {
      const fallbackResult = await this.fallbackService.executeFallback<T>(
        context.serviceName,
        error,
        context.operation,
        context.metadata
      );

      if (fallbackResult.success) {
        warnings.push(...(fallbackResult.warnings || []));

        if (options.cacheFailureData && fallbackResult.data) {
          await this.cacheFailureData(context, fallbackResult.data);
        }

        if (
          options.notifyOnFailure &&
          options.userFacingOperation &&
          fallbackResult.degraded
        ) {
          await this.notifyDegradedService(context, fallbackResult.strategy);
        }

        structuredLogger.info("Fallback recovery succeeded", {
          serviceName: context.serviceName,
          operation: context.operation,
          strategy: fallbackResult.strategy,
          degraded: fallbackResult.degraded,
        });

        return {
          success: true,
          data: fallbackResult.data,
          recoveryMethod: `fallback_${fallbackResult.strategy}`,
          attempts: 0,
          totalTime: Date.now() - startTime,
          degraded: fallbackResult.degraded,
          warnings,
          errors,
          fallbackUsed: true,
          circuitBreakerTripped,
        };
      }

      warnings.push(...(fallbackResult.warnings || []));
      errors.push("Fallback recovery failed");
    } catch (fallbackError) {
      errors.push(
        `Fallback error: ${
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)
        }`
      );
    }

    // Fallback failed
    this.recordRecoveryFailure(context.serviceName, 0, Date.now() - startTime);

    if (options.notifyOnFailure && options.userFacingOperation) {
      await this.notifyOperationFailure(context, error, 0);
    }

    return this.createFailureResult<T>(
      "fallback_failed",
      0,
      Date.now() - startTime,
      warnings,
      errors,
      fallbackUsed,
      circuitBreakerTripped
    );
  }

  /**
   * Normalize error to BaseError
   */
  private normalizeError(error: unknown): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      return new SystemError(
        error.message,
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "unknown_service",
        500,
        true,
        { originalError: error.name }
      );
    }

    return new SystemError(
      String(error),
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      "unknown_service"
    );
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: BaseError, options: RecoveryOptions): boolean {
    if (!options.enableRetry) return false;

    // Non-retryable error codes
    const nonRetryableErrors = [
      ErrorCode.OAUTH_INVALID_GRANT,
      ErrorCode.OAUTH_INSUFFICIENT_SCOPE,
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.DATABASE_CONSTRAINT_ERROR,
    ];

    if (nonRetryableErrors.includes(error.code)) {
      return false;
    }

    // Check if error is retryable based on type
    if (error instanceof APIError) {
      return error.retryable;
    }

    if (error instanceof DatabaseError) {
      return error.retryable;
    }

    if (error instanceof SystemError) {
      return error.retryable;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Get retry configuration for service
   */
  private getRetryConfig(serviceName: string) {
    const configMap: Record<string, any> = {
      oauth2: RETRY_CONFIGS.OAUTH,
      gmail_api: RETRY_CONFIGS.GMAIL_API,
      calendar_api: RETRY_CONFIGS.CALENDAR_API,
      maps_api: RETRY_CONFIGS.MAPS_API,
      weather_api: RETRY_CONFIGS.WEATHER_API,
      database: RETRY_CONFIGS.DATABASE,
      cache: RETRY_CONFIGS.CACHE,
      sms_service: RETRY_CONFIGS.SMS_SERVICE,
      push_service: RETRY_CONFIGS.PUSH_SERVICE,
      pdf_processor: RETRY_CONFIGS.PDF_PROCESSOR,
    };

    return configMap[serviceName] || RETRY_CONFIGS.GMAIL_API;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(
    attempt: number,
    config: {
      baseDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
      jitterFactor?: number;
      jitter?: boolean;
    }
  ): number {
    const baseDelay = config.baseDelay || 1000;
    const maxDelay = config.maxDelay || 30000;
    const backoffMultiplier = config.backoffMultiplier || 2;
    const jitterFactor = config.jitterFactor || 0.1;

    const exponentialDelay =
      baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Cache failure data for future fallback use
   */
  private async cacheFailureData(
    context: RecoveryContext,
    data: FallbackData
  ): Promise<void> {
    try {
      const cacheKey = `failure_cache:${context.serviceName}:${context.operation}`;
      await this.cacheService.set(cacheKey, data, { ttl: 3600 }); // 1 hour

      structuredLogger.debug("Cached failure data for future fallback", {
        serviceName: context.serviceName,
        operation: context.operation,
        cacheKey,
      });
    } catch (cacheError) {
      structuredLogger.warn("Failed to cache failure data", {
        serviceName: context.serviceName,
        operation: context.operation,
        error:
          cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }
  }

  /**
   * Notify user of operation failure
   */
  private async notifyOperationFailure(
    context: RecoveryContext,
    error: BaseError,
    attempts: number
  ): Promise<void> {
    try {
      await this.notificationService.sendSystemAlert({
        type: "operation_failure",
        serviceName: context.serviceName,
        errorCode: error.code,
        impact: "high",
        affectedOperations: [context.operation],
        estimatedRecoveryTime: 0,
        timestamp: new Date(),
      });
    } catch (notificationError) {
      structuredLogger.error("Failed to send operation failure notification", {
        serviceName: context.serviceName,
        operation: context.operation,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }
  }

  /**
   * Notify user of degraded service
   */
  private async notifyDegradedService(
    context: RecoveryContext,
    strategy: string
  ): Promise<void> {
    try {
      await this.notificationService.sendSystemAlert({
        type: "service_degraded",
        serviceName: context.serviceName,
        errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        impact: "medium",
        affectedOperations: [context.operation],
        estimatedRecoveryTime: 300, // 5 minutes
        timestamp: new Date(),
      });
    } catch (notificationError) {
      structuredLogger.error(
        "Failed to send service degradation notification",
        {
          serviceName: context.serviceName,
          operation: context.operation,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        }
      );
    }
  }

  /**
   * Record recovery success metrics
   */
  private recordRecoverySuccess(
    serviceName: string,
    attempts: number,
    totalTime: number
  ): void {
    const key = serviceName;
    const existing = this.recoveryStats.get(key) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      averageRecoveryTime: 0,
    };

    existing.attempts += attempts;
    existing.successes++;
    existing.averageRecoveryTime =
      (existing.averageRecoveryTime * (existing.successes - 1) + totalTime) /
      existing.successes;

    this.recoveryStats.set(key, existing);
  }

  /**
   * Record recovery failure metrics
   */
  private recordRecoveryFailure(
    serviceName: string,
    attempts: number,
    totalTime: number
  ): void {
    const key = serviceName;
    const existing = this.recoveryStats.get(key) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      averageRecoveryTime: 0,
    };

    existing.attempts += attempts;
    existing.failures++;

    this.recoveryStats.set(key, existing);
  }

  /**
   * Create failure result
   */
  private createFailureResult<T>(
    recoveryMethod: string,
    attempts: number,
    totalTime: number,
    warnings: string[],
    errors: string[],
    fallbackUsed: boolean,
    circuitBreakerTripped: boolean
  ): RecoveryResult<T> {
    return {
      success: false,
      recoveryMethod,
      attempts,
      totalTime,
      degraded: false,
      warnings,
      errors,
      fallbackUsed,
      circuitBreakerTripped,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  public getRecoveryStats(): Record<string, any> {
    return Object.fromEntries(this.recoveryStats.entries());
  }

  /**
   * Reset recovery statistics
   */
  public resetRecoveryStats(): void {
    this.recoveryStats.clear();
  }

  /**
   * Get circuit breaker status for all services
   */
  public getCircuitBreakerStatus(): Record<string, any> {
    return this.circuitBreakerRegistry.getAllStats();
  }

  /**
   * Reset circuit breaker for a service
   */
  public resetCircuitBreaker(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakerRegistry.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  public resetAllCircuitBreakers(): void {
    this.circuitBreakerRegistry.resetAll();
  }
}
