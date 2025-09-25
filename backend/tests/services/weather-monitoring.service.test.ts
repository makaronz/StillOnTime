import {
  WeatherMonitoringService,
  WeatherChange,
  WeatherImpact,
} from "@/services/weather-monitoring.service";
import { WeatherService } from "@/services/weather.service";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { WeatherCacheData } from "@/services/weather-cache.service";
import { ScheduleDataWithRelations } from "@/types";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("@/services/weather.service");
jest.mock("@/repositories/weather-data.repository");
jest.mock("@/repositories/schedule-data.repository");
jest.mock("@/utils/logger");

const MockedWeatherService = WeatherService as jest.MockedClass<
  typeof WeatherService
>;
const MockedWeatherDataRepository = WeatherDataRepository as jest.MockedClass<
  typeof WeatherDataRepository
>;
const MockedScheduleDataRepository = ScheduleDataRepository as jest.MockedClass<
  typeof ScheduleDataRepository
>;

describe("WeatherMonitoringService", () => {
  let weatherMonitoringService: WeatherMonitoringService;
  let mockWeatherService: jest.Mocked<WeatherService>;
  let mockWeatherRepository: jest.Mocked<WeatherDataRepository>;
  let mockScheduleRepository: jest.Mocked<ScheduleDataRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWeatherService = new MockedWeatherService(
      {} as any
    ) as jest.Mocked<WeatherService>;
    mockWeatherRepository =
      new MockedWeatherDataRepository() as jest.Mocked<WeatherDataRepository>;
    mockScheduleRepository =
      new MockedScheduleDataRepository() as jest.Mocked<ScheduleDataRepository>;

    weatherMonitoringService = new WeatherMonitoringService(
      mockWeatherService,
      mockWeatherRepository,
      mockScheduleRepository
    );
  });

  describe("updateWeatherForUpcomingSchedules", () => {
    it("should update weather for all upcoming schedules", async () => {
      const mockSchedules: ScheduleDataWithRelations[] = [
        {
          id: "schedule-1",
          location: "Warsaw",
          shootingDate: new Date("2024-01-15"),
          sceneType: "EXT",
          callTime: "08:00",
          baseLocation: null,
          scenes: null,
          safetyNotes: null,
          equipment: null,
          contacts: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          emailId: "email-1",
          user: {
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            googleId: "google-123",
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          email: {} as any,
          routePlan: null,
          weatherData: null,
          calendarEvent: null,
        },
      ];

      mockScheduleRepository.findUpcomingSchedulesInDateRange.mockResolvedValue(
        mockSchedules
      );
      mockWeatherService.getWeatherForecast.mockResolvedValue({
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      });
      mockWeatherService.storeWeatherData.mockResolvedValue({} as any);

      await weatherMonitoringService.updateWeatherForUpcomingSchedules();

      expect(
        mockScheduleRepository.findUpcomingSchedulesInDateRange
      ).toHaveBeenCalledWith(expect.any(Date), expect.any(Date));
      expect(mockWeatherService.getWeatherForecast).toHaveBeenCalledWith(
        "Warsaw",
        "2024-01-15"
      );
      expect(mockWeatherService.storeWeatherData).toHaveBeenCalledWith(
        "schedule-1",
        "user-1",
        expect.any(Object)
      );
    });

    it("should handle errors gracefully and continue processing other schedules", async () => {
      const mockSchedules: ScheduleDataWithRelations[] = [
        {
          id: "schedule-1",
          location: "Warsaw",
          shootingDate: new Date("2024-01-15"),
          sceneType: "EXT",
          callTime: "08:00",
          user: { id: "user-1" } as any,
        } as ScheduleDataWithRelations,
        {
          id: "schedule-2",
          location: "Krakow",
          shootingDate: new Date("2024-01-16"),
          sceneType: "INT",
          callTime: "10:00",
          user: { id: "user-2" } as any,
        } as ScheduleDataWithRelations,
      ];

      mockScheduleRepository.findUpcomingSchedulesInDateRange.mockResolvedValue(
        mockSchedules
      );
      mockWeatherService.getWeatherForecast
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          temperature: 15,
          description: "cloudy",
          windSpeed: 3,
          precipitation: 0,
          humidity: 70,
          warnings: [],
          fetchedAt: new Date(),
          location: "Krakow",
          date: "2024-01-16",
        });

      await weatherMonitoringService.updateWeatherForUpcomingSchedules();

      expect(mockWeatherService.getWeatherForecast).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        "Weather update completed",
        expect.objectContaining({
          total: 2,
          successful: 1,
          failed: 1,
        })
      );
    });
  });

  describe("updateWeatherForSchedule", () => {
    const mockSchedule: ScheduleDataWithRelations = {
      id: "schedule-1",
      location: "Warsaw",
      shootingDate: new Date("2024-01-15"),
      sceneType: "EXT",
      callTime: "08:00",
      user: { id: "user-1" } as any,
      weatherData: {
        id: "weather-1",
        temperature: 15,
        description: "cloudy",
        windSpeed: 3,
        precipitation: 0,
        humidity: 70,
        warnings: [],
        fetchedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      } as any,
    } as ScheduleDataWithRelations;

    it("should detect weather changes and create notification", async () => {
      const newWeatherData: WeatherCacheData = {
        temperature: 25, // Changed from 15
        description: "sunny", // Changed from cloudy
        windSpeed: 8, // Changed from 3
        precipitation: 2, // Changed from 0
        humidity: 60,
        warnings: ["🌡️ Wysoka temperatura: 25°C - zadbaj o nawodnienie"],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      mockWeatherService.getWeatherForecast.mockResolvedValue(newWeatherData);
      mockWeatherService.updateWeatherData.mockResolvedValue({} as any);

      const result = await weatherMonitoringService.updateWeatherForSchedule(
        mockSchedule
      );

      expect(result).toBeTruthy();
      expect(result?.significantChanges).toHaveLength(4); // temp, description, wind, precipitation
      expect(
        result?.significantChanges.some((c) => c.type === "temperature")
      ).toBe(true);
      expect(result?.significantChanges.some((c) => c.type === "wind")).toBe(
        true
      );
      expect(
        result?.significantChanges.some((c) => c.type === "precipitation")
      ).toBe(true);
      expect(
        result?.significantChanges.some((c) => c.type === "conditions")
      ).toBe(true);
    });

    it("should return null when no significant changes detected", async () => {
      const similarWeatherData: WeatherCacheData = {
        temperature: 16, // Small change from 15
        description: "cloudy", // Same
        windSpeed: 4, // Small change from 3
        precipitation: 0, // Same
        humidity: 70,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      mockWeatherService.getWeatherForecast.mockResolvedValue(
        similarWeatherData
      );
      mockWeatherService.updateWeatherData.mockResolvedValue({} as any);

      const result = await weatherMonitoringService.updateWeatherForSchedule(
        mockSchedule
      );

      expect(result).toBeNull();
    });

    it("should create new weather data when none exists", async () => {
      const scheduleWithoutWeather = {
        ...mockSchedule,
        weatherData: null,
      };

      const newWeatherData: WeatherCacheData = {
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      mockWeatherService.getWeatherForecast.mockResolvedValue(newWeatherData);
      mockWeatherService.storeWeatherData.mockResolvedValue({} as any);

      const result = await weatherMonitoringService.updateWeatherForSchedule(
        scheduleWithoutWeather
      );

      expect(mockWeatherService.storeWeatherData).toHaveBeenCalledWith(
        "schedule-1",
        "user-1",
        newWeatherData
      );
      expect(result).toBeNull(); // No changes since it's new data
    });
  });

  describe("weather change detection", () => {
    it("should detect temperature changes", () => {
      const previous: WeatherCacheData = {
        temperature: 10,
        description: "cloudy",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const current: WeatherCacheData = {
        ...previous,
        temperature: 20, // +10 degrees
      };

      // Access private method through any cast for testing
      const changes = (weatherMonitoringService as any).detectWeatherChanges(
        previous,
        current
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe("temperature");
      expect(changes[0].significance).toBe("high");
      expect(changes[0].changeAmount).toBe(10);
    });

    it("should detect precipitation changes", () => {
      const previous: WeatherCacheData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const current: WeatherCacheData = {
        ...previous,
        precipitation: 8, // Heavy rain
      };

      const changes = (weatherMonitoringService as any).detectWeatherChanges(
        previous,
        current
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe("precipitation");
      expect(changes[0].significance).toBe("high");
      expect(changes[0].changeAmount).toBe(8);
    });

    it("should detect wind speed changes", () => {
      const previous: WeatherCacheData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 2,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const current: WeatherCacheData = {
        ...previous,
        windSpeed: 12, // Strong wind
      };

      const changes = (weatherMonitoringService as any).detectWeatherChanges(
        previous,
        current
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe("wind");
      expect(changes[0].significance).toBe("high");
      expect(changes[0].changeAmount).toBe(10);
    });

    it("should detect weather condition changes", () => {
      const previous: WeatherCacheData = {
        temperature: 15,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const current: WeatherCacheData = {
        ...previous,
        description: "thunderstorm",
      };

      const changes = (weatherMonitoringService as any).detectWeatherChanges(
        previous,
        current
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe("conditions");
      expect(changes[0].significance).toBe("medium");
    });
  });

  describe("weather impact analysis", () => {
    const mockSchedule: ScheduleDataWithRelations = {
      id: "schedule-1",
      location: "Warsaw",
      shootingDate: new Date("2024-01-15"),
      sceneType: "EXT",
      callTime: "08:00",
    } as ScheduleDataWithRelations;

    it("should analyze route planning impact for severe weather", () => {
      const severeWeatherData: WeatherCacheData = {
        temperature: -10, // Very cold
        description: "heavy snow",
        windSpeed: 20, // Very strong wind
        precipitation: 15, // Heavy precipitation
        humidity: 80,
        warnings: ["❄️ Śnieg - trudne warunki drogowe, wyjedź wcześniej"],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const impact = (weatherMonitoringService as any).analyzeWeatherImpact(
        severeWeatherData,
        mockSchedule
      );

      expect(impact.routePlanning.affectsTravel).toBe(true);
      expect(impact.routePlanning.suggestedBufferIncrease).toBeGreaterThan(30);
      expect(impact.routePlanning.recommendations.length).toBeGreaterThan(0);
      expect(impact.overallRisk).toBe("high");
    });

    it("should analyze shooting conditions impact for exterior shoots", () => {
      const badWeatherData: WeatherCacheData = {
        temperature: 35, // Very hot
        description: "thunderstorm",
        windSpeed: 15, // Strong wind
        precipitation: 10, // Heavy rain
        humidity: 90,
        warnings: ["⛈️ Burza - rozważ przełożenie zdjęć zewnętrznych"],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const impact = (weatherMonitoringService as any).analyzeWeatherImpact(
        badWeatherData,
        mockSchedule
      );

      expect(impact.shootingConditions.severity).toBe("severe");
      expect(impact.shootingConditions.concerns).toContain(
        "Wysoka temperatura"
      );
      expect(impact.shootingConditions.concerns).toContain("Intensywne opady");
      expect(impact.shootingConditions.concerns).toContain("Silny wiatr");
      expect(impact.shootingConditions.concerns).toContain("Burza");
      expect(impact.overallRisk).toBe("critical");
    });

    it("should have minimal impact for interior shoots", () => {
      const interiorSchedule = {
        ...mockSchedule,
        sceneType: "INT" as const,
      };

      const badWeatherData: WeatherCacheData = {
        temperature: 35,
        description: "thunderstorm",
        windSpeed: 15,
        precipitation: 10,
        humidity: 90,
        warnings: ["⛈️ Burza - rozważ przełożenie zdjęć zewnętrznych"],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const impact = (weatherMonitoringService as any).analyzeWeatherImpact(
        badWeatherData,
        interiorSchedule
      );

      expect(impact.shootingConditions.severity).toBe("none");
      expect(impact.overallRisk).toBe("high"); // Still high due to route planning impact
    });

    it("should calculate low risk for good weather", () => {
      const goodWeatherData: WeatherCacheData = {
        temperature: 20,
        description: "sunny",
        windSpeed: 5,
        precipitation: 0,
        humidity: 60,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2024-01-15",
      };

      const impact = (weatherMonitoringService as any).analyzeWeatherImpact(
        goodWeatherData,
        mockSchedule
      );

      expect(impact.routePlanning.affectsTravel).toBe(false);
      expect(impact.shootingConditions.severity).toBe("none");
      expect(impact.overallRisk).toBe("low");
    });
  });

  describe("processWeatherChangeNotifications", () => {
    it("should process multiple notifications", async () => {
      const notifications = [
        {
          scheduleId: "schedule-1",
          location: "Warsaw",
          date: "2024-01-15",
          previousWeather: {} as WeatherCacheData,
          currentWeather: {} as WeatherCacheData,
          significantChanges: [],
          impactAnalysis: { overallRisk: "medium" } as WeatherImpact,
          timestamp: new Date(),
        },
        {
          scheduleId: "schedule-2",
          location: "Krakow",
          date: "2024-01-16",
          previousWeather: {} as WeatherCacheData,
          currentWeather: {} as WeatherCacheData,
          significantChanges: [],
          impactAnalysis: { overallRisk: "high" } as WeatherImpact,
          timestamp: new Date(),
        },
      ];

      await weatherMonitoringService.processWeatherChangeNotifications(
        notifications
      );

      expect(logger.info).toHaveBeenCalledWith(
        "Processing 2 weather change notifications"
      );
    });

    it("should handle empty notifications array", async () => {
      await weatherMonitoringService.processWeatherChangeNotifications([]);

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Processing")
      );
    });
  });

  describe("createWeatherChangeMessage", () => {
    it("should create comprehensive notification message", () => {
      const notification = {
        scheduleId: "schedule-1",
        location: "Warsaw",
        date: "2024-01-15",
        previousWeather: {} as WeatherCacheData,
        currentWeather: {} as WeatherCacheData,
        significantChanges: [
          {
            type: "temperature" as const,
            field: "temperature",
            previousValue: 15,
            currentValue: 25,
            changeAmount: 10,
            significance: "high" as const,
            description: "Temperatura wzrosła o 10°C",
          },
        ],
        impactAnalysis: {
          routePlanning: {
            affectsTravel: true,
            suggestedBufferIncrease: 15,
            recommendations: ["Unikaj podróży w najgorętszych godzinach"],
          },
          shootingConditions: {
            severity: "moderate" as const,
            concerns: ["Wysoka temperatura"],
            recommendations: ["Zapewnij cień i nawodnienie dla ekipy"],
          },
          overallRisk: "medium" as const,
        },
        timestamp: new Date(),
      };

      const message = (
        weatherMonitoringService as any
      ).createWeatherChangeMessage(notification);

      expect(message).toContain("🌤️ Zmiana pogody dla zdjęć w Warsaw");
      expect(message).toContain("Temperatura wzrosła o 10°C");
      expect(message).toContain("Wysoka temperatura");
      expect(message).toContain("Zapewnij cień i nawodnienie dla ekipy");
      expect(message).toContain("Sugerowany dodatkowy czas: 15 minut");
      expect(message).toContain("🟡 Ogólne ryzyko: MEDIUM");
    });
  });
});
