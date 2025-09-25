import {
  WeatherService,
  OpenWeatherMapResponse,
  OpenWeatherMapForecastResponse,
} from "@/services/weather.service";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { weatherCacheService } from "@/services/weather-cache.service";
import { config } from "@/config/config";
import axios from "axios";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("axios");
jest.mock("@/services/weather-cache.service");
jest.mock("@/repositories/weather-data.repository");
jest.mock("@/config/config");
jest.mock("@/utils/logger");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedWeatherCache = weatherCacheService as jest.Mocked<
  typeof weatherCacheService
>;
const MockedWeatherDataRepository = WeatherDataRepository as jest.MockedClass<
  typeof WeatherDataRepository
>;

describe("WeatherService", () => {
  let weatherService: WeatherService;
  let mockWeatherRepository: jest.Mocked<WeatherDataRepository>;
  let mockAxiosInstance: jest.Mocked<any>;

  const mockConfig = {
    apis: {
      openWeatherApiKey: "test-api-key",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    (config as any) = mockConfig;

    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Mock repository
    mockWeatherRepository =
      new MockedWeatherDataRepository() as jest.Mocked<WeatherDataRepository>;

    weatherService = new WeatherService(mockWeatherRepository);
  });

  describe("getCurrentWeather", () => {
    const mockCurrentWeatherResponse: OpenWeatherMapResponse = {
      coord: { lon: 21.0122, lat: 52.2297 },
      weather: [
        {
          id: 800,
          main: "Clear",
          description: "bezchmurnie",
          icon: "01d",
        },
      ],
      base: "stations",
      main: {
        temp: 15.5,
        feels_like: 14.2,
        temp_min: 13.0,
        temp_max: 18.0,
        pressure: 1013,
        humidity: 65,
      },
      visibility: 10000,
      wind: {
        speed: 3.5,
        deg: 180,
      },
      clouds: { all: 0 },
      dt: 1640995200,
      sys: {
        type: 2,
        id: 2032856,
        country: "PL",
        sunrise: 1640934123,
        sunset: 1640963456,
      },
      timezone: 3600,
      id: 756135,
      name: "Warsaw",
      cod: 200,
    };

    it("should fetch current weather successfully", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockCurrentWeatherResponse,
      });

      const result = await weatherService.getCurrentWeather("Warsaw");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/weather", {
        params: { q: "Warsaw" },
      });

      expect(result).toEqual({
        temperature: 16, // Rounded from 15.5
        description: "bezchmurnie",
        windSpeed: 3.5,
        precipitation: 0,
        humidity: 65,
        warnings: [], // No warnings for normal conditions
        fetchedAt: expect.any(Date),
        location: "Warsaw",
        date: expect.any(String),
      });
    });

    it("should generate temperature warnings for cold weather", async () => {
      const coldWeatherResponse = {
        ...mockCurrentWeatherResponse,
        main: { ...mockCurrentWeatherResponse.main, temp: -5 },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: coldWeatherResponse });

      const result = await weatherService.getCurrentWeather("Warsaw");

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Temperatura poniżej zera: -5°C"),
        ])
      );
    });

    it("should generate temperature warnings for hot weather", async () => {
      const hotWeatherResponse = {
        ...mockCurrentWeatherResponse,
        main: { ...mockCurrentWeatherResponse.main, temp: 35 },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: hotWeatherResponse });

      const result = await weatherService.getCurrentWeather("Warsaw");

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Wysoka temperatura: 35°C"),
        ])
      );
    });

    it("should generate wind warnings for strong wind", async () => {
      const windyWeatherResponse = {
        ...mockCurrentWeatherResponse,
        wind: { speed: 15, deg: 180 },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: windyWeatherResponse });

      const result = await weatherService.getCurrentWeather("Warsaw");

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("Silny wiatr: 15m/s")])
      );
    });

    it("should generate severe weather warnings for thunderstorms", async () => {
      const stormWeatherResponse = {
        ...mockCurrentWeatherResponse,
        weather: [
          {
            id: 200,
            main: "Thunderstorm",
            description: "burza z deszczem",
            icon: "11d",
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: stormWeatherResponse });

      const result = await weatherService.getCurrentWeather("Warsaw");

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Burza - rozważ przełożenie zdjęć zewnętrznych"
          ),
        ])
      );
    });

    it("should handle API errors gracefully", async () => {
      const apiError = {
        response: {
          status: 404,
          data: { message: "city not found" },
        },
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(apiError);

      await expect(
        weatherService.getCurrentWeather("InvalidCity")
      ).rejects.toThrow("Location not found: InvalidCity");
    });

    it("should handle rate limiting errors", async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: "rate limit exceeded" },
        },
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(rateLimitError);

      await expect(weatherService.getCurrentWeather("Warsaw")).rejects.toThrow(
        "Weather API rate limit exceeded - try again later"
      );
    });
  });

  describe("getWeatherForecast", () => {
    const mockForecastResponse: OpenWeatherMapForecastResponse = {
      cod: "200",
      message: 0,
      cnt: 40,
      list: [
        {
          dt: 1641024000,
          main: {
            temp: 12.5,
            feels_like: 11.2,
            temp_min: 10.0,
            temp_max: 15.0,
            pressure: 1015,
            sea_level: 1015,
            grnd_level: 1010,
            humidity: 70,
            temp_kf: 0,
          },
          weather: [
            {
              id: 500,
              main: "Rain",
              description: "lekki deszcz",
              icon: "10d",
            },
          ],
          clouds: { all: 75 },
          wind: {
            speed: 4.2,
            deg: 200,
          },
          visibility: 8000,
          pop: 0.8,
          rain: { "3h": 2.5 },
          sys: { pod: "d" },
          dt_txt: "2022-01-01 12:00:00",
        },
      ],
      city: {
        id: 756135,
        name: "Warsaw",
        coord: { lat: 52.2297, lon: 21.0122 },
        country: "PL",
        population: 1790658,
        timezone: 3600,
        sunrise: 1640934123,
        sunset: 1640963456,
      },
    };

    it("should return cached data when available and fresh", async () => {
      const cachedData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2022-01-01",
      };

      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(cachedData);

      const result = await weatherService.getWeatherForecast(
        "Warsaw",
        "2022-01-01"
      );

      expect(result).toEqual(cachedData);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("should fetch fresh data when cache is stale", async () => {
      // Use tomorrow's date to avoid past date error
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // Mock cache to return null to trigger fresh fetch
      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(null);

      // Update mock response to use tomorrow's date
      const futureForecastResponse = {
        ...mockForecastResponse,
        list: [
          {
            ...mockForecastResponse.list[0],
            dt_txt: `${tomorrowStr} 12:00:00`,
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: futureForecastResponse });

      const result = await weatherService.getWeatherForecast(
        "Warsaw",
        tomorrowStr
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/forecast", {
        params: { q: "Warsaw" },
      });
      expect(mockedWeatherCache.cacheWeatherData).toHaveBeenCalled();
    });

    it("should fetch forecast data for future dates", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const futureForecastResponse = {
        ...mockForecastResponse,
        list: [
          {
            ...mockForecastResponse.list[0],
            dt_txt: `${futureDateStr} 12:00:00`,
          },
        ],
      };

      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({ data: futureForecastResponse });

      const result = await weatherService.getWeatherForecast(
        "Warsaw",
        futureDateStr
      );

      expect(result.temperature).toBe(13); // Rounded from 12.5
      expect(result.description).toBe("lekki deszcz");
      expect(result.precipitation).toBe(2.5);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Możliwe opady: 2.5mm"),
        ])
      );
    });

    it("should handle past dates with error", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split("T")[0];

      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(null);

      await expect(
        weatherService.getWeatherForecast("Warsaw", pastDateStr)
      ).rejects.toThrow("Cannot fetch weather for past dates");
    });

    it("should handle dates too far in future", async () => {
      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 10);
      const farFutureDateStr = farFutureDate.toISOString().split("T")[0];

      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(null);

      await expect(
        weatherService.getWeatherForecast("Warsaw", farFutureDateStr)
      ).rejects.toThrow("Weather forecast only available for next 5 days");
    });

    it("should return stale cached data as fallback when API fails", async () => {
      const staleData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        location: "Warsaw",
        date: "2022-01-01",
      };

      mockedWeatherCache.getCachedWeatherData
        .mockResolvedValueOnce(staleData) // First call returns stale data
        .mockResolvedValueOnce(staleData); // Second call for fallback

      mockAxiosInstance.get.mockRejectedValue(new Error("API Error"));

      const result = await weatherService.getWeatherForecast(
        "Warsaw",
        "2022-01-01"
      );

      expect(result).toEqual(staleData);
      expect(logger.warn).toHaveBeenCalledWith(
        "Returning stale weather data as fallback",
        { location: "Warsaw", date: "2022-01-01" }
      );
    });
  });

  describe("getWeatherWithFallback", () => {
    it("should return API data when available", async () => {
      const mockData = {
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2022-01-01",
      };

      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(mockData);

      const result = await weatherService.getWeatherWithFallback(
        "Warsaw",
        "2022-01-01"
      );

      expect(result).toEqual(mockData);
    });

    it("should return cached data with warning when API fails", async () => {
      // Use tomorrow's date to avoid past date error
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const cachedData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago - stale
        location: "Warsaw",
        date: tomorrowStr,
      };

      // Mock cache to return null for both calls so getWeatherForecast throws
      // Then return data for the fallback logic in getWeatherWithFallback
      mockedWeatherCache.getCachedWeatherData
        .mockResolvedValueOnce(null) // First call in getWeatherForecast - no cache, triggers API call
        .mockResolvedValueOnce(null) // Second call in getWeatherForecast fallback - no cache, throws error
        .mockResolvedValueOnce(cachedData); // Third call in getWeatherWithFallback fallback - returns data

      // Mock API to fail
      mockAxiosInstance.get.mockRejectedValue(new Error("API Error"));

      const result = await weatherService.getWeatherWithFallback(
        "Warsaw",
        tomorrowStr
      );

      // The result should have the warning added
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          "⚠️ Dane pogodowe mogą być nieaktualne - API niedostępne",
        ])
      );
    });

    it("should return fallback data when no cached data available", async () => {
      mockedWeatherCache.getCachedWeatherData.mockResolvedValue(null);
      mockAxiosInstance.get.mockRejectedValue(new Error("API Error"));

      const result = await weatherService.getWeatherWithFallback(
        "Warsaw",
        "2022-01-01"
      );

      expect(result.temperature).toBe(15);
      expect(result.description).toBe("Dane niedostępne");
      expect(result.warnings).toContain(
        "⚠️ Dane pogodowe niedostępne - sprawdź prognozę ręcznie"
      );
    });
  });

  describe("storeWeatherData", () => {
    it("should store weather data in database", async () => {
      const weatherData = {
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2022-01-01",
      };

      const mockStoredWeather = {
        id: "weather-123",
        forecastDate: new Date("2022-01-01"),
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: expect.any(Date),
        userId: "user-123",
        scheduleId: "schedule-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWeatherRepository.create.mockResolvedValue(mockStoredWeather as any);

      const result = await weatherService.storeWeatherData(
        "schedule-123",
        "user-123",
        weatherData
      );

      expect(mockWeatherRepository.create).toHaveBeenCalledWith({
        forecastDate: new Date("2022-01-01"),
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        user: { connect: { id: "user-123" } },
        schedule: { connect: { id: "schedule-123" } },
      });

      expect(result).toEqual(mockStoredWeather);
    });
  });

  describe("isConfigured", () => {
    it("should return true when API key is configured", () => {
      expect(weatherService.isConfigured()).toBe(true);
    });

    it("should return false when API key is not configured", () => {
      (config as any).apis.openWeatherApiKey = "";
      const unconfiguredService = new WeatherService(mockWeatherRepository);

      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe("testConnection", () => {
    it("should return true when connection test succeeds", async () => {
      const mockResponse = {
        coord: { lon: 21.0122, lat: 52.2297 },
        weather: [
          { id: 800, main: "Clear", description: "clear sky", icon: "01d" },
        ],
        base: "stations",
        main: {
          temp: 15,
          feels_like: 14,
          temp_min: 13,
          temp_max: 18,
          pressure: 1013,
          humidity: 65,
        },
        visibility: 10000,
        wind: { speed: 3.5, deg: 180 },
        clouds: { all: 0 },
        dt: 1640995200,
        sys: {
          type: 2,
          id: 2032856,
          country: "PL",
          sunrise: 1640934123,
          sunset: 1640963456,
        },
        timezone: 3600,
        id: 756135,
        name: "Warsaw",
        cod: 200,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

      const result = await weatherService.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/weather", {
        params: { q: "Warsaw" },
      });
    });

    it("should return false when connection test fails", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Connection failed"));

      const result = await weatherService.testConnection();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Weather API connection test failed",
        expect.objectContaining({
          error: "Weather service error: Connection failed",
        })
      );
    });
  });
});
