import { SummaryService } from "../../src/services/summary.service";
import { SummaryRepository } from "../../src/repositories/summary.repository";
import {
  ScheduleDataWithRelations,
  RoutePlan,
  WeatherData,
  User,
  SummaryGenerationOptions,
  GeneratedSummary,
} from "../../src/types";

// Mock dependencies
jest.mock("../../src/repositories/summary.repository");
jest.mock("../../src/utils/logger");

const mockSummaryRepository =
  new SummaryRepository() as jest.Mocked<SummaryRepository>;

describe("SummaryService", () => {
  let summaryService: SummaryService;
  let mockScheduleData: ScheduleDataWithRelations;
  let mockRoutePlan: RoutePlan;
  let mockWeatherData: WeatherData;
  let mockUser: User;

  beforeEach(() => {
    jest.clearAllMocks();

    summaryService = new SummaryService(mockSummaryRepository);

    // Mock data
    mockUser = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      accessToken: "token",
      refreshToken: "refresh",
      tokenExpiry: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRoutePlan = {
      id: "route-1",
      wakeUpTime: new Date("2024-01-15T05:00:00"),
      departureTime: new Date("2024-01-15T06:30:00"),
      arrivalTime: new Date("2024-01-15T07:45:00"),
      totalTravelMinutes: 75,
      routeSegments: [],
      buffers: {
        carChange: 15,
        parking: 10,
        entry: 10,
        traffic: 20,
        morningRoutine: 45,
      },
      calculatedAt: new Date(),
      userId: "user-1",
      scheduleId: "schedule-1",
    };

    mockWeatherData = {
      id: "weather-1",
      forecastDate: new Date("2024-01-15"),
      temperature: 15,
      description: "Partly cloudy",
      windSpeed: 5,
      precipitation: 0,
      humidity: 60,
      warnings: ["Strong wind warning"],
      fetchedAt: new Date(),
      userId: "user-1",
      scheduleId: "schedule-1",
    };

    mockScheduleData = {
      id: "schedule-1",
      shootingDate: new Date("2024-01-15"),
      callTime: "08:00",
      location: "Test Location",
      baseLocation: "Base Location",
      sceneType: "EXT",
      scenes: ["1", "2", "3"],
      safetyNotes: "Safety notes",
      equipment: ["Camera", "Lights", "Sound"],
      contacts: [
        { name: "Director", role: "Director", phone: "123456789" },
        { name: "Producer", role: "Producer", phone: "987654321" },
      ],
      notes: "Test notes",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      emailId: "email-1",
      user: mockUser,
      email: {} as any,
      routePlan: mockRoutePlan,
      weatherData: mockWeatherData,
      calendarEvent: null,
    } as unknown as ScheduleDataWithRelations;
  });

  describe("generateSummary", () => {
    it("should generate comprehensive summary in Polish", async () => {
      // Arrange
      const options: SummaryGenerationOptions = {
        language: "pl",
        includeWeather: true,
        includeRoute: true,
        includeContacts: true,
        includeEquipment: true,
        includeSafetyNotes: true,
      };

      // Act
      const result = await summaryService.generateSummary(
        mockScheduleData,
        options
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toContain("Plan Dnia Zdjęciowego");
      expect(result.content).toContain("Test Location");
      expect(result.content).toContain("08:00");
      expect(result.content).toContain("EXT");
      expect(result.htmlContent).toContain("<h1");
      expect(result.timeline).toHaveLength(5); // wake up, departure, arrival, call time, wrap
      expect(result.weatherSummary).toContain("15°C");
      expect(result.warnings).toContain("Strong wind warning");
      expect(result.metadata.language).toBe("pl");
      expect(result.metadata.location).toBe("Test Location");
    });

    it("should generate summary in English", async () => {
      // Arrange
      const options: SummaryGenerationOptions = {
        language: "en",
      };

      // Act
      const result = await summaryService.generateSummary(
        mockScheduleData,
        options
      );

      // Assert
      expect(result.content).toContain("Shooting Day Plan");
      expect(result.content).toContain("Location: Test Location");
      expect(result.metadata.language).toBe("en");
    });

    it("should generate timeline correctly", async () => {
      // Act
      const result = await summaryService.generateSummary(mockScheduleData);

      // Assert
      expect(result.timeline).toHaveLength(5);

      const timelineTypes = result.timeline.map((entry) => entry.type);
      expect(timelineTypes).toContain("wake_up");
      expect(timelineTypes).toContain("departure");
      expect(timelineTypes).toContain("arrival");
      expect(timelineTypes).toContain("call_time");
      expect(timelineTypes).toContain("wrap");

      // Check timeline is sorted by time
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i].time.getTime()).toBeGreaterThanOrEqual(
          result.timeline[i - 1].time.getTime()
        );
      }
    });

    it("should generate weather summary", async () => {
      // Act
      const result = await summaryService.generateSummary(mockScheduleData);

      // Assert
      expect(result.weatherSummary).toBeDefined();
      expect(result.weatherSummary).toContain("15°C");
      expect(result.weatherSummary).toContain("Partly cloudy");
      expect(result.weatherSummary).toContain("5 m/s");
      expect(result.weatherSummary).toContain("60%");
    });

    it("should collect warnings correctly", async () => {
      // Arrange
      const scheduleWithEarlyWakeUp = {
        ...mockScheduleData,
        routePlan: {
          ...mockRoutePlan,
          wakeUpTime: new Date("2024-01-15T03:00:00"), // Very early
          totalTravelMinutes: 150, // Long travel
        },
        weatherData: {
          ...mockWeatherData,
          temperature: -5, // Cold weather
        },
      };

      // Act
      const result = await summaryService.generateSummary(
        scheduleWithEarlyWakeUp
      );

      // Assert
      expect(result.warnings).toContain("Strong wind warning"); // From weather data
      expect(result.warnings.some((w) => w.includes("wczesna pobudka"))).toBe(
        true
      );
      expect(result.warnings.some((w) => w.includes("Długa podróż"))).toBe(
        true
      );
      expect(result.warnings.some((w) => w.includes("Zimna pogoda"))).toBe(
        true
      );
    });

    it("should handle missing route plan", async () => {
      // Arrange
      const scheduleWithoutRoute = {
        ...mockScheduleData,
        routePlan: null,
      };

      // Act
      const result = await summaryService.generateSummary(scheduleWithoutRoute);

      // Assert
      expect(result.timeline).toHaveLength(2); // Only call time and wrap
      expect(result.content).not.toContain("Harmonogram");
    });

    it("should handle missing weather data", async () => {
      // Arrange
      const scheduleWithoutWeather = {
        ...mockScheduleData,
        weatherData: null,
      };

      const options: SummaryGenerationOptions = {
        includeWeather: true,
      };

      // Act
      const result = await summaryService.generateSummary(
        scheduleWithoutWeather,
        options
      );

      // Assert
      expect(result.weatherSummary).toBeUndefined();
      expect(result.content).not.toContain("Pogoda");
    });

    it("should exclude sections based on options", async () => {
      // Arrange
      const options: SummaryGenerationOptions = {
        includeRoute: false,
        includeContacts: false,
        includeEquipment: false,
        includeSafetyNotes: false,
        includeWeather: false,
      };

      // Act
      const result = await summaryService.generateSummary(
        mockScheduleData,
        options
      );

      // Assert
      expect(result.content).not.toContain("Trasa i Czasy");
      expect(result.content).not.toContain("Kontakty");
      expect(result.content).not.toContain("Sprzęt");
      expect(result.content).not.toContain("Uwagi BHP");
      expect(result.weatherSummary).toBeUndefined();
    });

    it("should generate text-only format", async () => {
      // Arrange
      const options: SummaryGenerationOptions = {
        format: "text",
      };

      // Act
      const result = await summaryService.generateSummary(
        mockScheduleData,
        options
      );

      // Assert
      expect(result.htmlContent).toBe(result.content); // Should be same as text content
      expect(result.htmlContent).not.toContain("<h1");
    });
  });

  describe("saveSummary", () => {
    it("should save generated summary to database", async () => {
      // Arrange
      const generatedSummary: GeneratedSummary = {
        content: "Test content",
        htmlContent: "<div>Test HTML</div>",
        timeline: [
          {
            time: new Date("2024-01-15T05:00:00"),
            event: "Wake up",
            type: "wake_up",
          },
        ],
        weatherSummary: "15°C, sunny",
        warnings: ["Test warning"],
        metadata: {
          generatedAt: new Date(),
          language: "pl",
          scheduleDate: new Date("2024-01-15"),
          location: "Test Location",
          callTime: "08:00",
        },
      };

      const mockSavedSummary = {
        id: "summary-1",
        userId: "user-1",
        scheduleId: "schedule-1",
        language: "pl",
        content: "Test content",
        htmlContent: "<div>Test HTML</div>",
        timeline: generatedSummary.timeline,
        weatherSummary: "15°C, sunny",
        warnings: ["Test warning"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSummaryRepository.upsertByScheduleId.mockResolvedValue(
        mockSavedSummary
      );

      // Act
      const result = await summaryService.saveSummary(
        "user-1",
        "schedule-1",
        generatedSummary
      );

      // Assert
      expect(result).toEqual(mockSavedSummary);
      expect(mockSummaryRepository.upsertByScheduleId).toHaveBeenCalledWith(
        "schedule-1",
        expect.objectContaining({
          language: "pl",
          content: "Test content",
          htmlContent: "<div>Test HTML</div>",
        }),
        expect.objectContaining({
          language: "pl",
          content: "Test content",
          htmlContent: "<div>Test HTML</div>",
        })
      );
    });
  });

  describe("generateAndSaveSummary", () => {
    it("should generate and save summary in one operation", async () => {
      // Arrange
      const mockSavedSummary = {
        id: "summary-1",
        userId: "user-1",
        scheduleId: "schedule-1",
        language: "pl",
        content: expect.any(String),
        htmlContent: expect.any(String),
        timeline: expect.any(Array),
        weatherSummary: expect.any(String),
        warnings: expect.any(Array),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSummaryRepository.upsertByScheduleId.mockResolvedValue(
        mockSavedSummary
      );

      // Act
      const result = await summaryService.generateAndSaveSummary(
        mockScheduleData
      );

      // Assert
      expect(result).toEqual(mockSavedSummary);
      expect(mockSummaryRepository.upsertByScheduleId).toHaveBeenCalled();
    });
  });

  describe("getSummaryByScheduleId", () => {
    it("should retrieve summary by schedule ID", async () => {
      // Arrange
      const mockSummary = {
        id: "summary-1",
        userId: "user-1",
        scheduleId: "schedule-1",
        language: "pl",
        content: "Test content",
        htmlContent: "<div>Test HTML</div>",
        timeline: [],
        weatherSummary: "15°C",
        warnings: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSummaryRepository.findByScheduleId.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryService.getSummaryByScheduleId("schedule-1");

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockSummaryRepository.findByScheduleId).toHaveBeenCalledWith(
        "schedule-1"
      );
    });

    it("should return null if summary not found", async () => {
      // Arrange
      mockSummaryRepository.findByScheduleId.mockResolvedValue(null);

      // Act
      const result = await summaryService.getSummaryByScheduleId(
        "non-existent"
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getUserSummaries", () => {
    it("should retrieve user summaries with options", async () => {
      // Arrange
      const mockSummaries = [
        {
          id: "summary-1",
          userId: "user-1",
          scheduleId: "schedule-1",
          language: "pl",
          content: "Test content 1",
          htmlContent: "<div>Test HTML 1</div>",
          timeline: [],
          weatherSummary: "15°C",
          warnings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          schedule: mockScheduleData,
        },
      ];

      mockSummaryRepository.findWithSchedule.mockResolvedValue(mockSummaries);

      const options = {
        limit: 10,
        offset: 0,
        language: "pl",
        fromDate: new Date("2024-01-01"),
        toDate: new Date("2024-01-31"),
      };

      // Act
      const result = await summaryService.getUserSummaries("user-1", options);

      // Assert
      expect(result).toEqual(mockSummaries);
      expect(mockSummaryRepository.findWithSchedule).toHaveBeenCalledWith(
        "user-1",
        options
      );
    });
  });
});
