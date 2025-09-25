import { createClient } from "redis";
import { config } from "./config";

/**
 * Redis Client Configuration and Management
 */

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;

/**
 * Create and configure Redis client
 */
export const createRedisClient = (): RedisClient => {
  const client = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 5000,
    },
  });

  // Error handling
  client.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  client.on("connect", () => {
    console.log("✅ Redis client connected");
  });

  client.on("ready", () => {
    console.log("✅ Redis client ready");
  });

  client.on("end", () => {
    console.log("❌ Redis client connection ended");
  });

  return client;
};

/**
 * Get Redis client instance (singleton)
 */
export const getRedisClient = async (): Promise<RedisClient> => {
  if (!redisClient) {
    redisClient = createRedisClient();
    await redisClient.connect();
  }
  return redisClient;
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<void> => {
  try {
    const client = await getRedisClient();

    // Test connection with ping
    const pong = await client.ping();
    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }

    console.log("✅ Redis initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error);
    throw error;
  }
};

/**
 * Check Redis connection health
 */
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    if (!redisClient) {
      return false;
    }

    const pong = await redisClient.ping();
    return pong === "PONG";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
};

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("✅ Redis connection closed");
  }
};

// Graceful shutdown handlers
process.on("SIGINT", async () => {
  await closeRedisConnection();
});

process.on("SIGTERM", async () => {
  await closeRedisConnection();
});

process.on("beforeExit", async () => {
  await closeRedisConnection();
});
