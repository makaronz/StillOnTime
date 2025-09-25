import { cacheService } from "./cache.service";
import { weatherCacheService } from "./weather-cache.service";
import { routeCacheService } from "./route-cache.service";

/**
 * Cache Invalidation Service
 * Manages cache invalidation strategies and cleanup operations
 */

export interface InvalidationRule {
  pattern: string;
  maxAge: number; // in seconds
  condition?: () => boolean;
}

export interface CacheCleanupStats {
  keysScanned: number;
  keysDeleted: number;
  memoryFreed: string;
  duration: number;
}

export class CacheInvalidationService {
  private readonly CLEANUP_BATCH_SIZE = 100;
  private readonly MAX_SCAN_TIME = 30000; // 30 seconds max scan time

  /**
   * Invalidate cache based on schedule changes
   */
  async invalidateScheduleRelatedCache(
    scheduleId: string,
    userId: string
  ): Promise<void> {
    try {
      // Clear weather cache for the schedule's location and date
      // This would require getting schedule details first
      console.log(`Invalidating cache for schedule ${scheduleId}`);

      // Clear user-specific route calculations
      await this.invalidateUserRouteCache(userId);

      // Clear any schedule-specific cached data
      await cacheService.delete(`schedule:${scheduleId}`);
    } catch (error) {
      console.error("Error invalidating schedule-related cache:", error);
    }
  }

  /**
   * Invalidate user-specific route cache
   */
  async invalidateUserRouteCache(userId: string): Promise<void> {
    try {
      await cacheService.clearPrefix(`route:user:${userId}:`);
    } catch (error) {
      console.error("Error invalidating user route cache:", error);
    }
  }

  /**
   * Invalidate weather cache for specific location
   */
  async invalidateLocationWeatherCache(location: string): Promise<void> {
    try {
      const normalizedLocation = location.toLowerCase().replace(/\s+/g, "_");
      await cacheService.clearPrefix(`weather:${normalizedLocation}:`);
    } catch (error) {
      console.error("Error invalidating location weather cache:", error);
    }
  }

  /**
   * Invalidate expired cache entries
   */
  async invalidateExpiredEntries(): Promise<CacheCleanupStats> {
    const startTime = Date.now();
    let keysScanned = 0;
    let keysDeleted = 0;

    try {
      // Redis handles TTL expiration automatically, but we can implement
      // custom logic for specific patterns if needed

      // For now, we'll just return stats showing Redis is handling expiration
      const stats = await cacheService.getStats();

      return {
        keysScanned: 0,
        keysDeleted: 0,
        memoryFreed: "0B",
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error("Error during cache cleanup:", error);
      return {
        keysScanned,
        keysDeleted,
        memoryFreed: "0B",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate cache based on time-based rules
   */
  async invalidateByTimeRules(rules: InvalidationRule[]): Promise<void> {
    for (const rule of rules) {
      try {
        if (rule.condition && !rule.condition()) {
          continue; // Skip if condition not met
        }

        await cacheService.clearPrefix(rule.pattern);
        console.log(`Invalidated cache pattern: ${rule.pattern}`);
      } catch (error) {
        console.error(`Error invalidating pattern ${rule.pattern}:`, error);
      }
    }
  }

  /**
   * Smart invalidation based on data freshness requirements
   */
  async smartInvalidation(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();

    try {
      // Invalidate weather cache during early morning hours (when forecasts update)
      if (currentHour >= 5 && currentHour <= 7) {
        await weatherCacheService.clearExpiredWeatherData();
      }

      // Invalidate route cache during peak traffic hours (when traffic patterns change rapidly)
      if (
        (currentHour >= 7 && currentHour <= 9) ||
        (currentHour >= 17 && currentHour <= 19)
      ) {
        // Clear only traffic-dependent routes, keep static routes
        await this.invalidateTrafficDependentRoutes();
      }

      // Weekly cleanup on Sundays at 3 AM
      if (now.getDay() === 0 && currentHour === 3) {
        await this.performWeeklyCleanup();
      }
    } catch (error) {
      console.error("Error during smart invalidation:", error);
    }
  }

  /**
   * Invalidate traffic-dependent route calculations
   */
  private async invalidateTrafficDependentRoutes(): Promise<void> {
    // Clear routes that include departure time (traffic-dependent)
    await cacheService.clearPrefix("route:*:*:*:*"); // Pattern for time-based routes
  }

  /**
   * Perform weekly cache cleanup
   */
  private async performWeeklyCleanup(): Promise<CacheCleanupStats> {
    console.log("Starting weekly cache cleanup...");

    const stats = await this.invalidateExpiredEntries();

    // Additional cleanup tasks
    await weatherCacheService.clearExpiredWeatherData();
    await routeCacheService.clearAllRouteData(); // Full route cache refresh

    console.log("Weekly cache cleanup completed:", stats);
    return stats;
  }

  /**
   * Invalidate cache when external APIs are updated
   */
  async invalidateOnAPIUpdate(apiName: string): Promise<void> {
    try {
      switch (apiName.toLowerCase()) {
        case "weather":
        case "openweathermap":
          await weatherCacheService.clearAllWeatherData();
          break;

        case "maps":
        case "googlemaps":
          await routeCacheService.clearAllRouteData();
          break;

        case "gmail":
          await cacheService.clearPrefix("email:");
          break;

        case "calendar":
          await cacheService.clearPrefix("calendar:");
          break;

        default:
          console.warn(`Unknown API for cache invalidation: ${apiName}`);
      }
    } catch (error) {
      console.error(`Error invalidating cache for API ${apiName}:`, error);
    }
  }

  /**
   * Emergency cache flush (use with extreme caution)
   */
  async emergencyFlush(): Promise<void> {
    console.warn(
      "Performing emergency cache flush - all cached data will be lost"
    );
    await cacheService.flush();
  }

  /**
   * Get cache health metrics
   */
  async getCacheHealthMetrics(): Promise<{
    totalKeys: number;
    hitRate: number;
    memoryUsage: string;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const stats = await cacheService.getStats();
      const hitRate =
        stats.hits + stats.misses > 0
          ? (stats.hits / (stats.hits + stats.misses)) * 100
          : 0;

      return {
        totalKeys: stats.keys,
        hitRate: Math.round(hitRate * 100) / 100,
        memoryUsage: stats.memory,
        oldestEntry: null, // Would require scanning keys
        newestEntry: null, // Would require scanning keys
      };
    } catch (error) {
      console.error("Error getting cache health metrics:", error);
      return {
        totalKeys: 0,
        hitRate: 0,
        memoryUsage: "0B",
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Schedule automatic invalidation tasks
   */
  setupAutomaticInvalidation(): void {
    // Run smart invalidation every hour
    setInterval(async () => {
      await this.smartInvalidation();
    }, 60 * 60 * 1000); // 1 hour

    // Run expired entry cleanup every 6 hours
    setInterval(async () => {
      await this.invalidateExpiredEntries();
    }, 6 * 60 * 60 * 1000); // 6 hours

    console.log("Automatic cache invalidation scheduled");
  }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();
