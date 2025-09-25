/**
 * Comprehensive error handling service
 * Coordinates error recovery, logging, and fallback mechanisms
 */

import { logger } from "../utils/logger";
import {
  BaseError,
  OAuthError,
  APIError,
  PDFProcessingError,
  DatabaseError,
  SystemError,
  ErrorCode,
} from "../utils/errors";
import { CircuitBreakerRegistry } from "../utils/circuit-breaker";
import { RetryManager, RETRY_CONFIGS } from "../utils/retry";
import { OAuth2Service } from "./oauth2.service";
import { CacheService } from "./cache.service";

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
}

export class ErrorHandlerService {
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private oauth2Service: OAuth2Service;
  private cacheService: CacheService;

  constructor(oauth2Service: OAuth2Service, cacheService: CacheService) {
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.oauth2Service = oauth2Service;
    this.cacheService = cacheService;
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

  private getDefaultFallbackData(error: BaseError): any {
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
}
