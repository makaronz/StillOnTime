import {
  WeatherCacheService,
  WeatherCacheData,
} from "@/services/weather-cache.service";
import { CacheService } from "@/services/cache.service";

// Mock CacheService
jest.mock("@/services/cache.service");

describe("WeatherCacheService", () => {
  let weatherCacheService: WeatherCacheService;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getOrSet: jest.fn(),
      mset: jest.fn(),
      mget: jest.fn(),
      clearPrefix: jest.fn(),
    } as any;

    weatherCacheService = new WeatherCacheService(mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("cacheWeatherData", () => {
    it("should cache weather data with correct key and TTL", async () => {
      const location = "New York";
      const date = "2024-12-01";
      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location,
        date,
      };

      await weatherCacheService.cacheWeatherData(location, date, weatherData);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        "weather:new_york:2024-12-01",
        weatherData,
        {
          prefix: "",
          ttl: expect.any(Number),
        }
      );
    });

    it("should use different TTL for today vs future dates", async () => {
      const location = "New York";
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location,
        date: today,
      };

      // Cache for today
      await weatherCacheService.cacheWeatherData(location, today, weatherData);

      // Cache for tomorrow
      await weatherCacheService.cacheWeatherData(
        location,
        tomorrow,
        weatherData
      );

      expect(mockCacheService.set).toHaveBeenCalledTimes(2);

      // Today should use 24-hour TTL, tomorrow should use 6-hour TTL
      const todayCall = mockCacheService.set.mock.calls[0];
      const tomorrowCall = mockCacheService.set.mock.calls[1];

      expect(todayCall[2].ttl).toBe(24 * 60 * 60); // 24 hours
      expect(tomorrowCall[2].ttl).toBe(6 * 60 * 60); // 6 hours
    });
  });

  describe("getCachedWeatherData", () => {
    it("should get cached weather data", async () => {
      const location = "New York";
      const date = "2024-12-01";
      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location,
        date,
      };

      mockCacheService.get.mockResolvedValue(weatherData);

      const result = await weatherCacheService.getCachedWeatherData(
        location,
        date
      );

      expect(mockCacheService.get).toHaveBeenCalledWith(
        "weather:new_york:2024-12-01",
        { prefix: "" }
      );
      expect(result).toEqual(weatherData);
    });

    it("should return null if no cached data", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await weatherCacheService.getCachedWeatherData(
        "New York",
        "2024-12-01"
      );

      expect(result).toBeNull();
    });
  });

  describe("hasWeatherData", () => {
    it("should check if weather data exists", async () => {
      mockCacheService.exists.mockResolvedValue(true);

      const result = await weatherCacheService.hasWeatherData(
        "New York",
        "2024-12-01"
      );

      expect(mockCacheService.exists).toHaveBeenCalledWith(
        "weather:new_york:2024-12-01",
        { prefix: "" }
      );
      expect(result).toBe(true);
    });
  });

  describe("getOrFetchWeatherData", () => {
    it("should use getOrSet with correct parameters", async () => {
      const location = "New York";
      const date = "2024-12-01";
      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location,
        date,
      };

      const fetchFn = jest.fn().mockResolvedValue(weatherData);
      mockCacheService.getOrSet.mockResolvedValue(weatherData);

      const result = await weatherCacheService.getOrFetchWeatherData(
        location,
        date,
        fetchFn
      );

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        "weather:new_york:2024-12-01",
        fetchFn,
        {
          prefix: "",
          ttl: expect.any(Number),
        }
      );
      expect(result).toEqual(weatherData);
    });
  });

  describe("isWeatherDataStale", () => {
    it("should return true if no cached data", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await weatherCacheService.isWeatherDataStale(
        "New York",
        "2024-12-01"
      );

      expect(result).toBe(true);
    });

    it("should return true if data is older than threshold", async () => {
      const oldDate = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8 hours ago
      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: oldDate,
        location: "New York",
        date: "2024-12-01",
      };

      mockCacheService.get.mockResolvedValue(weatherData);

      const result = await weatherCacheService.isWeatherDataStale(
        "New York",
        "2024-12-01",
        6
      );

      expect(result).toBe(true);
    });

    it("should return false if data is fresh", async () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const weatherData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: recentDate,
        location: "New York",
        date: "2024-12-01",
      };

      mockCacheService.get.mockResolvedValue(weatherData);

      const result = await weatherCacheService.isWeatherDataStale(
        "New York",
        "2024-12-01",
        6
      );

      expect(result).toBe(false);
    });
  });

  describe("refreshIfStale", () => {
    it("should refresh data if stale", async () => {
      const location = "New York";
      const date = "2024-12-01";
      const oldDate = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8 hours ago
      const staleData: WeatherCacheData = {
        temperature: 15,
        description: "Cloudy",
        windSpeed: 3,
        precipitation: 0,
        humidity: 70,
        warnings: [],
        fetchedAt: oldDate,
        location,
        date,
      };

      const freshData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location,
        date,
      };

      mockCacheService.get.mockResolvedValue(staleData);
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await weatherCacheService.refreshIfStale(
        location,
        date,
        fetchFn,
        6
      );

      expect(fetchFn).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "weather:new_york:2024-12-01",
        freshData,
        expect.any(Object)
      );
      expect(result).toEqual(freshData);
    });

    it("should return cached data if not stale", async () => {
      const location = "New York";
      const date = "2024-12-01";
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const freshData: WeatherCacheData = {
        temperature: 20,
        description: "Sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: recentDate,
        location,
        date,
      };

      mockCacheService.get.mockResolvedValue(freshData);
      const fetchFn = jest.fn();

      const result = await weatherCacheService.refreshIfStale(
        location,
        date,
        fetchFn,
        6
      );

      expect(fetchFn).not.toHaveBeenCalled();
      expect(result).toEqual(freshData);
    });
  });

  describe("cacheMultipleForecasts", () => {
    it("should cache multiple forecasts", async () => {
      const forecasts = [
        {
          location: "New York",
          date: "2024-12-01",
          data: {
            temperature: 20,
            description: "Sunny",
            windSpeed: 5,
            precipitation: 0,
            humidity: 60,
            warnings: [],
            fetchedAt: new Date(),
            location: "New York",
            date: "2024-12-01",
          },
        },
        {
          location: "Los Angeles",
          date: "2024-12-01",
          data: {
            temperature: 25,
            description: "Clear",
            windSpeed: 3,
            precipitation: 0,
            humidity: 50,
            warnings: [],
            fetchedAt: new Date(),
            location: "Los Angeles",
            date: "2024-12-01",
          },
        },
      ];

      await weatherCacheService.cacheMultipleForecasts(forecasts);

      expect(mockCacheService.mset).toHaveBeenCalledWith(
        [
          { key: "weather:new_york:2024-12-01", value: forecasts[0].data },
          { key: "weather:los_angeles:2024-12-01", value: forecasts[1].data },
        ],
        {
          prefix: "",
          ttl: 6 * 60 * 60, // 6 hours for forecasts
        }
      );
    });
  });
});
