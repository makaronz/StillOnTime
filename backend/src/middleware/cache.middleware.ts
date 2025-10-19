import { Request, Response, NextFunction } from "express";
import { cacheService } from "@/services/cache.service";
import { logger } from "@/utils/logger";
import crypto from "crypto";

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: (req: Request) => boolean;
  shouldCache?: (req: Request, res: Response) => boolean;
  generateKey?: (req: Request) => string;
  invalidateOn?: string[]; // Request methods that invalidate cache
  tags?: string[]; // Cache tags for selective invalidation
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: Partial<CacheConfig> = {
  ttl: 300, // 5 minutes
  keyPrefix: "api:",
  skipCache: (req) => {
    // Skip caching for non-GET requests
    if (req.method !== "GET") return true;

    // Skip caching for authenticated requests with specific headers
    if (req.headers["authorization"] || req.headers["x-cache-bypass"]) return true;

    // Skip caching for requests with query parameters that indicate dynamic content
    const skipParams = ["_t", "timestamp", "refresh", "nocache"];
    const hasSkipParam = skipParams.some(param => req.query[param]);
    if (hasSkipParam) return true;

    return false;
  },
  shouldCache: (req, res) => {
    // Only cache successful responses
    if (res.statusCode >= 400) return false;

    // Don't cache responses with Cache-Control: no-store
    const cacheControl = res.get("Cache-Control");
    if (cacheControl && cacheControl.includes("no-store")) return false;

    // Don't cache large responses (> 1MB)
    const contentLength = res.get("Content-Length");
    if (contentLength && parseInt(contentLength) > 1024 * 1024) return false;

    return true;
  },
  invalidateOn: ["POST", "PUT", "DELETE", "PATCH"],
};

/**
 * Cache middleware factory
 */
export function createCacheMiddleware(config: CacheConfig = {}) {
  const finalConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if we should skip cache
    if (finalConfig.skipCache?.(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = finalConfig.generateKey
      ? finalConfig.generateKey(req)
      : generateCacheKey(req, finalConfig.keyPrefix);

    // Try to get from cache
    cacheService.get(cacheKey)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Cache hit - return cached response
          logger.debug("Cache hit", { key: cacheKey, url: req.url });

          // Set cache headers
          res.set({
            "X-Cache": "HIT",
            "X-Cache-Key": cacheKey,
            "Cache-Control": `public, max-age=${finalConfig.ttl}`,
            "Content-Type": cachedResponse.contentType || "application/json",
          });

          return res.send(cachedResponse.data);
        }

        // Cache miss - intercept response to cache it
        logger.debug("Cache miss", { key: cacheKey, url: req.url });
        interceptResponse(req, res, next, cacheKey, finalConfig);
      })
      .catch(error => {
        logger.error("Cache middleware error", { error, cacheKey });
        next(); // Continue without caching on error
      });
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix?: string): string {
  const keyData = {
    method: req.method,
    url: req.url,
    query: req.query,
    // Include relevant headers for user-specific caching
    user: req.user?.id || req.headers["x-user-id"],
  };

  const keyString = JSON.stringify(keyData);
  const hash = crypto.createHash("sha256").update(keyString).digest("hex");

  return `${prefix || "api:"}${req.route?.path || req.path}:${hash}`;
}

/**
 * Intercept response to cache it
 */
