import { Request, Response } from "express";
import { ScheduleController } from "@/controllers/schedule.controller";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { services } from "@/services";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";

// Mock dependencies
jest.mock("@/repositories/schedule-data.repository");
jest.mock("@/repositories/route-plan.repository");
jest.mock("@/repositories/weather-data.repository");
jest.mock("@/services");
jest.mock("@/utils/logger");

describe("ScheduleController", () => {
  let scheduleController: ScheduleController;
  let mockScheduleDataRepository: jest.Mocked<ScheduleDataRepository>;
  let mockRoutePlanRepository: jest.Mocked<RoutePlanRepository>;
  let mockWeatherDataRepository: jest.Mocked<WeatherDataRepository>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create controller instance
    scheduleController = new ScheduleController();

    // Mock repositories
    mockScheduleDataRepository =
      new ScheduleDataRepository() as jest.Mocked<ScheduleDataRepository>;
    mockRoutePlanRepository =
      new RoutePlanRepository() as jest.Mocked<RoutePlanRepository>;
    mockWeatherDataRepository =
      new WeatherDataRepository() as jest.Mocked<WeatherDataRepository>;

    // Mock request and response
    mockRequest = {
      user: { userId: "test-user-id" },
      params: {},
      query: {},
      body: {},
      path: "/api/schedule",
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Mock services
    (services as any) = {
      jobProcessor: {
        addRouteRecalculationJob: jest.fn(),
        addWeatherUpdateJob: jest.fn(),
      },
      weather: {
        getWeatherForecast: jest.fn(),
      },
    };
  });

  describe("getSchedules", () => {
    it("should return schedules with default pagination", async () => {
      const mockSchedules = [
        {
          id: "schedule-1",
          shootingDate: new Date("2024-01-15"),
          callTime: "08:00",
          location: "Test Location",
          sceneType: "EXT",
          createdAt: new Date(),
          updatedAt: new Date(),
          email: {
            id: "email-1",
            subject: "Test Schedule",
            sender: "test@example.com",
            receivedAt: new Date(),
          },
          routePlan: { id: "route-1" },
          weatherData: { id: "weather-1" },
          calendarEvent: { id: "event-1" },
        },
      ];

      mockScheduleDataRepository.findMany = jest
        .fn()
        .mockResolvedValue(mockSchedules);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getSchedules(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        schedules: expect.arrayContaining([
          expect.objectContaining({
            id: "schedule-1",
            hasRoutePlan: true,
            hasWeatherData: true,
            hasCalendarEvent: true,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 20,
          type: "all",
        },
      });
    });

    it("should return upcoming schedules when type is upcoming", async () => {
      mockRequest.query = { type: "upcoming" };
      const mockSchedules = [
        {
          id: "schedule-1",
          shootingDate: new Date("2024-12-15"),
          callTime: "08:00",
          location: "Test Location",
          sceneType: "EXT",
          createdAt: new Date(),
          updatedAt: new Date(),
          email: null,
          routePlan: null,
          weatherData: null,
          calendarEvent: null,
        },
      ];

      mockScheduleDataRepository.findUpcomingSchedules = jest
        .fn()
        .mockResolvedValue(mockSchedules);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getSchedules(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(
        mockScheduleDataRepository.findUpcomingSchedules
      ).toHaveBeenCalledWith("test-user-id", 20);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          schedules: expect.arrayContaining([
            expect.objectContaining({
              id: "schedule-1",
              hasRoutePlan: false,
              hasWeatherData: false,
              hasCalendarEvent: false,
            }),
          ]),
        })
      );
    });

    it("should handle errors gracefully", async () => {
      mockScheduleDataRepository.findMany = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getSchedules(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Internal Server Error",
          code: "SCHEDULES_FETCH_FAILED",
        })
      );
    });
  });

  describe("getScheduleById", () => {
    it("should return schedule with all relations", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const mockSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location",
        sceneType: "EXT",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: {
          id: "email-1",
          messageId: "msg-1",
          subject: "Test Schedule",
          sender: "test@example.com",
          receivedAt: new Date(),
        },
        routePlan: { id: "route-1" },
        weatherData: { id: "weather-1" },
        calendarEvent: { id: "event-1" },
      };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getScheduleById(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        schedule: expect.objectContaining({
          id: "schedule-1",
          email: expect.objectContaining({
            messageId: "msg-1",
          }),
        }),
      });
    });

    it("should return 404 when schedule not found", async () => {
      mockRequest.params = { scheduleId: "nonexistent" };
      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(null);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getScheduleById(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Not Found",
          code: "SCHEDULE_NOT_FOUND",
        })
      );
    });

    it("should return 403 when user doesn't own schedule", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const mockSchedule = {
        id: "schedule-1",
        userId: "other-user-id",
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location",
      };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.getScheduleById(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Forbidden",
          code: "ACCESS_DENIED",
        })
      );
    });
  });

  describe("updateSchedule", () => {
    it("should update schedule and trigger background jobs", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      mockRequest.body = {
        location: "New Location",
        callTime: "09:00",
        shootingDate: "2024-01-16",
      };

      const existingSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
        location: "Old Location",
      };

      const updatedSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
        location: "New Location",
        callTime: "09:00",
        shootingDate: new Date("2024-01-16"),
        updatedAt: new Date(),
        routePlan: null,
        weatherData: null,
        calendarEvent: null,
      };

      mockScheduleDataRepository.findById = jest
        .fn()
        .mockResolvedValue(existingSchedule);
      mockScheduleDataRepository.updateWithRelations = jest
        .fn()
        .mockResolvedValue(updatedSchedule);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      const mockRouteJob = { id: "route-job-1" };
      const mockWeatherJob = { id: "weather-job-1" };
      services.jobProcessor.addRouteRecalculationJob = jest
        .fn()
        .mockResolvedValue(mockRouteJob);
      services.jobProcessor.addWeatherUpdateJob = jest
        .fn()
        .mockResolvedValue(mockWeatherJob);

      await scheduleController.updateSchedule(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(
        services.jobProcessor.addRouteRecalculationJob
      ).toHaveBeenCalledWith("schedule-1");
      expect(services.jobProcessor.addWeatherUpdateJob).toHaveBeenCalledWith(
        "schedule-1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Schedule updated successfully",
        })
      );
    });

    it("should return 404 when schedule not found", async () => {
      mockRequest.params = { scheduleId: "nonexistent" };
      mockScheduleDataRepository.findById = jest.fn().mockResolvedValue(null);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.updateSchedule(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Not Found",
          code: "SCHEDULE_NOT_FOUND",
        })
      );
    });
  });

  describe("deleteSchedule", () => {
    it("should delete schedule successfully", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const existingSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
      };

      mockScheduleDataRepository.findById = jest
        .fn()
        .mockResolvedValue(existingSchedule);
      mockScheduleDataRepository.delete = jest
        .fn()
        .mockResolvedValue(undefined);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await scheduleController.deleteSchedule(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockScheduleDataRepository.delete).toHaveBeenCalledWith(
        "schedule-1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Schedule deleted successfully",
      });
    });
  });

  describe("getRoutePlan", () => {
    it("should return route plan for schedule", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const mockSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
      };
      const mockRoutePlan = {
        id: "route-1",
        scheduleId: "schedule-1",
        wakeUpTime: new Date(),
        departureTime: new Date(),
        arrivalTime: new Date(),
      };

      mockScheduleDataRepository.findById = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      mockRoutePlanRepository.findByScheduleId = jest
        .fn()
        .mockResolvedValue(mockRoutePlan);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;
      (scheduleController as any).routePlanRepository = mockRoutePlanRepository;

      await scheduleController.getRoutePlan(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        routePlan: mockRoutePlan,
      });
    });

    it("should return 404 when route plan not found", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const mockSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
      };

      mockScheduleDataRepository.findById = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      mockRoutePlanRepository.findByScheduleId = jest
        .fn()
        .mockResolvedValue(null);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;
      (scheduleController as any).routePlanRepository = mockRoutePlanRepository;

      await scheduleController.getRoutePlan(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Not Found",
          code: "ROUTE_PLAN_NOT_FOUND",
        })
      );
    });
  });

  describe("getWeatherData", () => {
    it("should return weather data for schedule", async () => {
      mockRequest.params = { scheduleId: "schedule-1" };
      const mockSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
      };
      const mockWeatherData = {
        id: "weather-1",
        scheduleId: "schedule-1",
        temperature: 15,
        description: "Partly cloudy",
        warnings: ["WIND_WARNING"],
      };

      mockScheduleDataRepository.findById = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      mockWeatherDataRepository.findByScheduleId = jest
        .fn()
        .mockResolvedValue(mockWeatherData);
      (scheduleController as any).scheduleDataRepository =
        mockScheduleDataRepository;
      (scheduleController as any).weatherDataRepository =
        mockWeatherDataRepository;

      await scheduleController.getWeatherData(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        weatherData: mockWeatherData,
      });
    });
  });

  describe("getWeatherForecast", () => {
    it("should return weather forecast for location and date", async () => {
      mockRequest.query = {
        location: "Warsaw, Poland",
        date: "2024-01-15",
      };

      const mockForecast = {
        temperature: 5,
        description: "Snow",
        windSpeed: 15,
        precipitation: 2.5,
        warnings: ["TEMPERATURE_WARNING", "PRECIPITATION_WARNING"],
      };

      services.weather.getWeatherForecast = jest
        .fn()
        .mockResolvedValue(mockForecast);

      await scheduleController.getWeatherForecast(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.weather.getWeatherForecast).toHaveBeenCalledWith(
        "Warsaw, Poland",
        "2024-01-15"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        forecast: mockForecast,
      });
    });

    it("should return 400 when location or date is missing", async () => {
      mockRequest.query = { location: "Warsaw, Poland" }; // Missing date

      await scheduleController.getWeatherForecast(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Bad Request",
          code: "MISSING_PARAMETERS",
        })
      );
    });
  });
});
