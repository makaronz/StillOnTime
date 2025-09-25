/**
 * Comprehensive error handling service
 * Coordinates error recovery, logging, and fallback mechanisms
 */

import { logger, structuredLogger } from "../utils/logger";
import {
  BaseError,
  OAuthError,
  APIError,
  PDFProcessingError,
  DatabaseError,
  SystemError,
  ErrorCode,
} from "../utils/errors";
import { FallbackData } from "../types";
import { CircuitBreakerRegistry } from "../utils/circuit-breaker";
import { RetryManager, RETRY_CONFIGS } from "../utils/retry";
import { OAuth2Service } from "./oauth2.service";
import { CacheService } from "./cache.service";
import { NotificationService } from "./notification.service";

export interface ErrorRecoveryResult<T = any> {
  success: boolean;
  data?: T;
  fallbackUsed: boolean;
  error?: BaseError;
  recoveryAction?: string;
}

export interface FallbackOptions {
  useCachedData?: boolean;
  useDefaultValues?: boolean;
  skipOperation?: boolean;
  alternativeService?: string;
  gracefulDegradation?: boolean;
  notifyUser?: boolean;
  cacheKey?: string;
  fallbackData?: FallbackData;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastErrorTime: Date;
  recoveryCount: number;
  fallbackUsageCount: number;
  averageRecoveryTime: number;
}

export interface CriticalServiceFailure {
  serviceName: string;
  errorCode: ErrorCode;
  failureTime: Date;
  impact: "low" | "medium" | "high" | "critical";
  affectedOperations: string[];
  estimatedRecoveryTime?: number;
}

export class ErrorHandlerService {
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private oauth2Service: OAuth2Service;
  private cacheService: CacheService;
  private notificationService: NotificationService;
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private criticalFailures: CriticalServiceFailure[] = [];

  constructor(
    oauth2Service: OAuth2Service,
    cacheService: CacheService,
    notificationService: NotificationService
  ) {
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.oauth2Service = oauth2Service;
    this.cacheService = cacheService;
    this.notificationService = notificationService;

    // Initialize error metrics cleanup
    this.initializeMetricsCleanup();
  }

  /**
   * Handle OAuth 2.0 errors with automatic re-authorization
   */
  async handleOAuthError(
    error: OAuthError,
    userId: string,
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    logger.warn("Handling OAuth error", {
      userId,
      errorCode: error.code,
      message: error.message,
    });

    try {
      switch (error.code) {
        case ErrorCode.OAUTH_TOKEN_EXPIRED:
          return await this.handleTokenExpiration(userId, operation);

        case ErrorCode.OAUTH_INVALID_GRANT:
          return await this.handleInvalidGrant(userId);

        case ErrorCode.OAUTH_INSUFFICIENT_SCOPE:
          return await this.handleInsufficientScope(userId, error);

        case ErrorCode.OAUTH_RATE_LIMITED:
          return await this.handleOAuthRateLimit(userId, operation);

        default:
          return {
            success: false,
            fallbackUsed: false,
            error,
            recoveryAction: "manual_intervention_required",
          };
      }
    } catch (recoveryError) {
      logger.error("OAuth error recovery failed", {
        userId,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
      });

      return {
        success: false,
        fallbackUsed: false,
        error: recoveryError as BaseError,
        recoveryAction: "recovery_failed",
      };
    }
  }

