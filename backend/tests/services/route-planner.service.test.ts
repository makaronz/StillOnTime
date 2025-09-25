import { RoutePlannerService } from "../../src/services/route-planner.service";
import { GoogleMapsService } from "../../src/services/google-maps.service";
import { UserConfigRepository } from "../../src/repositories/user-config.repository";
import { RoutePlanRepository } from "../../src/repositories/route-plan.repository";
import { logger } from "../../src/utils/logger";
import { ScheduleData, UserConfig, RouteResult } from "../../src/types";

// Mock dependencies
jest.mock("../../src/services/google-maps.service");
jest.mock("../../src/repositories/user-config.repository");
jest.mock("../../src/repositories/route-plan.repository");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const MockedGoogleMapsService = GoogleMapsService as jest.MockedClass<
  typeof GoogleMapsService
>;
const MockedUserConfigRepository = UserConfigRepository as jest.MockedClass<
  typeof UserConfigRepository
>;
const MockedRoutePlanRepository = RoutePlanRepository as jest.MockedClass<
  typeof RoutePlanRepository
>;

describe("RoutePlannerService", () => {
  let routePlannerService: RoutePlannerService;
  let mockGoogleMapsService: jest.Mocked<GoogleMapsService>;
  let mockUserConfigRepository: jest.Mocked<UserConfigRepository>;
  let mockRoutePlanRepository: jest.Mocked<RoutePlanRepository>;

  const mockScheduleData: ScheduleData = {
    id: "schedule-1",
    shootingDate: new Date("2024-01-15T00:00:00Z"),
    callTime: "08:00",
    location: "Film Studio, Warsaw",
    baseLocation: null,
    sceneType: "EXT",
    scenes: null,
    safetyNotes: null,
    equipment: null,
    contacts: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
    emailId: "email-1",
  };

  const mockUserConfig: UserConfig = {
    id: "config-1",
    homeAddress: "Home Address, Warsaw",
    panavisionAddress: "Panavision, Warsaw",
    bufferCarChange: 15,
    bufferParking: 10,
    bufferEntry: 10,
    bufferTraffic: 20,
    bufferMorningRoutine: 45,
    notificationEmail: true,
    notificationSMS: false,
    notificationPush: true,
    userId: "user-1",
  };

  const mockRouteResult: RouteResult = {
    distance: "25.5 km",
    duration: "35min",
    durationInTraffic: "45min",
    steps: [
      {
        instruction: "Head north on Main Street",
        distance: "1.2 km",
        duration: "3min",
      },
      {
        instruction: "Turn right onto Highway 1",
        distance: "24.3 km",
        duration: "32min",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGoogleMapsService =
      new MockedGoogleMapsService() as jest.Mocked<GoogleMapsService>;
    mockUserConfigRepository =
      new MockedUserConfigRepository() as jest.Mocked<UserConfigRepository>;
    mockRoutePlanRepository =
      new MockedRoutePlanRepository() as jest.Mocked<RoutePlanRepository>;

    // Mock constructor calls
    MockedGoogleMapsService.mockImplementation(() => mockGoogleMapsService);
    MockedUserConfigRepository.mockImplementation(
      () => mockUserConfigRepository
    );
    MockedRoutePlanRepository.mockImplementation(() => mockRoutePlanRepository);

    routePlannerService = new RoutePlannerService();
  });

  describe("calculateRoutePlan", () => {
    beforeEach(() => {
      mockUserConfigRepository.findByUserId.mockResolvedValue(mockUserConfig);
      mockGoogleMapsService.calculateStillOnTimeRoute.mockResolvedValue([
        mockRouteResult,
      ]);
    });

    it("should calculate route plan successfully", async () => {
      const result = await routePlannerService.calculateRoutePlan(
        mockScheduleData,
        "user-1"
      );

      expect(result).toEqual({
        wakeUpTime: new Date("2024-01-15T05:35:00Z"), // 8:00 - 2h 25min (45min travel + 100min buffers)
        departureTime: new Date("2024-01-15T07:15:00Z"), // 8:00 - 45min travel
        arrivalTime: new Date("2024-01-15T08:00:00Z"), // Call time
        totalTravelMinutes: 145, // 45min travel + 100min buffers
        routeSegments: expect.any(Array),
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        warnings: expect.any(Array),
        alternatives: undefined,
      });

      expect(mockUserConfigRepository.findByUserId).toHaveBeenCalledWith(
        "user-1"
      );
      expect(
        mockGoogleMapsService.calculateStillOnTimeRoute
      ).toHaveBeenCalledWith(
        mockUserConfig.homeAddress,
        mockUserConfig.panavisionAddress,
        mockScheduleData.location,
        expect.any(Date)
      );

      expect(logger.info).toHaveBeenCalledWith(
        "Starting route calculation",
        expect.objectContaining({
          scheduleId: mockScheduleData.id,
          userId: "user-1",
        })
      );
    });

    it("should throw error if user config not found", async () => {
      mockUserConfigRepository.findByUserId.mockResolvedValue(null);

      await expect(
        routePlannerService.calculateRoutePlan(mockScheduleData, "user-1")
      ).rejects.toThrow(
        "User configuration not found. Please set up your addresses and preferences."
      );
    });

    it("should throw error if no routes found", async () => {
      mockGoogleMapsService.calculateStillOnTimeRoute.mockResolvedValue([]);

      await expect(
        routePlannerService.calculateRoutePlan(mockScheduleData, "user-1")
      ).rejects.toThrow("No routes found for the specified addresses");
    });

    it("should generate warning for very early wake-up time", async () => {
      const earlySchedule = {
        ...mockScheduleData,
        callTime: "04:00", // Very early call time
      };

      const result = await routePlannerService.calculateRoutePlan(
        earlySchedule,
        "user-1"
      );

      expect(
        result.warnings.some(
          (warning) =>
            warning.includes("Czas pobudki") &&
            warning.includes("jest bardzo wczesny")
        )
      ).toBe(true);
    });

    it("should generate warning for excessive travel time", async () => {
      const longRouteResult: RouteResult = {
        ...mockRouteResult,
        duration: "3h 30min", // Very long travel time
        durationInTraffic: "4h 0min",
      };

      mockGoogleMapsService.calculateStillOnTimeRoute.mockResolvedValue([
        longRouteResult,
      ]);

      const result = await routePlannerService.calculateRoutePlan(
        mockScheduleData,
        "user-1"
      );

      expect(
        result.warnings.some(
          (warning) =>
            warning.includes("Całkowity czas podróży") &&
            warning.includes("jest bardzo długi")
        )
      ).toBe(true);
    });

    it("should handle invalid call time format", async () => {
      const invalidSchedule = {
        ...mockScheduleData,
        callTime: "25:70", // Invalid time format
      };

      await expect(
        routePlannerService.calculateRoutePlan(invalidSchedule, "user-1")
      ).rejects.toThrow(
        "Invalid call time format: 25:70. Expected HH:MM format."
      );
    });

    it("should handle Google Maps service errors", async () => {
      mockGoogleMapsService.calculateStillOnTimeRoute.mockRejectedValue(
        new Error("Google Maps API error")
      );

      await expect(
        routePlannerService.calculateRoutePlan(mockScheduleData, "user-1")
      ).rejects.toThrow("Google Maps API error");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to calculate route plan",
        expect.objectContaining({
          error: "Google Maps API error",
          scheduleId: mockScheduleData.id,
          userId: "user-1",
        })
      );
    });
  });

  describe("saveRoutePlan", () => {
    it("should save route plan to database", async () => {
      const mockRouteCalculation = {
        wakeUpTime: new Date("2024-01-15T06:00:00Z"),
        departureTime: new Date("2024-01-15T07:15:00Z"),
        arrivalTime: new Date("2024-01-15T08:00:00Z"),
        totalTravelMinutes: 120,
        routeSegments: [],
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        warnings: [],
      };

      const mockSavedRoutePlan = {
        id: "route-plan-1",
        ...mockRouteCalculation,
        calculatedAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockRoutePlanRepository.create.mockResolvedValue(
        mockSavedRoutePlan as any
      );

      const result = await routePlannerService.saveRoutePlan(
        mockRouteCalculation,
        "schedule-1",
        "user-1"
      );

      expect(result).toEqual(mockSavedRoutePlan);
      expect(mockRoutePlanRepository.create).toHaveBeenCalledWith({
        wakeUpTime: mockRouteCalculation.wakeUpTime,
        departureTime: mockRouteCalculation.departureTime,
        arrivalTime: mockRouteCalculation.arrivalTime,
        totalTravelMinutes: mockRouteCalculation.totalTravelMinutes,
        routeSegments: mockRouteCalculation.routeSegments,
        buffers: mockRouteCalculation.buffers,
        user: { connect: { id: "user-1" } },
        schedule: { connect: { id: "schedule-1" } },
      });
    });
  });

  describe("getRouteRecommendations", () => {
    it("should return route recommendations", async () => {
      mockUserConfigRepository.findByUserId.mockResolvedValue(mockUserConfig);

      const result = await routePlannerService.getRouteRecommendations(
        "user-1",
        "Test Location"
      );

      expect(result).toEqual({
        recommendedBuffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        averageTravelTime: 60,
        bestDepartureTime: "06:00",
      });
    });

    it("should return default recommendations if user config not found", async () => {
      mockUserConfigRepository.findByUserId.mockResolvedValue(null);

      const result = await routePlannerService.getRouteRecommendations(
        "user-1",
        "Test Location"
      );

      expect(result.recommendedBuffers).toEqual({
        carChange: 15,
        parking: 10,
        entry: 10,
        traffic: 20,
        morningRoutine: 45,
      });
    });
  });

  describe("private methods", () => {
    describe("parseCallTime", () => {
      it("should parse valid call time", () => {
        const service = new RoutePlannerService();
        const parseMethod = (service as any).parseCallTime.bind(service);

        const shootingDate = new Date("2024-01-15T00:00:00Z");
        const result = parseMethod(shootingDate, "08:30");

        expect(result.callTime).toEqual(new Date("2024-01-15T08:30:00.000Z"));
        expect(result.departureTime).toEqual(
          new Date("2024-01-15T08:30:00.000Z")
        );
      });

      it("should handle edge cases for call time", () => {
        const service = new RoutePlannerService();
        const parseMethod = (service as any).parseCallTime.bind(service);

        const shootingDate = new Date("2024-01-15T00:00:00Z");

        // Test midnight
        const midnight = parseMethod(shootingDate, "00:00");
        expect(midnight.callTime.getUTCHours()).toBe(0);
        expect(midnight.callTime.getUTCMinutes()).toBe(0);

        // Test late evening
        const evening = parseMethod(shootingDate, "23:59");
        expect(evening.callTime.getUTCHours()).toBe(23);
        expect(evening.callTime.getUTCMinutes()).toBe(59);
      });
    });

    describe("extractTravelTimeMinutes", () => {
      it("should extract travel time from duration strings", () => {
        const service = new RoutePlannerService();
        const extractMethod = (service as any).extractTravelTimeMinutes.bind(
          service
        );

        expect(extractMethod({ duration: "45min" })).toBe(45);
        expect(extractMethod({ duration: "1h 30min" })).toBe(90);
        expect(extractMethod({ duration: "2h 0min" })).toBe(120);
        expect(
          extractMethod({ durationInTraffic: "1h 15min", duration: "1h 0min" })
        ).toBe(75);
      });
    });

    describe("calculateTotalBuffers", () => {
      it("should calculate total buffer time", () => {
        const service = new RoutePlannerService();
        const calculateMethod = (service as any).calculateTotalBuffers.bind(
          service
        );

        const buffers = {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        };

        expect(calculateMethod(buffers)).toBe(100);
      });
    });

    describe("generateWarnings", () => {
      it("should generate appropriate warnings", () => {
        const service = new RoutePlannerService();
        const generateMethod = (service as any).generateWarnings.bind(service);

        const earlyWakeUp = new Date("2024-01-15T03:30:00Z"); // 3:30 AM
        const longTravel = 200; // 3h 20min
        const buffers = {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 15, // Low traffic buffer
          morningRoutine: 45,
        };

        const warnings = generateMethod(earlyWakeUp, longTravel, buffers);

        expect(warnings.some((w: string) => w.includes("bardzo wczesny"))).toBe(
          true
        );
        expect(warnings.some((w: string) => w.includes("bardzo długi"))).toBe(
          true
        );
        expect(
          warnings.some((w: string) => w.includes("niewystarczający"))
        ).toBe(true);
      });
    });
  });
});
