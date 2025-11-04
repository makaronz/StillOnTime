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
  // In development mode, return mock client if Redis is not available
  if (config.nodeEnv === "development") {
    return createMockRedisClient();
  }

  if (!redisClient) {
    redisClient = createRedisClient();
    await redisClient.connect();
  }
  return redisClient;
};

/**
 * Create mock Redis client for development mode
 */
const createMockRedisClient = (): RedisClient => {
  const mockClient = {
    get: async () => null,
    set: async () => "OK",
    setEx: async () => "OK",
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    keys: async () => [],
    flushAll: async () => "OK",
    flushDb: async () => "OK",
    multi: () => mockClient,
    exec: async () => [],
    mGet: async () => [],
    connect: async () => {},
    disconnect: async () => {},
    quit: async () => {},
    isOpen: true,
    ping: async () => "PONG",
    incr: async () => 1,
    decr: async () => 1,
    incrBy: async () => 1,
    decrBy: async () => 1,
    hGet: async () => null,
    hSet: async () => 1,
    hGetAll: async () => ({}),
    hDel: async () => 1,
    hExists: async () => 0,
    hKeys: async () => [],
    hVals: async () => [],
    hLen: async () => 0,
    hIncrBy: async () => 1,
    lPush: async () => 1,
    rPush: async () => 1,
    lPop: async () => null,
    rPop: async () => null,
    lRange: async () => [],
    lLen: async () => 0,
    sAdd: async () => 1,
    sRem: async () => 1,
    sMembers: async () => [],
    sIsMember: async () => false,
    sCard: async () => 0,
    zAdd: async () => 1,
    zRem: async () => 1,
    zRange: async () => [],
    zRangeWithScores: async () => [],
    zScore: async () => null,
    zCard: async () => 0,
    call: async () => null,
    on: () => mockClient,
    once: () => mockClient,
    emit: () => mockClient,
    off: () => mockClient,
    removeAllListeners: () => mockClient,
  } as any;

  return mockClient;
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<void> => {
  try {
    const client = await getRedisClient();

    // Test connection with ping (only in production)
    if (config.nodeEnv !== "development") {
      const pong = await client.ping();
      if (pong !== "PONG") {
        throw new Error("Redis ping failed");
      }
      console.log("✅ Redis initialized successfully");
    } else {
      console.log("✅ Development mode: Using mock Redis client");
    }
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error);

    // In development, this shouldn't happen with mock client, but handle gracefully
    if (config.nodeEnv === "development") {
      console.warn("⚠️ Development mode: Continuing without Redis connection");
      return;
    }

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

    // In development mode, if Redis is not connected, just return true to avoid alerts
    if (config.nodeEnv === "development" && !redisClient.isOpen) {
      return true;
    }

    const pong = await redisClient.ping();
    return pong === "PONG";
  } catch (error) {
    // In development mode, don't log Redis errors as failures
    if (config.nodeEnv !== "development") {
      console.error("Redis health check failed:", error);
    }
    return config.nodeEnv === "development"; // Return true in dev mode to avoid alerts
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
