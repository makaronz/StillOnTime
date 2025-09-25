/**
 * Tests for comprehensive error handling service
 */

import { ErrorHandlerService } from "../../src/services/error-handler.service";
import {
  OAuthError,
  APIError,
  PDFProcessingError,
  DatabaseError,
  ErrorCode,
} from "../../src/utils/errors";
import { OAuth2Service } from "../../src/services/oauth2.service";
import { CacheService } from "../../src/services/cache.service";

// Mock dependencies
jest.mock("../../src/services/oauth2.service");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/utils/logger");

describe("ErrorHandlerService", () => {
  let errorHandlerService: ErrorHandlerService;
  let mockOAuth2Service: jest.Mocked<OAuth2Service>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockOAuth2Service = {
      getGoogleClient: jest.fn(),
      revokeTokens: jest.fn(),
    } as any;
    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as any;
    errorHandlerService = new ErrorHandlerService(
      mockOAuth2Service,
      mockCacheService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleOAuthError", () => {
    const userId = "test-user-id";
    const mockOperation = jest.fn();

    beforeEach(() => {
      mockOperation.mockClear();
    });

    it("should handle token expiration with successful refresh", async () => {
      const error = new OAuthError(
        "Token expired",
        ErrorCode.OAUTH_TOKEN_EXPIRED,
        401,
        { userId }
      );

      mockOAuth2Service.getGoogleClient.mockResolvedValue({} as any);
      mockOperation.mockResolvedValue({ success: true });

      const result = await errorHandlerService.handleOAuthError(
        error,
        userId,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.recoveryAction).toBe("token_refreshed");
      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(mockOperation).toHaveBeenCalled();
    });

    it("should handle token expiration with failed refresh", async () => {
      const error = new OAuthError(
        "Token expired",
        ErrorCode.OAUTH_TOKEN_EXPIRED,
        401,
        { userId }
      );

      mockOAuth2Service.getGoogleClient.mockRejectedValue(
        new Error("Refresh failed")
      );

      const result = await errorHandlerService.handleOAuthError(
        error,
        userId,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(false);
      expect(result.recoveryAction).toBe("reauthorization_required");
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should handle invalid grant error", async () => {
      const error = new OAuthError(
        "Invalid grant",
        ErrorCode.OAUTH_INVALID_GRANT,
        401,
        { userId }
      );

      mockOAuth2Service.revokeTokens.mockResolvedValue(undefined);

      const result = await errorHandlerService.handleOAuthError(
        error,
        userId,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("reauthorization_required");
      expect(mockOAuth2Service.revokeTokens).toHaveBeenCalledWith(userId);
    });

    it("should handle insufficient scope error", async () => {
      const error = new OAuthError(
        "Insufficient scope",
        ErrorCode.OAUTH_INSUFFICIENT_SCOPE,
        403,
        { userId, requiredScopes: ["calendar"] }
      );

      const result = await errorHandlerService.handleOAuthError(
        error,
        userId,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("scope_expansion_required");
    });

    it("should handle rate limit error with retry", async () => {
      const error = new OAuthError(
        "Rate limited",
        ErrorCode.OAUTH_RATE_LIMITED,
        429,
        { userId }
      );

      mockOperation.mockResolvedValueOnce({ success: true });

      const result = await errorHandlerService.handleOAuthError(
        error,
        userId,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.recoveryAction).toContain("rate_limit_recovered_after");
    });
  });

  describe("handleAPIFailure", () => {
    const mockOperation = jest.fn();

    beforeEach(() => {
      mockOperation.mockClear();
    });

    it("should retry retryable API errors", async () => {
      const error = new APIError(
        "Service unavailable",
        ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        "gmail",
        503,
        true
      );

      mockOperation.mockResolvedValueOnce({ data: "success" });

      const result = await errorHandlerService.handleAPIFailure(
        error,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.recoveryAction).toContain("retry_succeeded_after");
    });

    it("should use fallback for non-retryable errors", async () => {
      const error = new APIError(
        "Bad request",
        ErrorCode.VALIDATION_ERROR,
        "gmail",
        400,
        false
      );

      const result = await errorHandlerService.handleAPIFailure(
        error,
        mockOperation,
        { skipOperation: true }
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.recoveryAction).toBe("operation_skipped");
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should handle circuit breaker open state", async () => {
      const error = new APIError(
        "Circuit breaker open",
        ErrorCode.CIRCUIT_BREAKER_OPEN,
        "gmail",
        503,
        true
      );

      const result = await errorHandlerService.handleAPIFailure(
        error,
        mockOperation,
        { useDefaultValues: true }
      );

      expect(result.fallbackUsed).toBe(true);
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe("handlePDFProcessingError", () => {
    const pdfBuffer = Buffer.from("test pdf content");
    const emailId = "test-email-id";

    it("should handle corrupted PDF error", async () => {
      const error = new PDFProcessingError(
        "PDF is corrupted",
        ErrorCode.PDF_CORRUPTED,
        422,
        "test-hash"
      );

      mockCacheService.set.mockResolvedValue(undefined);

      const result = await errorHandlerService.handlePDFProcessingError(
        error,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("manual_processing_queued");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `corrupted_pdf:${emailId}`,
        pdfBuffer,
        86400
      );
    });

    it("should handle OCR failure error", async () => {
      const error = new PDFProcessingError(
        "OCR failed",
        ErrorCode.PDF_OCR_FAILED,
        422,
        "test-hash",
        0.1
      );

      mockCacheService.set.mockResolvedValue(undefined);

      const result = await errorHandlerService.handlePDFProcessingError(
        error,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("manual_entry_required");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `ocr_failed_pdf:${emailId}`,
        pdfBuffer,
        86400
      );
    });

    it("should handle invalid PDF data error", async () => {
      const error = new PDFProcessingError(
        "Invalid data extracted",
        ErrorCode.PDF_DATA_INVALID,
        422,
        "test-hash",
        0.3
      );

      const result = await errorHandlerService.handlePDFProcessingError(
        error,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe(
        "manual_correction_interface_available"
      );
    });

    it("should handle PDF parse error", async () => {
      const error = new PDFProcessingError(
        "Parse failed",
        ErrorCode.PDF_PARSE_ERROR,
        422,
        "test-hash"
      );

      mockCacheService.set.mockResolvedValue(undefined);

      const result = await errorHandlerService.handlePDFProcessingError(
        error,
        pdfBuffer,
        emailId
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe("alternative_processing_queued");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `parse_failed_pdf:${emailId}`,
        pdfBuffer,
        86400
      );
    });
  });

  describe("handleDatabaseError", () => {
    const mockOperation = jest.fn();

    beforeEach(() => {
      mockOperation.mockClear();
    });

    it("should retry retryable database errors", async () => {
      const error = new DatabaseError(
        "Connection timeout",
        ErrorCode.DATABASE_TIMEOUT_ERROR,
        "user_query",
        500,
        true
      );

      mockOperation.mockResolvedValueOnce({ success: true });

      const result = await errorHandlerService.handleDatabaseError(
        error,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.recoveryAction).toContain("database_retry_succeeded_after");
    });

    it("should not retry constraint errors", async () => {
      const error = new DatabaseError(
        "Constraint violation",
        ErrorCode.DATABASE_CONSTRAINT_ERROR,
        "user_insert",
        400,
        false
      );

      const result = await errorHandlerService.handleDatabaseError(
        error,
        mockOperation
      );

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe(
        "constraint_violation_manual_fix_required"
      );
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should handle connection errors with retry", async () => {
      const error = new DatabaseError(
        "Connection failed",
        ErrorCode.DATABASE_CONNECTION_ERROR,
        "connection",
        500,
        true
      );

      mockOperation.mockResolvedValueOnce({ success: true });

      const result = await errorHandlerService.handleDatabaseError(
        error,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.recoveryAction).toContain("database_retry_succeeded_after");
    });

    it("should handle transaction errors with retry", async () => {
      const error = new DatabaseError(
        "Transaction failed",
        ErrorCode.DATABASE_TRANSACTION_ERROR,
        "transaction",
        500,
        true
      );

      mockOperation.mockResolvedValueOnce({ success: true });

      const result = await errorHandlerService.handleDatabaseError(
        error,
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.recoveryAction).toContain("database_retry_succeeded_after");
    });
  });
});
