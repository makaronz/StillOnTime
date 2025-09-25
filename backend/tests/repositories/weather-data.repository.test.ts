import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { prisma } from "@/config/database";
import { WeatherData } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("WeatherDataRepository", () => {
  let weatherDataRepository: WeatherDataRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    weatherDataRepository = new WeatherDataRepository();
    jest.clearAllMocks();
  });

  describe("findByScheduleId", () => {
    it("should find weather data by schedule ID", async () => {
      const mockWeatherData: WeatherData = {
        id: "weather-1",
        forecastDate: new Date("2024-12-01"),
        temperature: 15.5,
        description: "Partly cloudy",
        windSpeed: 5.2,
        precipitation: 0,
        humidity: 65,
        warnings: ["Low temperature warning"],
        fetchedAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.weatherData.findUnique.mockResolvedValue(mockWeatherData);

      const result = await weatherDataRepository.findByScheduleId("schedule-1");

      expect(mockPrisma.weatherData.findUnique).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
      });
      expect(result).toEqual(mockWeatherData);
    });

    it("should return null if weather data not found", async () => {
      mockPrisma.weatherData.findUnique.mockResolvedValue(null);

      const result = await weatherDataRepository.findByScheduleId(
        "nonexistent"
      );

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find weather data by user ID with default limit", async () => {
      const mockWeatherData: WeatherData[] = [
        {
          id: "weather-1",
          forecastDate: new Date("2024-12-01"),
          temperature: 15.5,
          description: "Partly cloudy",
          windSpeed: 5.2,
          precipitation: 0,
          humidity: 65,
          warnings: null,
          fetchedAt: new Date(),
          userId: "user-1",
          scheduleId: "schedule-1",
        },
      ];

      mockPrisma.weatherData.findMany.mockResolvedValue(mockWeatherData);

      const result = await weatherDataRepository.findByUserId("user-1");

      expect(mockPrisma.weatherData.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { forecastDate: "desc" },
        take: 20,
        include: {
          schedule: {
            select: {
              location: true,
              shootingDate: true,
              sceneType: true,
            },
          },
        },
      });
      expect(result).toEqual(mockWeatherData);
    });
  });

  describe("findStaleWeatherData", () => {
    it("should find stale weather data with default hours", async () => {
      const mockStaleData = [
        {
          id: "weather-1",
          fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          schedule: {
            shootingDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          },
          user: { id: "user-1" },
        },
      ];

      mockPrisma.weatherData.findMany.mockResolvedValue(mockStaleData);

      const result = await weatherDataRepository.findStaleWeatherData();

      expect(mockPrisma.weatherData.findMany).toHaveBeenCalledWith({
        where: {
          fetchedAt: {
            lt: expect.any(Date),
          },
          schedule: {
            shootingDate: {
              gte: expect.any(Date),
            },
          },
        },
        include: {
          schedule: true,
          user: true,
        },
      });
      expect(result).toEqual(mockStaleData);
    });

    it("should find stale weather data with custom hours", async () => {
      const mockStaleData: any[] = [];

      mockPrisma.weatherData.findMany.mockResolvedValue(mockStaleData);

      const result = await weatherDataRepository.findStaleWeatherData(12);

      expect(mockPrisma.weatherData.findMany).toHaveBeenCalledWith({
        where: {
          fetchedAt: {
            lt: expect.any(Date),
          },
          schedule: {
            shootingDate: {
              gte: expect.any(Date),
            },
          },
        },
        include: {
          schedule: true,
          user: true,
        },
      });
      expect(result).toEqual(mockStaleData);
    });
  });

  describe("findWeatherWarnings", () => {
    it("should find weather data with warnings", async () => {
      const mockWeatherWithWarnings = [
        {
          id: "weather-1",
          warnings: ["High wind warning", "Rain warning"],
          schedule: {
            location: "Test Location",
            shootingDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            callTime: "08:00",
            sceneType: "EXT",
          },
        },
      ];

      mockPrisma.weatherData.findMany.mockResolvedValue(
        mockWeatherWithWarnings
      );

      const result = await weatherDataRepository.findWeatherWarnings("user-1");

      expect(mockPrisma.weatherData.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          warnings: {
            not: expect.any(Object),
          },
          schedule: {
            shootingDate: {
              gte: expect.any(Date),
            },
          },
        },
        include: {
          schedule: {
            select: {
              location: true,
              shootingDate: true,
              callTime: true,
              sceneType: true,
            },
          },
        },
        orderBy: {
          schedule: {
            shootingDate: "asc",
          },
        },
      });
      expect(result).toEqual(mockWeatherWithWarnings);
    });
  });

  describe("getWeatherStats", () => {
    it("should return weather statistics", async () => {
      const mockWeatherData = [
        {
          temperature: 20,
          precipitation: 0,
          warnings: null,
        },
        {
          temperature: 15,
          precipitation: 5.2,
          warnings: ["Rain warning"],
        },
        {
          temperature: null,
          precipitation: 0,
          warnings: null,
        },
      ];

      mockPrisma.weatherData.findMany.mockResolvedValue(mockWeatherData);

      const result = await weatherDataRepository.getWeatherStats("user-1");

      expect(result).toEqual({
        totalForecasts: 3,
        averageTemperature: 18, // (20 + 15) / 2 = 17.5, rounded to 18
        rainDays: 1,
        warningDays: 1,
      });
    });

    it("should return zero stats for user with no weather data", async () => {
      mockPrisma.weatherData.findMany.mockResolvedValue([]);

      const result = await weatherDataRepository.getWeatherStats("user-1");

      expect(result).toEqual({
        totalForecasts: 0,
        averageTemperature: 0,
        rainDays: 0,
        warningDays: 0,
      });
    });
  });

  describe("upsertWeatherData", () => {
    it("should upsert weather data", async () => {
      const weatherData = {
        forecastDate: new Date("2024-12-01"),
        temperature: 15.5,
        description: "Partly cloudy",
        windSpeed: 5.2,
        precipitation: 0,
        humidity: 65,
        warnings: ["Low temperature warning"],
      };

      const mockUpsertedData: WeatherData = {
        id: "weather-1",
        ...weatherData,
        fetchedAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.weatherData.upsert.mockResolvedValue(mockUpsertedData);

      const result = await weatherDataRepository.upsertWeatherData(
        "schedule-1",
        "user-1",
        weatherData
      );

      expect(mockPrisma.weatherData.upsert).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
        update: {
          ...weatherData,
          fetchedAt: expect.any(Date),
        },
        create: {
          ...weatherData,
          user: { connect: { id: "user-1" } },
          schedule: { connect: { id: "schedule-1" } },
          fetchedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUpsertedData);
    });
  });

  describe("cleanupOldWeatherData", () => {
    it("should cleanup old weather data with default retention", async () => {
      const mockResult = { count: 5 };

      mockPrisma.weatherData.deleteMany.mockResolvedValue(mockResult);

      const result = await weatherDataRepository.cleanupOldWeatherData();

      expect(mockPrisma.weatherData.deleteMany).toHaveBeenCalledWith({
        where: {
          fetchedAt: {
            lt: expect.any(Date),
          },
          schedule: {
            shootingDate: {
              lt: expect.any(Date),
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it("should cleanup old weather data with custom retention", async () => {
      const mockResult = { count: 3 };

      mockPrisma.weatherData.deleteMany.mockResolvedValue(mockResult);

      const result = await weatherDataRepository.cleanupOldWeatherData(30);

      expect(mockPrisma.weatherData.deleteMany).toHaveBeenCalledWith({
        where: {
          fetchedAt: {
            lt: expect.any(Date),
          },
          schedule: {
            shootingDate: {
              lt: expect.any(Date),
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