  /**
   * Handle API failures with circuit breaker and fallback
   */
  async handleAPIFailure<T>(
    error: APIError,
    operation: () => Promise<T>,
    fallbackOptions: FallbackOptions = {}
  ): Promise<ErrorRecoveryResult<T>> {
    logger.warn("Handling API failure", {
      apiName: error.apiName,
      errorCode: error.code,
      retryable: error.retryable,
    });

    const circuitBreaker = this.circuitBreakerRegistry.get(error.apiName);

    // If circuit breaker is open, try fallback immediately
    if (circuitBreaker?.getStats().state === "OPEN") {
      return await this.tryFallback(error, fallbackOptions);
    }

    // Try retry if error is retryable
    if (error.retryable) {
      try {
        const retryConfig = this.getRetryConfigForAPI(error.apiName);
        const result = await RetryManager.executeWithRetry(
          operation,
          retryConfig,
          `${error.apiName}_recovery`
        );

        return {
          success: true,
          data: result.result,
          fallbackUsed: false,
          recoveryAction: `retry_succeeded_after_${result.attempts}_attempts`,
        };
      } catch (retryError) {
        logger.error("API retry failed, trying fallback", {
          apiName: error.apiName,
          retryError:
            retryError instanceof Error
              ? retryError.message
              : String(retryError),
        });

        return await this.tryFallback(error, fallbackOptions);
      }
    }

    // Non-retryable error, try fallback
    return await this.tryFallback(error, fallbackOptions);
  }

  /**
   * Handle PDF processing errors with manual correction interface
   */
  async handlePDFProcessingError(
    error: PDFProcessingError,
    pdfBuffer: Buffer,
    emailId: string
  ): Promise<ErrorRecoveryResult> {
    logger.warn("Handling PDF processing error", {
      errorCode: error.code,
      pdfHash: error.pdfHash,
      confidenceScore: error.confidenceScore,
      emailId,
    });

    try {
      switch (error.code) {
        case ErrorCode.PDF_CORRUPTED:
          return await this.handleCorruptedPDF(pdfBuffer, emailId);

        case ErrorCode.PDF_OCR_FAILED:
          return await this.handleOCRFailure(pdfBuffer, emailId);

        case ErrorCode.PDF_DATA_INVALID:
          return await this.handleInvalidPDFData(error, emailId);

        case ErrorCode.PDF_PARSE_ERROR:
          return await this.handlePDFParseError(pdfBuffer, emailId);

        default:
          return {
            success: false,
            fallbackUsed: false,
            error,
            recoveryAction: "manual_correction_required",
          };
      }
    } catch (recoveryError) {
      logger.error("PDF processing error recovery failed", {
        emailId,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
      });

      return {
        success: false,
        fallbackUsed: false,
        error: recoveryError as BaseError,
        recoveryAction: "recovery_failed",
      };
    }
  }

  /**
   * Handle database errors with transaction rollback
   */
  async handleDatabaseError(
    error: DatabaseError,
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    logger.warn("Handling database error", {
      errorCode: error.code,
      operation: error.operation,
      retryable: error.retryable,
    });

    try {
      switch (error.code) {
        case ErrorCode.DATABASE_CONNECTION_ERROR:
          return await this.handleConnectionError(operation);

        case ErrorCode.DATABASE_TRANSACTION_ERROR:
          return await this.handleTransactionError(operation);

        case ErrorCode.DATABASE_TIMEOUT_ERROR:
          return await this.handleTimeoutError(operation);

        case ErrorCode.DATABASE_CONSTRAINT_ERROR:
          return {
            success: false,
            fallbackUsed: false,
            error,
            recoveryAction: "constraint_violation_manual_fix_required",
          };

        default:
          if (error.retryable) {
            return await this.retryDatabaseOperation(operation);
          }

          return {
            success: false,
            fallbackUsed: false,
            error,
            recoveryAction: "manual_intervention_required",
          };
      }
    } catch (recoveryError) {
      logger.error("Database error recovery failed", {
        operation: error.operation,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
      });

      return {
        success: false,
        fallbackUsed: false,
        error: recoveryError as BaseError,
        recoveryAction: "recovery_failed",
      };
    }
  }

  // Private helper methods

