import winston from "winston";
import { config } from "@/config/config";
import { BaseError } from "./errors";

// Custom log levels for StillOnTime application
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue",
    trace: "gray",
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Enhanced log format with structured data
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "service"],
  }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      log += `\n  ${JSON.stringify(metadata, null, 2)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Create the main logger
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: config.nodeEnv === "production" ? "info" : "debug",
  format: logFormat,
  defaultMeta: {
    service: "stillontime-backend",
    environment: config.nodeEnv,
    version: process.env.npm_package_version || "1.0.0",
  },
  transports: [
    // Error log file - only errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Combined log file - all levels
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
    }),

    // HTTP access log
    new winston.transports.File({
      filename: "logs/access.log",
      level: "http",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: "logs/exceptions.log" }),
  ],

  rejectionHandlers: [
    new winston.transports.File({ filename: "logs/rejections.log" }),
  ],
});

// Add console transport for non-production environments
if (config.nodeEnv !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: "trace",
    })
  );
}

// Enhanced logging interface with structured data support
export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private static instance: StructuredLogger;
  private requestId: string | null = null;

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  clearRequestId(): void {
    this.requestId = null;
  }

  private enrichContext(context: LogContext = {}): LogContext {
    const enriched = { ...context };

    if (this.requestId) {
      enriched.requestId = this.requestId;
    }

    enriched.timestamp = new Date().toISOString();
    enriched.pid = process.pid;

    return enriched;
  }

  error(
    message: string,
    context: LogContext = {},
    error?: Error | BaseError
  ): void {
    const enrichedContext = this.enrichContext(context);

    if (error) {
      enrichedContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof BaseError && {
          code: error.code,
          statusCode: error.statusCode,
          isOperational: error.isOperational,
          context: error.context,
        }),
      };
    }

    logger.error(message, enrichedContext);
  }

  warn(message: string, context: LogContext = {}): void {
    logger.warn(message, this.enrichContext(context));
  }

  info(message: string, context: LogContext = {}): void {
    logger.info(message, this.enrichContext(context));
  }

  http(message: string, context: LogContext = {}): void {
    logger.http(message, this.enrichContext(context));
  }

  debug(message: string, context: LogContext = {}): void {
    logger.debug(message, this.enrichContext(context));
  }

  trace(message: string, context: LogContext = {}): void {
    logger.log("trace", message, this.enrichContext(context));
  }

  // OAuth-specific logging
  oauthFlow(action: string, context: LogContext = {}): void {
    this.info(`OAuth: ${action}`, {
      ...context,
      category: "oauth",
      action,
    });
  }

  // API call logging
  apiCall(apiName: string, action: string, context: LogContext = {}): void {
    this.info(`API Call: ${apiName} - ${action}`, {
      ...context,
      category: "api_call",
      apiName,
      action,
    });
  }

  // Database operation logging
  dbOperation(
    operation: string,
    table: string,
    context: LogContext = {}
  ): void {
    this.debug(`DB: ${operation} on ${table}`, {
      ...context,
      category: "database",
      operation,
      table,
    });
  }

  // Performance logging
  performance(
    operation: string,
    duration: number,
    context: LogContext = {}
  ): void {
    const level = duration > 5000 ? "warn" : duration > 1000 ? "info" : "debug";

    logger[level](`Performance: ${operation} took ${duration}ms`, {
      ...this.enrichContext(context),
      category: "performance",
      operation,
      duration,
    });
  }

  // Security logging
  security(event: string, context: LogContext = {}): void {
    this.warn(`Security: ${event}`, {
      ...context,
      category: "security",
      event,
    });
  }

  // Business logic logging
  business(event: string, context: LogContext = {}): void {
    this.info(`Business: ${event}`, {
      ...context,
      category: "business",
      event,
    });
  }
}

// Export singleton instance
export const structuredLogger = StructuredLogger.getInstance();

// Export original logger for backward compatibility
export default logger;
