import { cacheService, CacheService } from "./cache.service";

/**
 * Route Cache Service
 * Specialized caching for route calculations with traffic-aware TTL
 */

export interface RouteCacheData {
  origin: string;
  destination: string;
  distance: string;
  duration: string;
  durationInTraffic: string;
  steps: RouteStep[];
  calculatedAt: Date;
  trafficConditions: string;
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
}

export interface RouteCalculationRequest {
  origin: string;
  destination: string;
  departureTime?: Date;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export class RouteCacheService {
  private cache: CacheService;
  private readonly ROUTE_PREFIX = "route:";
  private readonly ROUTE_TTL = 30 * 60; // 30 minutes for routes with traffic
  private readonly STATIC_ROUTE_TTL = 24 * 60 * 60; // 24 hours for static routes

  constructor(cacheService: CacheService) {
    this.cache = cacheService;
  }

  /**
   * Generate cache key for route data
   */
  private generateRouteKey(request: RouteCalculationRequest): string {
    const { origin, destination, departureTime, avoidTolls, avoidHighways } =
      request;

    // Normalize addresses for consistent keys
    const normalizedOrigin = this.normalizeAddress(origin);
    const normalizedDestination = this.normalizeAddress(destination);

    // Include departure time in key for traffic-aware caching
    const timeKey = departureTime
      ? Math.floor(departureTime.getTime() / (15 * 60 * 1000)) // 15-minute buckets
      : "static";

    const optionsKey =
      [avoidTolls ? "no-tolls" : "", avoidHighways ? "no-highways" : ""]
        .filter(Boolean)
        .join("-") || "default";

    return `${this.ROUTE_PREFIX}${normalizedOrigin}:${normalizedDestination}:${timeKey}:${optionsKey}`;
  }

  /**
   * Normalize address for consistent caching
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .substring(0, 50); // Limit length
  }

  /**
   * Cache route calculation result
   */
  async cacheRouteData(
    request: RouteCalculationRequest,
    routeData: RouteCacheData
  ): Promise<void> {
    const key = this.generateRouteKey(request);
    const ttl = request.departureTime ? this.ROUTE_TTL : this.STATIC_ROUTE_TTL;

    await this.cache.set(key, routeData, {
      prefix: "",
      ttl,
    });
  }

  /**
   * Get cached route data
   */
  async getCachedRouteData(
    request: RouteCalculationRequest
  ): Promise<RouteCacheData | null> {
    const key = this.generateRouteKey(request);
    return await this.cache.get<RouteCacheData>(key, { prefix: "" });
  }

  /**
   * Check if route data exists in cache
   */
  async hasRouteData(request: RouteCalculationRequest): Promise<boolean> {
    const key = this.generateRouteKey(request);
    return await this.cache.exists(key, { prefix: "" });
  }

  /**
   * Invalidate route data
   */
  async invalidateRouteData(request: RouteCalculationRequest): Promise<void> {
    const key = this.generateRouteKey(request);
    await this.cache.delete(key, { prefix: "" });
  }

  /**
   * Get or calculate route with caching
   */
  async getOrCalculateRoute(
    request: RouteCalculationRequest,
    calculateFn: () => Promise<RouteCacheData>
  ): Promise<RouteCacheData> {
    const key = this.generateRouteKey(request);
    const ttl = request.departureTime ? this.ROUTE_TTL : this.STATIC_ROUTE_TTL;

    return await this.cache.getOrSet(key, calculateFn, {
      prefix: "",
      ttl,
    });
  }

  /**
   * Cache multiple route calculations
   */
  async cacheMultipleRoutes(
    routes: Array<{
      request: RouteCalculationRequest;
      data: RouteCacheData;
    }>
  ): Promise<void> {
    const keyValuePairs = routes.map(({ request, data }) => ({
      key: this.generateRouteKey(request),
      value: data,
    }));

    await this.cache.mset(keyValuePairs, {
      prefix: "",
      ttl: this.ROUTE_TTL,
    });
  }

  /**
   * Get multiple cached routes
   */
  async getMultipleRoutes(
    requests: RouteCalculationRequest[]
  ): Promise<Array<RouteCacheData | null>> {
    const keys = requests.map((request) => this.generateRouteKey(request));
    return await this.cache.mget<RouteCacheData>(keys, { prefix: "" });
  }

  /**
   * Clear all route cache data
   */
  async clearAllRouteData(): Promise<void> {
    await this.cache.clearPrefix(this.ROUTE_PREFIX);
  }

  /**
   * Clear route data for specific origin-destination pair
   */
  async clearRouteDataForPair(
    origin: string,
    destination: string
  ): Promise<void> {
    const normalizedOrigin = this.normalizeAddress(origin);
    const normalizedDestination = this.normalizeAddress(destination);
    const pattern = `${this.ROUTE_PREFIX}${normalizedOrigin}:${normalizedDestination}:*`;

    await this.cache.clearPrefix(pattern);
  }

  /**
   * Check if route data is stale based on traffic conditions
   */
  async isRouteDataStale(
    request: RouteCalculationRequest,
    staleThresholdMinutes: number = 15
  ): Promise<boolean> {
    const cachedData = await this.getCachedRouteData(request);

    if (!cachedData) {
      return true; // No data means stale
    }

    // For static routes (no departure time), use longer threshold
    if (!request.departureTime) {
      staleThresholdMinutes = 60; // 1 hour for static routes
    }

    const calculatedAt = new Date(cachedData.calculatedAt);
    const now = new Date();
    const minutesDiff = (now.getTime() - calculatedAt.getTime()) / (1000 * 60);

    return minutesDiff > staleThresholdMinutes;
  }

  /**
   * Refresh route data if stale
   */
  async refreshIfStale(
    request: RouteCalculationRequest,
    calculateFn: () => Promise<RouteCacheData>,
    staleThresholdMinutes: number = 15
  ): Promise<RouteCacheData> {
    const isStale = await this.isRouteDataStale(request, staleThresholdMinutes);

    if (isStale) {
      const freshData = await calculateFn();
      await this.cacheRouteData(request, freshData);
      return freshData;
    }

    // Return cached data if not stale
    const cachedData = await this.getCachedRouteData(request);
    return cachedData!; // We know it exists because it's not stale
  }

  /**
   * Get route cache statistics
   */
  async getRouteCacheStats(): Promise<{
    totalRoutes: number;
    staticRoutes: number;
    trafficRoutes: number;
    averageAge: number;
  }> {
    // This is a simplified implementation
    // In a real scenario, you'd scan keys with the route prefix
    return {
      totalRoutes: 0,
      staticRoutes: 0,
      trafficRoutes: 0,
      averageAge: 0,
    };
  }

  /**
   * Preload common routes
   */
  async preloadCommonRoutes(
    commonRoutes: RouteCalculationRequest[],
    calculateFn: (request: RouteCalculationRequest) => Promise<RouteCacheData>
  ): Promise<void> {
    const routePromises = commonRoutes.map(async (request) => {
      const exists = await this.hasRouteData(request);
      if (!exists) {
        const routeData = await calculateFn(request);
        await this.cacheRouteData(request, routeData);
      }
    });

    await Promise.all(routePromises);
  }

  /**
   * Get estimated travel time from cache (quick lookup)
   */
  async getEstimatedTravelTime(
    origin: string,
    destination: string,
    departureTime?: Date
  ): Promise<number | null> {
    const request: RouteCalculationRequest = {
      origin,
      destination,
      departureTime,
    };

    const cachedData = await this.getCachedRouteData(request);
    if (!cachedData) {
      return null;
    }

    // Parse duration string (e.g., "45 mins" -> 45)
    const durationStr = cachedData.durationInTraffic || cachedData.duration;
    const match = durationStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}

// Export singleton instance
export const routeCacheService = new RouteCacheService(cacheService);
