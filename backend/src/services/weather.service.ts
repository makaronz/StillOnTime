import axios from "axios";
import { config } from "@/config/config";
import { WeatherData, CreateWeatherDataInput, WeatherForecast } from "@/types";
import { weatherCacheService, WeatherCacheData } from "./weather-cache.service";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { logger } from "@/utils/logger";

/**
 * Weather Service
 * Integrates with OpenWeatherMap API to fetch weather forecasts and generate warnings
 * Implements caching and error handling as per requirements 5.1, 5.2, 5.4, 5.5
 */

export interface OpenWeatherMapResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface OpenWeatherMapForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      sea_level: number;
      grnd_level: number;
      humidity: number;
      temp_kf: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: {
      all: number;
    };
    wind: {
      speed: number;
      deg: number;
      gust?: number;
    };
    visibility: number;
    pop: number; // Probability of precipitation
    rain?: {
      "3h": number;
    };
    snow?: {
      "3h": number;
    };
    sys: {
      pod: string;
    };
    dt_txt: string;
  }>;
  city: {
    id: number;
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

export interface WeatherWarning {
  type: "temperature" | "precipitation" | "wind" | "severe";
  severity: "low" | "medium" | "high";
  message: string;
  value?: number;
  unit?: string;
}

export class WeatherService {
  private client: typeof axios;
  private weatherRepository: WeatherDataRepository;
  private readonly baseUrl = "https://api.openweathermap.org/data/2.5";
  private readonly apiKey: string;

  constructor(weatherRepository: WeatherDataRepository) {
    this.apiKey = config.apis.openWeatherApiKey;
    this.weatherRepository = weatherRepository;

    if (!this.apiKey) {
      logger.warn("OpenWeatherMap API key not configured");
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 second timeout
      params: {
        appid: this.apiKey,
        units: "metric", // Celsius, m/s for wind
        lang: "pl", // Polish language for descriptions
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: axios.AxiosRequestConfig) => {
        logger.debug("Weather API request", {
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error: axios.AxiosError) => {
        logger.error("Weather API request error", { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: axios.AxiosResponse) => {
        logger.debug("Weather API response", {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: axios.AxiosError) => {
        logger.error("Weather API response error", {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get current weather for a location
   * Requirement 5.1: Fetch weather forecast for shooting date and location
   */
  async getCurrentWeather(location: string): Promise<WeatherCacheData> {
    try {
      const response = await this.client.get("/weather", {
        params: { q: location },
      });

      const data = response.data;
      const weatherData: WeatherCacheData = {
        temperature: Math.round(data.main.temp),
        description: data.weather[0]?.description || "Unknown",
        windSpeed: data.wind.speed,
        precipitation: 0, // Current weather doesn't include precipitation amount
        humidity: data.main.humidity,
        warnings: this.generateWeatherWarnings({
          temperature: data.main.temp,
          windSpeed: data.wind.speed,
          precipitation: 0,
          conditions: data.weather.map((w: { main: string }) =>
            w.main.toLowerCase()
          ),
        }),
        fetchedAt: new Date(),
        location,
        date: new Date().toISOString().split("T")[0],
      };

      logger.info("Current weather fetched successfully", {
        location,
        temperature: weatherData.temperature,
        description: weatherData.description,
      });

      return weatherData;
    } catch (error) {
      logger.error("Failed to fetch current weather", {
        location,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw this.handleWeatherAPIError(error, location);
    }
  }

  /**
   * Get weather forecast for a specific date and location
   * Requirement 5.1: Fetch detailed weather forecast for shooting date and location
   */
  async getWeatherForecast(
    location: string,
    date: string
  ): Promise<WeatherCacheData> {
    const cacheKey = `${location}:${date}`;

    try {
      // Try to get from cache first
      const cachedData = await weatherCacheService.getCachedWeatherData(
        location,
        date
      );
      if (cachedData && !this.isWeatherDataStale(cachedData)) {
        logger.debug("Weather data served from cache", { location, date });
        return cachedData;
      }

      // Fetch fresh data from API
      const weatherData = await this.fetchWeatherForecastFromAPI(
        location,
        date
      );

      // Cache the result
      await weatherCacheService.cacheWeatherData(location, date, weatherData);

      logger.info("Weather forecast fetched and cached", {
        location,
        date,
        temperature: weatherData.temperature,
      });

      return weatherData;
    } catch (error) {
      logger.error("Failed to get weather forecast", {
        location,
        date,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Try to return stale cached data as fallback
      const staleData = await weatherCacheService.getCachedWeatherData(
        location,
        date
      );
      if (staleData) {
        logger.warn("Returning stale weather data as fallback", {
          location,
          date,
        });
        return staleData;
      }

      throw this.handleWeatherAPIError(error, location, date);
    }
  }

  /**
   * Fetch weather forecast from OpenWeatherMap API
   */
  private async fetchWeatherForecastFromAPI(
    location: string,
    date: string
  ): Promise<WeatherCacheData> {
    const targetDate = new Date(date);
    const now = new Date();
    const daysDiff = Math.ceil(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff < 0) {
      throw new Error("Cannot fetch weather for past dates");
    }

    if (daysDiff === 0) {
      // Today - use current weather
      return await this.getCurrentWeather(location);
    }

    if (daysDiff > 5) {
      throw new Error("Weather forecast only available for next 5 days");
    }

    // Use 5-day forecast API
    const response = await this.client.get("/forecast", {
      params: { q: location },
    });

    const forecastData = response.data;

    // Find the forecast entry closest to the target date
    const targetDateStr = targetDate.toISOString().split("T")[0];
    const relevantForecasts = forecastData.list.filter(
      (item: { dt_txt: string }) => item.dt_txt.startsWith(targetDateStr)
    );

    if (relevantForecasts.length === 0) {
      throw new Error(`No forecast data available for date ${date}`);
    }

    // Use midday forecast (around 12:00) if available, otherwise first available
    const middayForecast =
      relevantForecasts.find((item: { dt_txt: string }) =>
        item.dt_txt.includes("12:00:00")
      ) || relevantForecasts[0];

    const precipitation =
      (middayForecast.rain?.["3h"] || 0) + (middayForecast.snow?.["3h"] || 0);

    const weatherData: WeatherCacheData = {
      temperature: Math.round(middayForecast.main.temp),
      description: middayForecast.weather[0]?.description || "Unknown",
      windSpeed: middayForecast.wind.speed,
      precipitation,
      humidity: middayForecast.main.humidity,
      warnings: this.generateWeatherWarnings({
        temperature: middayForecast.main.temp,
        windSpeed: middayForecast.wind.speed,
        precipitation,
        conditions: middayForecast.weather.map((w: { main: string }) =>
          w.main.toLowerCase()
        ),
      }),
      fetchedAt: new Date(),
      location,
      date,
    };

    return weatherData;
  }

  /**
   * Generate weather warnings based on conditions
   * Requirements 5.2: Generate warnings for various weather conditions
   */
  private generateWeatherWarnings(conditions: {
    temperature: number;
    windSpeed: number;
    precipitation: number;
    conditions: string[];
  }): string[] {
    const warnings: string[] = [];

    // Temperature warnings (Requirement 5.2)
    if (conditions.temperature < 0) {
      warnings.push(
        `⚠️ Temperatura poniżej zera: ${Math.round(
          conditions.temperature
        )}°C - przygotuj ciepłą odzież`
      );
    } else if (conditions.temperature > 30) {
      warnings.push(
        `🌡️ Wysoka temperatura: ${Math.round(
          conditions.temperature
        )}°C - zadbaj o nawodnienie`
      );
    }

    // Precipitation warnings (Requirement 5.2)
    if (conditions.precipitation > 0) {
      if (conditions.precipitation > 5) {
        warnings.push(
          `🌧️ Intensywne opady: ${conditions.precipitation}mm - przygotuj ochronę przeciwdeszczową`
        );
      } else {
        warnings.push(
          `🌦️ Możliwe opady: ${conditions.precipitation}mm - weź parasol`
        );
      }
    }

    // Wind warnings (Requirement 5.2)
    if (conditions.windSpeed > 10) {
      warnings.push(
        `💨 Silny wiatr: ${Math.round(
          conditions.windSpeed
        )}m/s - uwaga na sprzęt filmowy`
      );
    }

    // Severe weather warnings (Requirement 5.2)
    if (conditions.conditions.includes("thunderstorm")) {
      warnings.push(`⛈️ Burza - rozważ przełożenie zdjęć zewnętrznych`);
    }

    if (
      conditions.conditions.includes("fog") ||
      conditions.conditions.includes("mist")
    ) {
      warnings.push(`🌫️ Mgła - ograniczona widoczność, uwaga podczas jazdy`);
    }

    if (conditions.conditions.includes("snow")) {
      warnings.push(`❄️ Śnieg - trudne warunki drogowe, wyjedź wcześniej`);
    }

    return warnings;
  }

  /**
   * Store weather data in database
   * Requirement 5.7: Store weather data with relationships
   */
  async storeWeatherData(
    scheduleId: string,
    userId: string,
    weatherData: WeatherCacheData
  ): Promise<WeatherData> {
    try {
      const weatherInput: CreateWeatherDataInput = {
        forecastDate: new Date(weatherData.date),
        temperature: weatherData.temperature,
        description: weatherData.description,
        windSpeed: weatherData.windSpeed,
        precipitation: weatherData.precipitation,
        humidity: weatherData.humidity,
        warnings: weatherData.warnings,
        user: { connect: { id: userId } },
        schedule: { connect: { id: scheduleId } },
      };

      const storedWeather = await this.weatherRepository.create(weatherInput);

      logger.info("Weather data stored in database", {
        scheduleId,
        userId,
        weatherId: storedWeather.id,
      });

      return storedWeather;
    } catch (error) {
      logger.error("Failed to store weather data", {
        scheduleId,
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update existing weather data
   */
  async updateWeatherData(
    weatherId: string,
    weatherData: WeatherCacheData
  ): Promise<WeatherData> {
    try {
      const updatedWeather = await this.weatherRepository.update(weatherId, {
        temperature: weatherData.temperature,
        description: weatherData.description,
        windSpeed: weatherData.windSpeed,
        precipitation: weatherData.precipitation,
        humidity: weatherData.humidity,
        warnings: weatherData.warnings,
      });

      logger.info("Weather data updated", { weatherId });
      return updatedWeather;
    } catch (error) {
      logger.error("Failed to update weather data", {
        weatherId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Handle weather API errors with fallback strategies
   * Requirement 5.5: Handle weather API failures with cached data
   */
  private handleWeatherAPIError(
    error: axios.AxiosError,
    location: string,
    date?: string
  ): Error {
    if (error && error.response) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      switch (status) {
        case 401:
          return new Error("Weather API authentication failed - check API key");
        case 404:
          return new Error(`Location not found: ${location}`);
        case 429:
          return new Error("Weather API rate limit exceeded - try again later");
        case 500:
        case 502:
        case 503:
          return new Error("Weather API service temporarily unavailable");
        default:
          return new Error(`Weather API error: ${message}`);
      }
    }

    return new Error(
      `Weather service error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  /**
   * Check if weather data is stale
   */
  private isWeatherDataStale(
    weatherData: WeatherCacheData,
    maxAgeHours: number = 6
  ): boolean {
    const fetchedAt = new Date(weatherData.fetchedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff > maxAgeHours;
  }

  /**
   * Get weather data with fallback to cached data
   * Requirement 5.5: Use cached data when API is unavailable
   */
  async getWeatherWithFallback(
    location: string,
    date: string
  ): Promise<WeatherCacheData> {
    try {
      return await this.getWeatherForecast(location, date);
    } catch (error) {
      logger.warn("Weather API failed, attempting fallback", {
        location,
        date,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Try to get any cached data, even if stale
      const cachedData = await weatherCacheService.getCachedWeatherData(
        location,
        date
      );
      if (cachedData) {
        logger.info("Using stale cached weather data as fallback", {
          location,
          date,
        });
        return {
          ...cachedData,
          warnings: [
            ...cachedData.warnings,
            "⚠️ Dane pogodowe mogą być nieaktualne - API niedostępne",
          ],
        };
      }

      // Last resort: return basic fallback data
      logger.warn("No cached data available, using fallback weather data", {
        location,
        date,
      });
      return this.getFallbackWeatherData(location, date);
    }
  }

  /**
   * Generate fallback weather data when API is unavailable
   */
  private getFallbackWeatherData(
    location: string,
    date: string
  ): WeatherCacheData {
    return {
      temperature: 15, // Reasonable default
      description: "Dane niedostępne",
      windSpeed: 5,
      precipitation: 0,
      humidity: 60,
      warnings: [
        "⚠️ Dane pogodowe niedostępne - sprawdź prognozę ręcznie",
        "🌤️ Przygotuj się na różne warunki pogodowe",
      ],
      fetchedAt: new Date(),
      location,
      date,
    };
  }

  /**
   * Validate API configuration
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCurrentWeather("Warsaw");
      return true;
    } catch (error) {
      logger.error("Weather API connection test failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
}
