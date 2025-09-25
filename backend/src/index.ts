import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { logger, structuredLogger } from "@/utils/logger";
import { config } from "@/config/config";
import { initializeDatabase, checkDatabaseConnection } from "@/config/database";
import { initializeRedis, checkRedisConnection } from "@/config/redis";
import { apiRoutes } from "@/routes";
import healthRoutes from "@/routes/health.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.port || 3001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware for tracing
app.use((req, res, next) => {
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
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

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
