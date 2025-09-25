import { getRedisClient } from "@/config/redis";
import { createClient } from "redis";

/**
 * Cache Service
 * Provides high-level caching operations for weather data, route calculations, and other data
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: string;
}

type RedisClient = ReturnType<typeof createClient>;

export class CacheService {
  private client: RedisClient | null = null;
  private defaultTTL = 3600; // 1 hour default TTL
  private keyPrefix = "stillontime:";

  /**
   * Initialize cache service
   */
  async initialize(): Promise<void> {
    this.client = await getRedisClient();
  }

  /**
   * Get client instance
   */
  private async getClient(): Promise<RedisClient> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.keyPrefix;
    return `${keyPrefix}${key}`;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;

      const serializedValue = JSON.stringify(value);
      await client.setEx(cacheKey, ttl, serializedValue);
    } catch (error) {
      console.error("Cache set error:", error);
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);

      const value = await client.get(cacheKey);
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);

      await client.del(cacheKey);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);

      const exists = await client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error("Cache exists error:", error);
      return false;
    }
  }

  /**
   * Get or set pattern - get from cache, or compute and cache if not found
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const computed = await computeFn();

    // Cache the computed value
    await this.set(key, computed, options);

    return computed;
  }

  /**
   * Increment counter in cache
   */
  async increment(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);

      const result = await client.incr(cacheKey);

      // Set TTL if this is a new key
      if (result === 1 && options.ttl) {
        await client.expire(cacheKey, options.ttl);
      }

      return result;
    } catch (error) {
      console.error("Cache increment error:", error);
      return 0;
    }
  }

  /**
   * Set expiration for existing key
   */
  async expire(
    key: string,
    ttl: number,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);

      await client.expire(cacheKey, ttl);
    } catch (error) {
      console.error("Cache expire error:", error);
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<(T | null)[]> {
    try {
      const client = await this.getClient();
      const cacheKeys = keys.map((key) =>
        this.generateKey(key, options.prefix)
      );

      const values = await client.mGet(cacheKeys);
      return values.map((value) => (value ? (JSON.parse(value) as T) : null));
    } catch (error) {
      console.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs at once
   */
  async mset<T>(
    keyValuePairs: Array<{ key: string; value: T }>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const client = await this.getClient();
      const pipeline = client.multi();

      for (const { key, value } of keyValuePairs) {
        const cacheKey = this.generateKey(key, options.prefix);
        const serializedValue = JSON.stringify(value);
        const ttl = options.ttl || this.defaultTTL;

        pipeline.setEx(cacheKey, ttl, serializedValue);
      }

      await pipeline.exec();
    } catch (error) {
      console.error("Cache mset error:", error);
    }
  }

  /**
   * Clear all keys with specific prefix
   */
  async clearPrefix(prefix: string): Promise<void> {
    try {
      const client = await this.getClient();
      const pattern = `${prefix}*`;

      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error("Cache clear prefix error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const client = await this.getClient();

      // Get Redis info
      const info = await client.info("stats");
      const memory = await client.info("memory");

      // Parse stats from info string
      const parseInfo = (infoStr: string) => {
        const lines = infoStr.split("\r\n");
        const stats: { [key: string]: string } = {};
        for (const line of lines) {
          const [key, value] = line.split(":");
          if (key && value) {
            stats[key] = value;
          }
        }
        return stats;
      };

      const statsInfo = parseInfo(info);
      const memoryInfo = parseInfo(memory);

      return {
        hits: parseInt(statsInfo.keyspace_hits || "0"),
        misses: parseInt(statsInfo.keyspace_misses || "0"),
        keys: parseInt(statsInfo.total_commands_processed || "0"),
        memory: memoryInfo.used_memory_human || "0B",
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return { hits: 0, misses: 0, keys: 0, memory: "0B" };
    }
  }

  /**
   * Flush all cache data (use with caution)
   */
  async flush(): Promise<void> {
    try {
      const client = await this.getClient();
      await client.flushDb();
    } catch (error) {
      console.error("Cache flush error:", error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