  private async handleTokenExpiration(
    userId: string,
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    logger.info("Attempting token refresh", { userId });

    try {
      // This will internally handle token refresh
      await this.oauth2Service.getGoogleClient(userId);
      const result = await operation();

      return {
        success: true,
        data: result,
        fallbackUsed: false,
        recoveryAction: "token_refreshed",
      };
    } catch (refreshError) {
      logger.error("Token refresh failed", {
        userId,
        error:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
      });

      return {
        success: false,
        fallbackUsed: false,
        error: new OAuthError(
          "Token refresh failed, re-authorization required",
          ErrorCode.OAUTH_INVALID_GRANT,
          401,
          {
            userId,
            originalError:
              refreshError instanceof Error
                ? refreshError.message
                : String(refreshError),
          }
        ),
        recoveryAction: "reauthorization_required",
      };
    }
  }

  private async handleInvalidGrant(
    userId: string
  ): Promise<ErrorRecoveryResult> {
    logger.warn("Invalid grant detected, user needs to re-authorize", {
      userId,
    });

    // Clear stored tokens
    await this.oauth2Service.revokeTokens(userId);

    return {
      success: false,
      fallbackUsed: false,
      error: new OAuthError(
        "User authorization expired, please re-authorize",
        ErrorCode.OAUTH_INVALID_GRANT,
        401,
        { userId }
      ),
      recoveryAction: "reauthorization_required",
    };
  }

  private async handleInsufficientScope(
    userId: string,
    error: OAuthError
  ): Promise<ErrorRecoveryResult> {
    logger.warn("Insufficient OAuth scope", {
      userId,
      requiredScopes: error.context?.requiredScopes,
    });

    return {
      success: false,
      fallbackUsed: false,
      error: new OAuthError(
        "Additional permissions required, please re-authorize with extended scope",
        ErrorCode.OAUTH_INSUFFICIENT_SCOPE,
        403,
        { userId, requiredScopes: error.context?.requiredScopes }
      ),
      recoveryAction: "scope_expansion_required",
    };
  }

  private async handleOAuthRateLimit(
    userId: string,
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    logger.warn("OAuth rate limit hit, implementing backoff", { userId });

    try {
      const result = await RetryManager.executeWithRetry(
        operation,
        RETRY_CONFIGS.OAUTH,
        "oauth_rate_limit_recovery"
      );

      return {
        success: true,
        data: result.result,
        fallbackUsed: false,
        recoveryAction: `rate_limit_recovered_after_${result.attempts}_attempts`,
      };
    } catch (retryError) {
      return {
        success: false,
        fallbackUsed: false,
        error: retryError as BaseError,
        recoveryAction: "rate_limit_recovery_failed",
      };
    }
  }

