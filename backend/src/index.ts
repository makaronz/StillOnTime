import express, { Response, NextFunction } from "express";
import { AppRequest } from "@/types/requests";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import { helmetConfig, corsConfig, securityConfig } from "@/config/security";

import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { logger, structuredLogger } from "@/utils/logger";
import { config } from "@/config/config";
import { initializeDatabase, checkDatabaseConnection } from "@/config/database";
import { initializeRedis, checkRedisConnection } from "@/config/redis";
import { apiRoutes } from "@/routes";
import healthRoutes from "@/routes/health.routes";

// Load environment variables
dotenv.config();

const app: express.Application = express();
const PORT = config.port || 3001;

// Enhanced security middleware
app.use(helmet(helmetConfig));
app.use(cors(corsConfig));

// Global rate limiting with enhanced security
const globalLimiter = rateLimit({
  windowMs: securityConfig.rateLimiting.global.windowMs,
  max: securityConfig.rateLimiting.global.max,
  message: {
    error: "Too Many Requests",
    message: "Too many requests from this IP, please try again later.",
    code: "GLOBAL_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req: any) => req.path === "/health" || req.path.startsWith("/health/"),
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimiting.auth.windowMs,
  max: securityConfig.rateLimiting.auth.max,
  message: {
    error: "Too Many Requests",
    message:
      "Too many authentication requests from this IP, please try again later.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use("/api/auth", authLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CSRF Protection middleware
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    key: "_csrf",
  },
});

// Apply CSRF protection to all routes except health checks and OAuth callback
app.use((req: any, res: Response, next: NextFunction) => {
  // Skip CSRF for health checks, OAuth callbacks, GET requests, and development API calls
  if (
    req.path === "/health" ||
    req.path.startsWith("/health/") ||
    req.path === "/api/auth/callback" ||
    req.method === "GET" ||
    (config.nodeEnv === "development" && req.path.startsWith("/api/"))
  ) {
    return next();
  }

  // Apply CSRF protection
  (csrfProtection as any)(req, res, next);
});

// CSRF token endpoint - provides token to frontend
app.get("/api/csrf-token", (req: any, res: Response, next: NextFunction) => {
  (csrfProtection as any)(req, res, (err: any) => {
    if (err) return next(err);
    res.json({ csrfToken: (req as any).csrfToken() });
  });
});

// Middleware to set CSRF token in cookie for frontend
app.use((req: any, res: Response, next: NextFunction) => {
  if (req.csrfToken) {
    res.cookie("XSRF-TOKEN", req.csrfToken(), {
      httpOnly: false, // Frontend needs to read this
      secure: config.nodeEnv === "production",
      sameSite: "strict",
    });
  }
  next();
});

// Request ID middleware for tracing
app.use((req: any, res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  structuredLogger.setRequestId(requestId);

  // Log incoming request
  structuredLogger.http("Incoming request", {
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  });

  next();
});

// Health check routes
app.use("/health", healthRoutes);

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req: any, res: Response, next: NextFunction) => {
  notFoundHandler(req, res, next);
});

// Error handling middleware (must be last)
app.use((error: any, req: any, res: Response, next: NextFunction) => {
  errorHandler(error, req, res, next);
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Initialize Redis connection
    await initializeRedis();

    // Start server
    app.listen(PORT, () => {
      structuredLogger.info(
        `StillOnTime Backend API server running on port ${PORT}`,
        {
          port: PORT,
          environment: config.nodeEnv,
          timestamp: new Date().toISOString(),
          category: "startup",
        }
      );
    });
  } catch (error) {
    structuredLogger.error(
      "Failed to start server",
      {
        category: "startup",
        fatal: true,
      },
      error as Error
    );
    process.exit(1);
  }
}

startServer();

export default app;
