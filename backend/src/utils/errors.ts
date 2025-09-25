/**
 * Custom error classes for StillOnTime application
 * Provides structured error handling with proper inheritance
 */

export enum ErrorCode {
  // OAuth 2.0 Errors
  OAUTH_TOKEN_EXPIRED = "OAUTH_TOKEN_EXPIRED",
  OAUTH_INVALID_GRANT = "OAUTH_INVALID_GRANT",
  OAUTH_INSUFFICIENT_SCOPE = "OAUTH_INSUFFICIENT_SCOPE",
  OAUTH_RATE_LIMITED = "OAUTH_RATE_LIMITED",

  // API Errors
  GMAIL_API_ERROR = "GMAIL_API_ERROR",
  CALENDAR_API_ERROR = "CALENDAR_API_ERROR",
  MAPS_API_ERROR = "MAPS_API_ERROR",
  WEATHER_API_ERROR = "WEATHER_API_ERROR",
  API_RATE_LIMITED = "API_RATE_LIMITED",
  API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",

  // PDF Processing Errors
  PDF_PARSE_ERROR = "PDF_PARSE_ERROR",
  PDF_CORRUPTED = "PDF_CORRUPTED",
  PDF_OCR_FAILED = "PDF_OCR_FAILED",
  PDF_DATA_INVALID = "PDF_DATA_INVALID",

  // Database Errors
  DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR",
  DATABASE_TRANSACTION_ERROR = "DATABASE_TRANSACTION_ERROR",
  DATABASE_CONSTRAINT_ERROR = "DATABASE_CONSTRAINT_ERROR",
  DATABASE_TIMEOUT_ERROR = "DATABASE_TIMEOUT_ERROR",

  // Business Logic Errors
  SCHEDULE_DATA_INVALID = "SCHEDULE_DATA_INVALID",
  ROUTE_CALCULATION_FAILED = "ROUTE_CALCULATION_FAILED",
  WEATHER_DATA_UNAVAILABLE = "WEATHER_DATA_UNAVAILABLE",
  CALENDAR_CONFLICT = "CALENDAR_CONFLICT",

  // System Errors
  EXTERNAL_SERVICE_UNAVAILABLE = "EXTERNAL_SERVICE_UNAVAILABLE",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
  RETRY_LIMIT_EXCEEDED = "RETRY_LIMIT_EXCEEDED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

export class OAuthError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 401,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
  }
}

export class APIError extends BaseError {
  public readonly apiName: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    apiName: string,
    statusCode: number = 502,
    retryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
    this.apiName = apiName;
    this.retryable = retryable;
  }
}

export class PDFProcessingError extends BaseError {
  public readonly pdfHash?: string;
  public readonly confidenceScore?: number;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 422,
    pdfHash?: string,
    confidenceScore?: number,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
    this.pdfHash = pdfHash;
    this.confidenceScore = confidenceScore;
  }
}

export class DatabaseError extends BaseError {
  public readonly operation: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    operation: string,
    statusCode: number = 500,
    retryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
    this.operation = operation;
    this.retryable = retryable;
  }
}

export class BusinessLogicError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
  }
}

export class SystemError extends BaseError {
  public readonly serviceName: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    serviceName: string,
    statusCode: number = 503,
    retryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
    this.serviceName = serviceName;
    this.retryable = retryable;
  }
}
