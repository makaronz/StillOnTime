import { CacheService } from "@/services/cache.service";
import { createClient } from "redis";

// Mock Redis client
jest.mock("redis", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/config/redis", () => ({
  getRedisClient: jest.fn(),
}));

describe("CacheService", () => {
  let cacheService: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      mGet: jest.fn(),
      multi: jest.fn(() => ({
        setEx: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      })),
      keys: jest.fn(),
      info: jest.fn(),
      flushDb: jest.fn(),
    };

    // Mock getRedisClient to return our mock
    const { getRedisClient } = require("@/config/redis");
    getRedisClient.mockResolvedValue(mockRedisClient);

    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("set", () => {
    it("should set value in cache with default TTL", async () => {
      const key = "test-key";
      const value = { data: "test-data" };

      await cacheService.set(key, value);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "stillontime:test-key",
        3600, // default TTL
        JSON.stringify(value)
      );
    });

    it("should set value with custom TTL", async () => {
      const key = "test-key";
      const value = { data: "test-data" };
      const ttl = 1800;

      await cacheService.set(key, value, { ttl });

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "stillontime:test-key",
        ttl,
        JSON.stringify(value)
      );
    });

    it("should set value with custom prefix", async () => {
      const key = "test-key";
      const value = { data: "test-data" };
      const prefix = "custom:";

      await cacheService.set(key, value, { prefix });

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "custom:test-key",
        3600,
        JSON.stringify(value)
      );
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error("Redis error"));

      // Should not throw
      await expect(cacheService.set("key", "value")).resolves.toBeUndefined();
    });
  });

  describe("get", () => {
    it("should get value from cache", async () => {
      const key = "test-key";
      const value = { data: "test-data" };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith("stillontime:test-key");
      expect(result).toEqual(value);
    });

    it("should return null if key does not exist", async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get("non-existent-key");

      expect(result).toBeNull();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.get.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.get("key");

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete key from cache", async () => {
      const key = "test-key";

      await cacheService.delete(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith("stillontime:test-key");
    });
  });

  describe("exists", () => {
    it("should return true if key exists", async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cacheService.exists("test-key");

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        "stillontime:test-key"
      );
    });

    it("should return false if key does not exist", async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await cacheService.exists("test-key");

      expect(result).toBe(false);
    });
  });

  describe("getOrSet", () => {
    it("should return cached value if exists", async () => {
      const key = "test-key";
      const cachedValue = { data: "cached-data" };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedValue));

      const computeFn = jest.fn();
      const result = await cacheService.getOrSet(key, computeFn);

      expect(result).toEqual(cachedValue);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it("should compute and cache value if not exists", async () => {
      const key = "test-key";
      const computedValue = { data: "computed-data" };
      mockRedisClient.get.mockResolvedValue(null);

      const computeFn = jest.fn().mockResolvedValue(computedValue);
      const result = await cacheService.getOrSet(key, computeFn);

      expect(result).toEqual(computedValue);
      expect(computeFn).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "stillontime:test-key",
        3600,
        JSON.stringify(computedValue)
      );
    });
  });

  describe("increment", () => {
    it("should increment counter", async () => {
      mockRedisClient.incr.mockResolvedValue(5);

      const result = await cacheService.increment("counter");

      expect(result).toBe(5);
      expect(mockRedisClient.incr).toHaveBeenCalledWith("stillontime:counter");
    });

    it("should set TTL for new counter", async () => {
      mockRedisClient.incr.mockResolvedValue(1); // First increment

      await cacheService.increment("counter", { ttl: 3600 });

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        "stillontime:counter",
        3600
      );
    });
  });

  describe("mget", () => {
    it("should get multiple values", async () => {
      const keys = ["key1", "key2", "key3"];
      const values = ["value1", "value2", null];
      mockRedisClient.mGet.mockResolvedValue(values);

      const result = await cacheService.mget(keys);

      expect(mockRedisClient.mGet).toHaveBeenCalledWith([
        "stillontime:key1",
        "stillontime:key2",
        "stillontime:key3",
      ]);
      expect(result).toEqual(["value1", "value2", null]);
    });
  });

  describe("clearPrefix", () => {
    it("should clear keys with prefix", async () => {
      const prefix = "test:";
      const keys = ["test:key1", "test:key2"];
      mockRedisClient.keys.mockResolvedValue(keys);

      await cacheService.clearPrefix(prefix);

      expect(mockRedisClient.keys).toHaveBeenCalledWith("test:*");
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
    });

    it("should handle empty key list", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.clearPrefix("test:");

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