  private async tryFallback<T>(
    error: BaseError,
    options: FallbackOptions
  ): Promise<ErrorRecoveryResult<T>> {
    logger.info("Attempting fallback recovery", {
      errorCode: error.code,
      options,
    });

    if (options.useCachedData) {
      const cachedData = await this.getCachedFallbackData(error);
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          fallbackUsed: true,
          recoveryAction: "cached_data_used",
        };
      }
    }

    if (options.useDefaultValues) {
      const defaultData = this.getDefaultFallbackData(error);
      if (defaultData) {
        return {
          success: true,
          data: defaultData,
          fallbackUsed: true,
          recoveryAction: "default_values_used",
        };
      }
    }

    if (options.skipOperation) {
      return {
        success: true,
        data: null,
        fallbackUsed: true,
        recoveryAction: "operation_skipped",
      };
    }

    return {
      success: false,
      fallbackUsed: false,
      error,
      recoveryAction: "no_fallback_available",
    };
  }

  private async getCachedFallbackData(error: BaseError): Promise<any> {
    // Implementation depends on error type and context
    // This is a placeholder for cached data retrieval
    return null;
  }

  private getDefaultFallbackData(error: BaseError): FallbackData {
    // Implementation depends on error type
    // This is a placeholder for default values
    return null;
  }

  private getRetryConfigForAPI(apiName: string) {
    switch (apiName.toLowerCase()) {
      case "gmail":
        return RETRY_CONFIGS.GMAIL_API;
      case "calendar":
        return RETRY_CONFIGS.CALENDAR_API;
      case "maps":
        return RETRY_CONFIGS.MAPS_API;
      case "weather":
        return RETRY_CONFIGS.WEATHER_API;
      default:
        return RETRY_CONFIGS.GMAIL_API; // Default config
    }
  }

  private async handleCorruptedPDF(
    pdfBuffer: Buffer,
    emailId: string
  ): Promise<ErrorRecoveryResult> {
    // Store for manual processing
    await this.cacheService.set(`corrupted_pdf:${emailId}`, pdfBuffer, {
      ttl: 86400,
    }); // 24 hours

    return {
      success: false,
      fallbackUsed: false,
      error: new PDFProcessingError(
        "PDF is corrupted and requires manual processing",
        ErrorCode.PDF_CORRUPTED,
        422,
        undefined,
        0,
        { emailId, manualProcessingRequired: true }
      ),
      recoveryAction: "manual_processing_queued",
    };
  }

  private async handleOCRFailure(
    pdfBuffer: Buffer,
    emailId: string
  ): Promise<ErrorRecoveryResult> {
    // Store for manual processing
    await this.cacheService.set(`ocr_failed_pdf:${emailId}`, pdfBuffer, {
      ttl: 86400,
    });

    return {
      success: false,
      fallbackUsed: false,
      error: new PDFProcessingError(
        "OCR processing failed, manual data entry required",
        ErrorCode.PDF_OCR_FAILED,
        422,
        undefined,
        0,
        { emailId, manualEntryRequired: true }
      ),
      recoveryAction: "manual_entry_required",
    };
  }

  private async handleInvalidPDFData(
    error: PDFProcessingError,
    emailId: string
  ): Promise<ErrorRecoveryResult> {
    return {
      success: false,
      fallbackUsed: false,
      error: new PDFProcessingError(
        "Extracted PDF data is invalid, manual correction required",
        ErrorCode.PDF_DATA_INVALID,
        422,
        error.pdfHash,
        error.confidenceScore,
        { emailId, manualCorrectionRequired: true }
      ),
      recoveryAction: "manual_correction_interface_available",
    };
  }

  private async handlePDFParseError(
    pdfBuffer: Buffer,
    emailId: string
  ): Promise<ErrorRecoveryResult> {
    // Try alternative parsing method or store for manual processing
    await this.cacheService.set(`parse_failed_pdf:${emailId}`, pdfBuffer, {
      ttl: 86400,
    });

    return {
      success: false,
      fallbackUsed: false,
      error: new PDFProcessingError(
        "PDF parsing failed, alternative processing required",
        ErrorCode.PDF_PARSE_ERROR,
        422,
        undefined,
        0,
        { emailId, alternativeProcessingRequired: true }
      ),
      recoveryAction: "alternative_processing_queued",
    };
  }

  private async handleConnectionError(
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    return await this.retryDatabaseOperation(operation);
  }

  private async handleTransactionError(
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    return await this.retryDatabaseOperation(operation);
  }

  private async handleTimeoutError(
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    return await this.retryDatabaseOperation(operation);
  }

  private async retryDatabaseOperation(
    operation: () => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    try {
      const result = await RetryManager.executeWithRetry(
        operation,
        RETRY_CONFIGS.DATABASE,
        "database_error_recovery"
      );

      return {
        success: true,
        data: result.result,
        fallbackUsed: false,
        recoveryAction: `database_retry_succeeded_after_${result.attempts}_attempts`,
      };
    } catch (retryError) {
      return {
        success: false,
        fallbackUsed: false,
        error: retryError as BaseError,
        recoveryAction: "database_retry_failed",
      };
    }
  }

  /**
   * Initialize metrics cleanup to prevent memory leaks
   */
  private initializeMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // 1 hour
  }

  /**
   * Clean up metrics older than 24 hours
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [key, metrics] of this.errorMetrics.entries()) {
      if (metrics.lastErrorTime < cutoffTime) {
        this.errorMetrics.delete(key);
      }
    }

    // Clean up old critical failures
    this.criticalFailures = this.criticalFailures.filter(
      (failure) => failure.failureTime > cutoffTime
    );

    structuredLogger.debug("Cleaned up old error metrics", {
      remainingMetrics: this.errorMetrics.size,
      remainingCriticalFailures: this.criticalFailures.length,
    });
  }

  /**
   * Record error metrics for monitoring
   */
  private recordErrorMetrics(
    serviceName: string,
    error: BaseError,
    recoveryTime?: number
  ): void {
    const key = `${serviceName}:${error.code}`;
    const existing = this.errorMetrics.get(key) || {
      errorCount: 0,
      errorRate: 0,
      lastErrorTime: new Date(),
      recoveryCount: 0,
      fallbackUsageCount: 0,
      averageRecoveryTime: 0,
    };

    existing.errorCount++;
    existing.lastErrorTime = new Date();

    if (recoveryTime) {
      existing.recoveryCount++;
      existing.averageRecoveryTime =
        (existing.averageRecoveryTime * (existing.recoveryCount - 1) +
          recoveryTime) /
        existing.recoveryCount;
    }

    this.errorMetrics.set(key, existing);

    // Check if this constitutes a critical failure
    this.evaluateCriticalFailure(serviceName, error, existing);
  }

  /**
   * Evaluate if an error constitutes a critical failure
   */
  private evaluateCriticalFailure(
    serviceName: string,
    error: BaseError,
    metrics: ErrorMetrics
  ): void {
    const criticalErrorCodes = [
      ErrorCode.DATABASE_CONNECTION_ERROR,
      ErrorCode.OAUTH_INVALID_GRANT,
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      ErrorCode.CIRCUIT_BREAKER_OPEN,
    ];

    const isCritical = criticalErrorCodes.includes(error.code);
    const highErrorRate = metrics.errorCount > 10; // More than 10 errors
    const recentErrors = metrics.lastErrorTime > new Date(Date.now() - 300000); // Within 5 minutes

    if (isCritical || (highErrorRate && recentErrors)) {
      const impact = this.determineFailureImpact(serviceName, error.code);
      const failure: CriticalServiceFailure = {
        serviceName,
        errorCode: error.code,
        failureTime: new Date(),
        impact,
        affectedOperations: this.getAffectedOperations(serviceName, error.code),
        estimatedRecoveryTime: this.estimateRecoveryTime(
          serviceName,
          error.code
        ),
      };

      this.criticalFailures.push(failure);
      this.handleCriticalFailure(failure);
    }
  }

  /**
   * Handle critical service failures with immediate notifications
   */
  private async handleCriticalFailure(
    failure: CriticalServiceFailure
  ): Promise<void> {
    structuredLogger.error("Critical service failure detected", {
      serviceName: failure.serviceName,
      errorCode: failure.errorCode,
      impact: failure.impact,
      affectedOperations: failure.affectedOperations,
    });

    // Send immediate notification for critical failures
    if (failure.impact === "critical" || failure.impact === "high") {
      try {
        await this.notificationService.sendSystemAlert({
          type: "critical_failure",
          serviceName: failure.serviceName,
          errorCode: failure.errorCode,
          impact: failure.impact,
          affectedOperations: failure.affectedOperations,
          estimatedRecoveryTime: failure.estimatedRecoveryTime,
          timestamp: failure.failureTime,
        });
      } catch (notificationError) {
        structuredLogger.error("Failed to send critical failure notification", {
          originalFailure: failure,
          notificationError:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }
    }
  }

  /**
   * Determine the impact level of a service failure
   */
  private determineFailureImpact(
    serviceName: string,
    errorCode: ErrorCode
  ): "low" | "medium" | "high" | "critical" {
    const criticalServices = ["database", "oauth", "gmail_api"];
    const highImpactErrors = [
      ErrorCode.DATABASE_CONNECTION_ERROR,
      ErrorCode.OAUTH_INVALID_GRANT,
      ErrorCode.CIRCUIT_BREAKER_OPEN,
    ];

    if (
      criticalServices.includes(serviceName.toLowerCase()) &&
      highImpactErrors.includes(errorCode)
    ) {
      return "critical";
    }

    if (criticalServices.includes(serviceName.toLowerCase())) {
      return "high";
    }

    if (highImpactErrors.includes(errorCode)) {
      return "high";
    }

    const mediumImpactErrors = [
      ErrorCode.API_RATE_LIMITED,
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      ErrorCode.PDF_PARSE_ERROR,
    ];

    if (mediumImpactErrors.includes(errorCode)) {
      return "medium";
    }

    return "low";
  }

  /**
   * Get operations affected by a service failure
   */
  private getAffectedOperations(
    serviceName: string,
    errorCode: ErrorCode
  ): string[] {
    const operationMap: Record<string, string[]> = {
      database: [
        "email_processing",
        "schedule_storage",
        "user_management",
        "calendar_events",
      ],
      oauth: ["gmail_access", "calendar_access", "user_authentication"],
      gmail_api: [
        "email_monitoring",
        "email_processing",
        "attachment_download",
      ],
      calendar_api: ["event_creation", "calendar_sync", "reminder_setup"],
      maps_api: [
        "route_calculation",
        "address_validation",
        "travel_time_estimation",
      ],
      weather_api: [
        "weather_forecasts",
        "weather_warnings",
        "outdoor_shoot_planning",
      ],
    };

    return operationMap[serviceName.toLowerCase()] || ["unknown_operations"];
  }

  /**
   * Estimate recovery time based on service and error type
   */
  private estimateRecoveryTime(
    serviceName: string,
    errorCode: ErrorCode
  ): number {
    const recoveryTimes: Record<string, number> = {
      [ErrorCode.DATABASE_CONNECTION_ERROR]: 300, // 5 minutes
      [ErrorCode.OAUTH_TOKEN_EXPIRED]: 60, // 1 minute
      [ErrorCode.OAUTH_INVALID_GRANT]: 0, // Requires manual intervention
      [ErrorCode.API_RATE_LIMITED]: 3600, // 1 hour
      [ErrorCode.CIRCUIT_BREAKER_OPEN]: 300, // 5 minutes
      [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 1800, // 30 minutes
    };

    return recoveryTimes[errorCode] || 600; // Default 10 minutes
  }

  /**
   * Get error metrics for monitoring
   */
  public getErrorMetrics(): Record<string, ErrorMetrics> {
    return Object.fromEntries(this.errorMetrics.entries());
  }

  /**
   * Get critical failures for monitoring
   */
  public getCriticalFailures(): CriticalServiceFailure[] {
    return [...this.criticalFailures];
  }

  /**
   * Enhanced fallback mechanism with intelligent data sources
   */
  private async tryAdvancedFallback<T>(
    error: BaseError,
    options: FallbackOptions,
    serviceName: string
  ): Promise<ErrorRecoveryResult<T>> {
    structuredLogger.info("Attempting advanced fallback recovery", {
      errorCode: error.code,
      serviceName,
      options,
    });

    // Record fallback usage
    const metricsKey = `${serviceName}:${error.code}`;
    const metrics = this.errorMetrics.get(metricsKey);
    if (metrics) {
      metrics.fallbackUsageCount++;
      this.errorMetrics.set(metricsKey, metrics);
    }

    // Try cached data first
    if (options.useCachedData && options.cacheKey) {
      const cachedData = await this.getAdvancedCachedData<T>(
        options.cacheKey,
        serviceName
      );
      if (cachedData) {
        structuredLogger.info("Fallback using cached data", {
          serviceName,
          cacheKey: options.cacheKey,
        });

        return {
          success: true,
          data: cachedData,
          fallbackUsed: true,
          recoveryAction: "advanced_cached_data_used",
        };
      }
    }

    // Try provided fallback data
    if (options.fallbackData) {
      structuredLogger.info("Fallback using provided data", { serviceName });

      return {
        success: true,
        data: options.fallbackData,
        fallbackUsed: true,
        recoveryAction: "provided_fallback_data_used",
      };
    }

    // Try graceful degradation
    if (options.gracefulDegradation) {
      const degradedData = await this.getGracefulDegradationData<T>(
        serviceName,
        error.code
      );
      if (degradedData) {
        structuredLogger.info("Fallback using graceful degradation", {
          serviceName,
        });

        return {
          success: true,
          data: degradedData,
          fallbackUsed: true,
          recoveryAction: "graceful_degradation_applied",
        };
      }
    }

    // Try alternative service
    if (options.alternativeService) {
      try {
        const alternativeData = await this.tryAlternativeService<T>(
          options.alternativeService,
          serviceName,
          error
        );

        if (alternativeData) {
          structuredLogger.info("Fallback using alternative service", {
            originalService: serviceName,
            alternativeService: options.alternativeService,
          });

          return {
            success: true,
            data: alternativeData,
            fallbackUsed: true,
            recoveryAction: `alternative_service_used:${options.alternativeService}`,
          };
        }
      } catch (alternativeError) {
        structuredLogger.warn("Alternative service also failed", {
          originalService: serviceName,
          alternativeService: options.alternativeService,
          alternativeError:
            alternativeError instanceof Error
              ? alternativeError.message
              : String(alternativeError),
        });
      }
    }

    // Skip operation if requested
    if (options.skipOperation) {
      structuredLogger.info("Fallback by skipping operation", { serviceName });

      return {
        success: true,
        data: null,
        fallbackUsed: true,
        recoveryAction: "operation_skipped",
      };
    }

    // No fallback available
    return {
      success: false,
      fallbackUsed: false,
      error,
      recoveryAction: "no_advanced_fallback_available",
    };
  }

  /**
   * Get advanced cached data with intelligent cache strategies
   */
  private async getAdvancedCachedData<T>(
    cacheKey: string,
    serviceName: string
  ): Promise<T | null> {
    try {
      // Try primary cache
      let cachedData = await this.cacheService.get<T>(cacheKey);

      if (cachedData) {
        return cachedData;
      }

      // Try backup cache keys
      const backupKeys = [
        `${cacheKey}:backup`,
        `${cacheKey}:fallback`,
        `${serviceName}:last_known_good`,
      ];

      for (const backupKey of backupKeys) {
        cachedData = await this.cacheService.get<T>(backupKey);
        if (cachedData) {
          structuredLogger.debug("Using backup cache data", {
            originalKey: cacheKey,
            backupKey,
            serviceName,
          });
          return cachedData;
        }
      }

      return null;
    } catch (cacheError) {
      structuredLogger.warn("Cache access failed during fallback", {
        cacheKey,
        serviceName,
        error:
          cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
      return null;
    }
  }

  /**
   * Get graceful degradation data based on service and error
   */
  private async getGracefulDegradationData<T>(
    serviceName: string,
    errorCode: ErrorCode
  ): Promise<T | null> {
    const degradationStrategies: Record<
      string,
      Record<ErrorCode, () => Promise<any>>
    > = {
      weather_api: {
        [ErrorCode.WEATHER_API_ERROR]: async () => ({
          temperature: null,
          description: "Weather data unavailable",
          warnings: [
            "Weather service temporarily unavailable - check conditions manually",
          ],
          fallback: true,
        }),
        [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: async () => ({
          temperature: 15, // Reasonable default
          description: "Mild conditions (estimated)",
          warnings: ["Weather data unavailable - using estimated conditions"],
          fallback: true,
        }),
      },
      maps_api: {
        [ErrorCode.MAPS_API_ERROR]: async () => ({
          duration: 3600, // 1 hour default
          distance: 30000, // 30km default
          route: "Route calculation unavailable - using estimated times",
          fallback: true,
        }),
        [ErrorCode.API_RATE_LIMITED]: async () => ({
          duration: 3600,
          distance: 30000,
          route: "Using cached route estimates due to rate limiting",
          fallback: true,
        }),
      },
    };

    const serviceStrategies = degradationStrategies[serviceName.toLowerCase()];
    if (serviceStrategies && serviceStrategies[errorCode]) {
      try {
        return await serviceStrategies[errorCode]();
      } catch (degradationError) {
        structuredLogger.warn("Graceful degradation failed", {
          serviceName,
          errorCode,
          degradationError:
            degradationError instanceof Error
              ? degradationError.message
              : String(degradationError),
        });
      }
    }

    return null;
  }

  /**
   * Try alternative service implementation
   */
  private async tryAlternativeService<T>(
    alternativeService: string,
    originalService: string,
    error: BaseError
  ): Promise<T | null> {
    // This would be implemented based on available alternative services
    // For now, return null as no alternatives are configured
    structuredLogger.debug("Alternative service not implemented", {
      alternativeService,
      originalService,
      errorCode: error.code,
    });

    return null;
  }

  /**
   * Get comprehensive error metrics for monitoring
   */
  public getErrorMetrics(): Record<string, ErrorMetrics> {
    const metrics: Record<string, ErrorMetrics> = {};

    for (const [key, value] of this.errorMetrics.entries()) {
      metrics[key] = { ...value };
    }

    return metrics;
  }

  /**
   * Get current critical failures
   */
  public getCriticalFailures(): CriticalServiceFailure[] {
    return [...this.criticalFailures];
  }

  /**
   * Reset error metrics (for testing or manual reset)
   */
  public resetErrorMetrics(): void {
    this.errorMetrics.clear();
    this.criticalFailures = [];
    structuredLogger.info("Error metrics reset");
  }

  /**
   * Enhanced error handling with comprehensive recovery
   */
  public async handleErrorWithRecovery<T>(
    error: BaseError,
    operation: () => Promise<T>,
    serviceName: string,
    fallbackOptions: FallbackOptions = {}
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();

    structuredLogger.warn("Handling error with comprehensive recovery", {
      serviceName,
      errorCode: error.code,
      errorMessage: error.message,
    });

    try {
      // Record error metrics
      this.recordErrorMetrics(serviceName, error);

      // Determine recovery strategy based on error type
      let result: ErrorRecoveryResult<T>;

      if (error instanceof OAuthError) {
        result = await this.handleOAuthError(
          error,
          error.context?.userId || "unknown",
          operation
        );
      } else if (error instanceof APIError) {
        result = await this.handleAPIFailure(error, operation, fallbackOptions);
      } else if (error instanceof PDFProcessingError) {
        result = await this.handlePDFProcessingError(
          error,
          Buffer.alloc(0),
          error.context?.emailId || "unknown"
        );
      } else if (error instanceof DatabaseError) {
        result = await this.handleDatabaseError(error, operation);
      } else {
        // Try advanced fallback for other errors
        result = await this.tryAdvancedFallback<T>(
          error,
          fallbackOptions,
          serviceName
        );
      }

      const recoveryTime = Date.now() - startTime;

      if (result.success) {
        this.recordErrorMetrics(serviceName, error, recoveryTime);
        structuredLogger.info("Error recovery successful", {
          serviceName,
          errorCode: error.code,
          recoveryAction: result.recoveryAction,
          recoveryTime,
          fallbackUsed: result.fallbackUsed,
        });
      } else {
        structuredLogger.error("Error recovery failed", {
          serviceName,
          errorCode: error.code,
          recoveryAction: result.recoveryAction,
          recoveryTime,
        });
      }

      return result;
    } catch (recoveryError) {
      const recoveryTime = Date.now() - startTime;

      structuredLogger.error("Error recovery process failed", {
        serviceName,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
        recoveryTime,
      });

      return {
        success: false,
        fallbackUsed: false,
        error: recoveryError as BaseError,
        recoveryAction: "recovery_process_failed",
      };
    }
  }
}