function interceptResponse(
  req: Request,
  res: Response,
  next: NextFunction,
  cacheKey: string,
  config: CacheConfig
) {
  const originalSend = res.send;
  const originalJson = res.json;
  let responseData: any;
  let contentType: string | undefined;

  // Override send method
  res.send = function(data: any) {
    responseData = data;
    contentType = res.get("Content-Type") || "application/json";

    // Cache response if it meets criteria
    if (config.shouldCache?.(req, res) !== false) {
      cacheService.set(cacheKey, {
        data,
        contentType,
        timestamp: Date.now(),
        url: req.url,
      }, {
        ttl: config.ttl,
        prefix: config.keyPrefix,
      }).catch(error => {
        logger.error("Failed to cache response", { error, cacheKey });
      });
    }

    // Set cache headers
    res.set({
      "X-Cache": "MISS",
      "X-Cache-Key": cacheKey,
      "Cache-Control": `public, max-age=${config.ttl}`,
    });

    return originalSend.call(this, data);
  };

  // Override json method
  res.json = function(data: any) {
    responseData = data;
    contentType = "application/json";

    // Cache response if it meets criteria
    if (config.shouldCache?.(req, res) !== false) {
      cacheService.set(cacheKey, {
        data,
        contentType,
        timestamp: Date.now(),
        url: req.url,
      }, {
        ttl: config.ttl,
        prefix: config.keyPrefix,
      }).catch(error => {
        logger.error("Failed to cache JSON response", { error, cacheKey });
      });
    }

    // Set cache headers
    res.set({
      "X-Cache": "MISS",
      "X-Cache-Key": cacheKey,
      "Cache-Control": `public, max-age=${config.ttl}`,
    });

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Cache invalidation middleware
 */
export function createCacheInvalidationMiddleware(config: {
  patterns: string[];
  keyPrefix?: string;
  tags?: string[];
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function(data: any) {
      // Invalidate cache patterns after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateCachePatterns(config.patterns, config.keyPrefix)
          .catch(error => {
            logger.error("Cache invalidation error", { error, patterns: config.patterns });
          });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Invalidate cache patterns
 */
async function invalidateCachePatterns(patterns: string[], keyPrefix?: string): Promise<void> {
  const promises = patterns.map(async pattern => {
    try {
      await cacheService.clearPrefix(`${keyPrefix || "api:"}${pattern}`);
      logger.debug("Cache pattern invalidated", { pattern });
    } catch (error) {
      logger.error("Failed to invalidate cache pattern", { error, pattern });
    }
  });

  await Promise.all(promises);
}

/**
 * Cache tagging service for selective invalidation
 */
export class CacheTagService {
  private static instance: CacheTagService;
  private tagKeyPrefix = "cache_tags:";

  static getInstance(): CacheTagService {
    if (!CacheTagService.instance) {
      CacheTagService.instance = new CacheTagService();
    }
    return CacheTagService.instance;
  }

  /**
   * Add cache key to tag
   */
  async addToTag(tag: string, cacheKey: string): Promise<void> {
    try {
      const taggedKeys = await cacheService.get<string[]>(this.tagKeyPrefix + tag) || [];
      if (!taggedKeys.includes(cacheKey)) {
        taggedKeys.push(cacheKey);
        await cacheService.set(this.tagKeyPrefix + tag, taggedKeys, { ttl: 86400 }); // 24 hours
      }
    } catch (error) {
      logger.error("Failed to add to cache tag", { error, tag, cacheKey });
    }
  }

  /**
   * Invalidate all cache keys in tag
   */
  async invalidateTag(tag: string): Promise<void> {
    try {
      const taggedKeys = await cacheService.get<string[]>(this.tagKeyPrefix + tag);
      if (taggedKeys && taggedKeys.length > 0) {
        const promises = taggedKeys.map(key => cacheService.delete(key));
        await Promise.all(promises);

        // Clear the tag itself
        await cacheService.delete(this.tagKeyPrefix + tag);

        logger.debug("Cache tag invalidated", { tag, keyCount: taggedKeys.length });
      }
    } catch (error) {
      logger.error("Failed to invalidate cache tag", { error, tag });
    }
  }

  /**
   * Add multiple keys to multiple tags
   */
  async addToTags(tags: string[], cacheKey: string): Promise<void> {
    const promises = tags.map(tag => this.addToTag(tag, cacheKey));
    await Promise.all(promises);
  }

  /**
   * Invalidate multiple tags
   */
  async invalidateTags(tags: string[]): Promise<void> {
    const promises = tags.map(tag => this.invalidateTag(tag));
    await Promise.all(promises);
  }
}

/**
 * Pre-configured cache middleware for common use cases
 */
export const cacheMiddleware = {
  // Short-term cache for frequently changing data
  short: createCacheMiddleware({ ttl: 60 }), // 1 minute

  // Medium-term cache for relatively stable data
  medium: createCacheMiddleware({ ttl: 300 }), // 5 minutes

  // Long-term cache for rarely changing data
  long: createCacheMiddleware({ ttl: 3600 }), // 1 hour

  // User-specific cache
  user: createCacheMiddleware({
    ttl: 300,
    keyPrefix: "user:",
    generateKey: (req) => {
      const userId = req.user?.id || req.headers["x-user-id"];
      return `user:${userId}:${req.route?.path || req.path}:${JSON.stringify(req.query)}`;
    },
  }),

  // Dashboard cache (with invalidation on data changes)
  dashboard: createCacheMiddleware({
    ttl: 180, // 3 minutes
    keyPrefix: "dashboard:",
    skipCache: (req) => {
      return req.method !== "GET" || req.query.refresh === "true";
    },
  }),

  // API response cache
  api: createCacheMiddleware({
    ttl: 300,
    keyPrefix: "api:",
    shouldCache: (req, res) => {
      return res.statusCode < 400 &&
             !req.url.includes("/admin/") &&
             !req.headers["x-no-cache"];
    },
  }),
};

/**
 * Cache invalidation middleware for specific routes
 */
export const invalidateCache = {
  // Invalidate user-specific cache
  user: createCacheInvalidationMiddleware({
    patterns: ["user:*"],
    keyPrefix: "",
  }),

  // Invalidate dashboard cache
  dashboard: createCacheInvalidationMiddleware({
    patterns: ["dashboard:*"],
    keyPrefix: "",
  }),

  // Invalidate all API cache
  api: createCacheInvalidationMiddleware({
    patterns: ["api:*"],
    keyPrefix: "",
  }),
};