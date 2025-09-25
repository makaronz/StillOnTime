import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { errorHandler } from "@/middleware/errorHandler";
import { logger } from "@/utils/logger";
import { config } from "@/config/config";
import { initializeDatabase, checkDatabaseConnection } from "@/config/database";
import { initializeRedis, checkRedisConnection } from "@/config/redis";

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

// Health check endpoint
app.get("/health", async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const redisHealthy = await checkRedisConnection();

  const allHealthy = dbHealthy && redisHealthy;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "OK" : "Service Unavailable",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealthy,
      redis: redisHealthy,
    },
  });
});

// API routes will be added here
app.get("/api", (req, res) => {
  res.json({
    message: "StillOnTime Film Schedule Automation API",
    version: "1.0.0",
    status: "running",
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found",
    path: req.originalUrl,
  });
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
      logger.info(`StillOnTime Backend API server running on port ${PORT}`, {
        port: PORT,
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
