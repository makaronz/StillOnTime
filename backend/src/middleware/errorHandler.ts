import { Request, Response, NextFunction } from "express";
import { logger, structuredLogger } from "@/utils/logger";
import {
  BaseError,
  OAuthError,
  APIError,
  PDFProcessingError,
  DatabaseError,
  BusinessLogicError,
  SystemError,
  ErrorCode,
} from "@/utils/errors";

export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: Record<string, any>;
  recoveryActions?: string[];
}

// Legacy AppError for backward compatibility
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | BaseError | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = (req.headers["x-request-id"] as string) || "unknown";
  const userId = (req as any).user?.id;

  // Set request ID for structured logging
  structuredLogger.setRequestId(requestId);

  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: Record<string, any> = {};
  let recoveryActions: string[] = [];

  // Handle different error types
  if (error instanceof BaseError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.context || {};

    // Add specific recovery actions based on error type
    recoveryActions = getRecoveryActions(error);

    // Log with appropriate level based on error type
    if (error.isOperational) {
      structuredLogger.warn("Operational error occurred", {
        userId,
        path: req.path,
        method: req.method,
        statusCode,
        code,
        isOperational: true,
        errorType: error.constructor.name,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
    } else {
      structuredLogger.error(
        "System error occurred",
        {
          userId,
          path: req.path,
          method: req.method,
          statusCode,
          code,
          isOperational: false,
          errorType: error.constructor.name,
        },
        error
      );
    }
  } else if (error instanceof AppError) {
    // Handle legacy AppError
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;

    structuredLogger.warn("Legacy app error occurred", {
      userId,
      path: req.path,
      method: req.method,
      statusCode,
      code,
      errorType: "AppError",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  } else {
    // Handle unexpected errors
    structuredLogger.error(
      "Unexpected error occurred",
      {
        userId,
        path: req.path,
        method: req.method,
        statusCode: 500,
        code: "UNEXPECTED_ERROR",
        errorType: error.constructor.name,
      },
      error
    );

    // Don't expose internal error details in production
    if (process.env.NODE_ENV === "production") {
      message = "An unexpected error occurred";
    } else {
      message = error.message;
    }
  }

  // Handle specific error scenarios
  if (isAuthenticationError(error)) {
    statusCode = 401;
    recoveryActions.push("reauthenticate");
  } else if (isAuthorizationError(error)) {
    statusCode = 403;
    recoveryActions.push("check_permissions");
  } else if (isValidationError(error)) {
    statusCode = 400;
    recoveryActions.push("validate_input");
  } else if (isRateLimitError(error)) {
    statusCode = 429;
    recoveryActions.push("retry_after_delay");

    // Add Retry-After header
    res.set("Retry-After", "60");
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: error.name || "Error",
    message,
    code,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId,
  };

  // Add details in development or for operational errors
  if (
    process.env.NODE_ENV !== "production" ||
    (error instanceof BaseError && error.isOperational)
  ) {
    if (Object.keys(details).length > 0) {
      errorResponse.details = details;
    }

    if (recoveryActions.length > 0) {
      errorResponse.recoveryActions = recoveryActions;
    }
  }

  // Clear request ID after logging
  structuredLogger.clearRequestId();

  res.status(statusCode).json(errorResponse);
};

// Helper functions for error classification
function getRecoveryActions(error: BaseError): string[] {
  const actions: string[] = [];

  if (error instanceof OAuthError) {
    switch (error.code) {
      case ErrorCode.OAUTH_TOKEN_EXPIRED:
        actions.push("refresh_token", "retry_request");
        break;
      case ErrorCode.OAUTH_INVALID_GRANT:
        actions.push("reauthenticate");
        break;
      case ErrorCode.OAUTH_INSUFFICIENT_SCOPE:
        actions.push("request_additional_permissions");
        break;
      case ErrorCode.OAUTH_RATE_LIMITED:
        actions.push("wait_and_retry");
        break;
    }
  } else if (error instanceof APIError) {
    if (error.retryable) {
      actions.push("retry_with_backoff");
    }
    actions.push("check_service_status");
  } else if (error instanceof PDFProcessingError) {
    switch (error.code) {
      case ErrorCode.PDF_CORRUPTED:
        actions.push("manual_processing_required");
        break;
      case ErrorCode.PDF_OCR_FAILED:
        actions.push("manual_data_entry");
        break;
      case ErrorCode.PDF_DATA_INVALID:
        actions.push("manual_correction");
        break;
    }
  } else if (error instanceof DatabaseError) {
    if (error.retryable) {
      actions.push("retry_operation");
    }
    actions.push("check_database_status");
  } else if (error instanceof SystemError) {
    if (error.retryable) {
      actions.push("retry_after_delay");
    }
    actions.push("check_system_health");
  }

  return actions;
}

function isAuthenticationError(error: Error): boolean {
  return (
    error instanceof OAuthError &&
    [ErrorCode.OAUTH_TOKEN_EXPIRED, ErrorCode.OAUTH_INVALID_GRANT].includes(
      error.code
    )
  );
}

function isAuthorizationError(error: Error): boolean {
  return (
    error instanceof OAuthError &&
    error.code === ErrorCode.OAUTH_INSUFFICIENT_SCOPE
  );
}

function isValidationError(error: Error): boolean {
  return (
    error instanceof BusinessLogicError &&
    error.code === ErrorCode.VALIDATION_ERROR
  );
}

function isRateLimitError(error: Error): boolean {
  return (
    (error instanceof OAuthError &&
      error.code === ErrorCode.OAUTH_RATE_LIMITED) ||
    (error instanceof APIError && error.code === ErrorCode.API_RATE_LIMITED)
  );
}

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new BusinessLogicError(
    `Route ${req.originalUrl} not found`,
    ErrorCode.VALIDATION_ERROR,
    404,
    {
      path: req.originalUrl,
      method: req.method,
    }
  );

  next(error);
};
