import { Request, Response } from "express";
import { CalendarController } from "@/controllers/calendar.controller";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { UserConfigRepository } from "@/repositories/user-config.repository";
import { services } from "@/services";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";

// Mock dependencies
jest.mock("@/repositories/schedule-data.repository");
jest.mock("@/repositories/user-config.repository");
jest.mock("@/services");
jest.mock("@/utils/logger");

describe("CalendarController", () => {
  let calendarController: CalendarController;
  let mockScheduleDataRepository: jest.Mocked<ScheduleDataRepository>;
  let mockUserConfigRepository: jest.Mocked<UserConfigRepository>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create controller instance
    calendarController = new CalendarController();

    // Mock repositories
    mockScheduleDataRepository =
      new ScheduleDataRepository() as jest.Mocked<ScheduleDataRepository>;
    mockUserConfigRepository =
      new UserConfigRepository() as jest.Mocked<UserConfigRepository>;

    // Mock request and response
    mockRequest = {
      user: { userId: "test-user-id", email: "test@example.com" },
      params: {},
      query: {},
      body: {},
      path: "/api/calendar",
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Mock services
    (services as any) = {
      calendarManager: {
        getCalendarEvents: jest.fn(),
        createCalendarEvent: jest.fn(),
        updateCalendarEvent: jest.fn(),
        deleteCalendarEvent: jest.fn(),
        updateCalendarEventFromSchedule: jest.fn(),
        getCalendarList: jest.fn(),
      },
      oauth2: {
        getOAuthStatus: jest.fn(),
      },
    };
  });

  describe("getCalendarEvents", () => {
    it("should return calendar events with default parameters", async () => {
      const mockEvents = [
        {
          id: "event-1",
          summary: "StillOnTime — Dzień zdjęciowy (Test Location)",
          description: "Shooting schedule details",
          location: "Test Location",
          start: { dateTime: "2024-01-15T08:00:00Z" },
          end: { dateTime: "2024-01-15T18:00:00Z" },
          attendees: [
            {
              email: "test@example.com",
              displayName: "Test User",
              responseStatus: "accepted",
            },
          ],
          reminders: { useDefault: false },
          created: "2024-01-14T10:00:00Z",
          updated: "2024-01-14T10:00:00Z",
        },
      ];

      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockResolvedValue(mockEvents);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.getCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledWith(
        "test-user-id",
        {
          timeMin: undefined,
          timeMax: undefined,
          maxResults: 50,
        }
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        events: [
          {
            id: "event-1",
            title: "StillOnTime — Dzień zdjęciowy (Test Location)",
            description: "Shooting schedule details",
            location: "Test Location",
            startTime: "2024-01-15T08:00:00Z",
            endTime: "2024-01-15T18:00:00Z",
            attendees: [
              {
                email: "test@example.com",
                displayName: "Test User",
                responseStatus: "accepted",
              },
            ],
            reminders: { useDefault: false },
            created: "2024-01-14T10:00:00Z",
            updated: "2024-01-14T10:00:00Z",
          },
        ],
      });
    });

    it("should handle date range filtering", async () => {
      mockRequest.query = {
        startDate: "2024-01-15T00:00:00Z",
        endDate: "2024-01-16T00:00:00Z",
        maxResults: "10",
      };

      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockResolvedValue([]);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.getCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledWith(
        "test-user-id",
        {
          timeMin: new Date("2024-01-15T00:00:00Z"),
          timeMax: new Date("2024-01-16T00:00:00Z"),
          maxResults: 10,
        }
      );
    });

    it("should handle errors gracefully", async () => {
      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockRejectedValue(new Error("Calendar API error"));
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.getCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Internal Server Error",
          code: "CALENDAR_EVENTS_FAILED",
        })
      );
    });
  });

  describe("createCalendarEvent", () => {
    it("should create calendar event for schedule", async () => {
      mockRequest.body = { scheduleId: "schedule-1" };

      const mockSchedule = {
        id: "schedule-1",
        userId: "test-user-id",
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location",
        routePlan: {
          id: "route-1",
          wakeUpTime: new Date("2024-01-15T05:00:00Z"),
          departureTime: new Date("2024-01-15T06:30:00Z"),
        },
        weatherData: {
          id: "weather-1",
          temperature: 15,
          description: "Partly cloudy",
        },
      };

      const mockCalendarEvent = {
        id: "cal-event-1",
        calendarEventId: "google-event-1",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-01-15T06:30:00Z"),
        endTime: new Date("2024-01-15T18:00:00Z"),
        description: "Shooting schedule with route and weather info",
        location: "Test Location",
      };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      services.calendarManager.createCalendarEvent = jest
        .fn()
        .mockResolvedValue(mockCalendarEvent);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.createCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.createCalendarEvent).toHaveBeenCalledWith(
        mockSchedule,
        mockSchedule.routePlan,
        mockSchedule.weatherData,
        "test-user-id"
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        calendarEvent: {
          id: "cal-event-1",
          calendarEventId: "google-event-1",
          title: "StillOnTime — Dzień zdjęciowy (Test Location)",
          startTime: mockCalendarEvent.startTime,
          endTime: mockCalendarEvent.endTime,
          description: "Shooting schedule with route and weather info",
          location: "Test Location",
        },
        message: "Calendar event created successfully",
      });
    });

    it("should return 400 when schedule ID is missing", async () => {
      mockRequest.body = {}; // Missing scheduleId

      await calendarController.createCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Bad Request",
          code: "MISSING_SCHEDULE_ID",
        })
      );
    });

    it("should return 404 when schedule not found", async () => {
      mockRequest.body = { scheduleId: "nonexistent" };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(null);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.createCalendarEvent(
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
      mockRequest.body = { scheduleId: "schedule-1" };

      const mockSchedule = {
        id: "schedule-1",
        userId: "other-user-id", // Different user
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location",
      };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValue(mockSchedule);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.createCalendarEvent(
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

  describe("updateCalendarEvent", () => {
    it("should update calendar event successfully", async () => {
      mockRequest.params = { eventId: "google-event-1" };
      mockRequest.body = {
        title: "Updated Event Title",
        description: "Updated description",
      };

      const mockUpdatedEvent = {
        id: "google-event-1",
        summary: "Updated Event Title",
        description: "Updated description",
        location: "Test Location",
        start: { dateTime: "2024-01-15T08:00:00Z" },
        end: { dateTime: "2024-01-15T18:00:00Z" },
        updated: "2024-01-14T12:00:00Z",
      };

      services.calendarManager.updateCalendarEvent = jest
        .fn()
        .mockResolvedValue(mockUpdatedEvent);

      await calendarController.updateCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.updateCalendarEvent).toHaveBeenCalledWith(
        "google-event-1",
        mockRequest.body,
        "test-user-id"
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        event: {
          id: "google-event-1",
          title: "Updated Event Title",
          description: "Updated description",
          location: "Test Location",
          startTime: "2024-01-15T08:00:00Z",
          endTime: "2024-01-15T18:00:00Z",
          updated: "2024-01-14T12:00:00Z",
        },
        message: "Calendar event updated successfully",
      });
    });
  });

  describe("deleteCalendarEvent", () => {
    it("should delete calendar event successfully", async () => {
      mockRequest.params = { eventId: "google-event-1" };

      services.calendarManager.deleteCalendarEvent = jest
        .fn()
        .mockResolvedValue(undefined);

      await calendarController.deleteCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.deleteCalendarEvent).toHaveBeenCalledWith(
        "google-event-1",
        "test-user-id"
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Calendar event deleted successfully",
      });
    });
  });

  describe("getSyncStatus", () => {
    it("should return calendar sync status", async () => {
      const mockOAuthStatus = {
        isAuthenticated: true,
        scopes: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar",
        ],
        expiresAt: new Date("2024-01-16T00:00:00Z"),
        needsReauth: false,
      };

      const mockEvents = [
        { id: "event-1", summary: "Test Event 1" },
        { id: "event-2", summary: "Test Event 2" },
      ];

      services.oauth2.getOAuthStatus = jest
        .fn()
        .mockResolvedValue(mockOAuthStatus);
      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockResolvedValue(mockEvents);

      await calendarController.getSyncStatus(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        syncStatus: {
          isConnected: true,
          hasCalendarAccess: true,
          lastSync: expect.any(String),
          recentEventsCount: 2,
          scopes: mockOAuthStatus.scopes,
        },
      });
    });

    it("should handle missing calendar access", async () => {
      const mockOAuthStatus = {
        isAuthenticated: true,
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"], // No calendar scope
        expiresAt: new Date("2024-01-16T00:00:00Z"),
        needsReauth: false,
      };

      services.oauth2.getOAuthStatus = jest
        .fn()
        .mockResolvedValue(mockOAuthStatus);

      await calendarController.getSyncStatus(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        syncStatus: {
          isConnected: false,
          hasCalendarAccess: false,
          lastSync: expect.any(String),
          recentEventsCount: 0,
          scopes: mockOAuthStatus.scopes,
        },
      });
    });
  });

  describe("syncCalendarEvents", () => {
    it("should sync calendar events for multiple schedules", async () => {
      mockRequest.body = { scheduleIds: ["schedule-1", "schedule-2"] };

      const mockSchedule1 = {
        id: "schedule-1",
        userId: "test-user-id",
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Location 1",
        calendarEvent: null, // No existing event
        routePlan: { id: "route-1" },
        weatherData: { id: "weather-1" },
      };

      const mockSchedule2 = {
        id: "schedule-2",
        userId: "test-user-id",
        shootingDate: new Date("2024-01-16"),
        callTime: "09:00",
        location: "Location 2",
        calendarEvent: { id: "cal-event-2", calendarEventId: "google-event-2" }, // Existing event
        routePlan: { id: "route-2" },
        weatherData: { id: "weather-2" },
      };

      const mockNewEvent = {
        id: "cal-event-1",
        calendarEventId: "google-event-1",
        title: "New Event",
      };

      const mockUpdatedEvent = {
        id: "cal-event-2",
        calendarEventId: "google-event-2",
        title: "Updated Event",
      };

      mockScheduleDataRepository.findWithRelations = jest
        .fn()
        .mockResolvedValueOnce(mockSchedule1)
        .mockResolvedValueOnce(mockSchedule2);

      services.calendarManager.createCalendarEvent = jest
        .fn()
        .mockResolvedValue(mockNewEvent);
      services.calendarManager.updateCalendarEventFromSchedule = jest
        .fn()
        .mockResolvedValue(mockUpdatedEvent);

      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.syncCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(services.calendarManager.createCalendarEvent).toHaveBeenCalledWith(
        mockSchedule1,
        mockSchedule1.routePlan,
        mockSchedule1.weatherData,
        "test-user-id"
      );

      expect(
        services.calendarManager.updateCalendarEventFromSchedule
      ).toHaveBeenCalledWith(
        "google-event-2",
        mockSchedule2,
        mockSchedule2.routePlan,
        mockSchedule2.weatherData,
        "test-user-id"
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        results: [
          {
            scheduleId: "schedule-1",
            success: true,
            eventId: "google-event-1",
          },
          {
            scheduleId: "schedule-2",
            success: true,
            eventId: "google-event-2",
          },
        ],
        summary: {
          total: 2,
          successful: 2,
          failed: 0,
        },
        message: "Calendar sync completed: 2/2 events synced",
      });
    });

    it("should return 400 when schedule IDs are missing", async () => {
      mockRequest.body = {}; // Missing scheduleIds

      await calendarController.syncCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Bad Request",
          code: "MISSING_SCHEDULE_IDS",
        })
      );
    });
  });

  describe("getCalendarSettings", () => {
    it("should return calendar settings with available calendars", async () => {
      const mockUserConfig = {
        id: "config-1",
        userId: "test-user-id",
        homeAddress: "Home Address",
        panavisionAddress: "Panavision Address",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
      };

      const mockCalendars = [
        {
          id: "primary",
          summary: "Primary Calendar",
          description: "Main calendar",
          primary: true,
          accessRole: "owner",
        },
        {
          id: "work-calendar",
          summary: "Work Calendar",
          description: "Work events",
          primary: false,
          accessRole: "writer",
        },
      ];

      mockUserConfigRepository.getConfigWithDefaults = jest
        .fn()
        .mockResolvedValue(mockUserConfig);
      services.calendarManager.getCalendarList = jest
        .fn()
        .mockResolvedValue(mockCalendars);
      (calendarController as any).userConfigRepository =
        mockUserConfigRepository;

      await calendarController.getCalendarSettings(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        settings: {
          defaultCalendarId: "primary",
          reminderSettings: {
            wakeUpReminders: [-10, 0, 5],
            departureReminders: [-60, -15, 0],
            eventReminders: [-720, -180, -60, 0],
          },
          eventDefaults: {
            duration: 600, // 10 hours in minutes
            visibility: "private",
            guestsCanModify: false,
          },
        },
        availableCalendars: [
          {
            id: "primary",
            summary: "Primary Calendar",
            description: "Main calendar",
            primary: true,
            accessRole: "owner",
          },
          {
            id: "work-calendar",
            summary: "Work Calendar",
            description: "Work events",
            primary: false,
            accessRole: "writer",
          },
        ],
      });
    });
  });
});
