import { cacheService, CacheService } from "./cache.service";
import { WeatherData } from "@/types";

/**
 * Weather Cache Service
 * Specialized caching for weather data with appropriate TTL and invalidation strategies
 */

export interface WeatherCacheData {
  temperature: number;
  description: string;
  windSpeed: number;
  precipitation: number;
  humidity: number;
  warnings: string[];
  fetchedAt: Date;
  location: string;
  date: string;
}

export class WeatherCacheService {
  private cache: CacheService;
  private readonly WEATHER_PREFIX = "weather:";
  private readonly WEATHER_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly FORECAST_TTL = 6 * 60 * 60; // 6 hours for forecasts

  constructor(cacheService: CacheService) {
    this.cache = cacheService;
  }

  /**
   * Generate cache key for weather data
   */
  private generateWeatherKey(location: string, date: string): string {
    // Normalize location and date for consistent keys
    const normalizedLocation = location.toLowerCase().replace(/\s+/g, "_");
    const normalizedDate = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
    return `${this.WEATHER_PREFIX}${normalizedLocation}:${normalizedDate}`;
  }

  /**
   * Cache weather data for a specific location and date
   */
  async cacheWeatherData(
    location: string,
    date: string,
    weatherData: WeatherCacheData
  ): Promise<void> {
    const key = this.generateWeatherKey(location, date);
    const ttl = this.isToday(date) ? this.WEATHER_TTL : this.FORECAST_TTL;

    await this.cache.set(key, weatherData, {
      prefix: "",
      ttl,
    });
  }

  /**
   * Get cached weather data
   */
  async getCachedWeatherData(
    location: string,
    date: string
  ): Promise<WeatherCacheData | null> {
    const key = this.generateWeatherKey(location, date);
    return await this.cache.get<WeatherCacheData>(key, { prefix: "" });
  }

  /**
   * Check if weather data exists in cache
   */
  async hasWeatherData(location: string, date: string): Promise<boolean> {
    const key = this.generateWeatherKey(location, date);
    return await this.cache.exists(key, { prefix: "" });
  }

  /**
   * Invalidate weather data for specific location and date
   */
  async invalidateWeatherData(location: string, date: string): Promise<void> {
    const key = this.generateWeatherKey(location, date);
    await this.cache.delete(key, { prefix: "" });
  }

  /**
   * Get or fetch weather data with caching
   */
  async getOrFetchWeatherData(
    location: string,
    date: string,
    fetchFn: () => Promise<WeatherCacheData>
  ): Promise<WeatherCacheData> {
    const key = this.generateWeatherKey(location, date);
    const ttl = this.isToday(date) ? this.WEATHER_TTL : this.FORECAST_TTL;

    return await this.cache.getOrSet(key, fetchFn, {
      prefix: "",
      ttl,
    });
  }

  /**
   * Cache multiple weather forecasts at once
   */
  async cacheMultipleForecasts(
    forecasts: Array<{
      location: string;
      date: string;
      data: WeatherCacheData;
    }>
  ): Promise<void> {
    const keyValuePairs = forecasts.map(({ location, date, data }) => ({
      key: this.generateWeatherKey(location, date),
      value: data,
    }));

    await this.cache.mset(keyValuePairs, {
      prefix: "",
      ttl: this.FORECAST_TTL,
    });
  }

  /**
   * Get weather data for multiple locations/dates
   */
  async getMultipleWeatherData(
    requests: Array<{ location: string; date: string }>
  ): Promise<Array<WeatherCacheData | null>> {
    const keys = requests.map(({ location, date }) =>
      this.generateWeatherKey(location, date)
    );

    return await this.cache.mget<WeatherCacheData>(keys, { prefix: "" });
  }

  /**
   * Clear all weather cache data
   */
  async clearAllWeatherData(): Promise<void> {
    await this.cache.clearPrefix(this.WEATHER_PREFIX);
  }

  /**
   * Clear expired weather data (cleanup job)
   */
  async clearExpiredWeatherData(): Promise<void> {
    // This would typically be handled by Redis TTL automatically
    // But we can implement custom logic if needed
    console.log(
      "Weather cache cleanup - Redis TTL handles expiration automatically"
    );
  }

  /**
   * Get weather cache statistics
   */
  async getWeatherCacheStats(): Promise<{
    totalKeys: number;
    todayKeys: number;
    forecastKeys: number;
  }> {
    // This is a simplified implementation
    // In a real scenario, you'd scan keys with the weather prefix
    return {
      totalKeys: 0,
      todayKeys: 0,
      forecastKeys: 0,
    };
  }

  /**
   * Check if date is today
   */
  private isToday(date: string): boolean {
    const today = new Date().toISOString().split("T")[0];
    const checkDate = new Date(date).toISOString().split("T")[0];
    return today === checkDate;
  }

  /**
   * Check if weather data is stale (older than threshold)
   */
  async isWeatherDataStale(
    location: string,
    date: string,
    staleThresholdHours: number = 6
  ): Promise<boolean> {
    const cachedData = await this.getCachedWeatherData(location, date);

    if (!cachedData) {
      return true; // No data means stale
    }

    const fetchedAt = new Date(cachedData.fetchedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);

    return hoursDiff > staleThresholdHours;
  }

  /**
   * Refresh weather data if stale
   */
  async refreshIfStale(
    location: string,
    date: string,
    fetchFn: () => Promise<WeatherCacheData>,
    staleThresholdHours: number = 6
  ): Promise<WeatherCacheData> {
    const isStale = await this.isWeatherDataStale(
      location,
      date,
      staleThresholdHours
    );

    if (isStale) {
      const freshData = await fetchFn();
      await this.cacheWeatherData(location, date, freshData);
      return freshData;
    }

    // Return cached data if not stale
    const cachedData = await this.getCachedWeatherData(location, date);
    return cachedData!; // We know it exists because it's not stale
  }

  /**
   * Clear weather cache data - used by memory recovery controller
   */
  async clearCache(): Promise<void> {
    await this.cache.clearCache(this.WEATHER_PREFIX);
  }
}

// Export singleton instance
export const weatherCacheService = new WeatherCacheService(cacheService);
