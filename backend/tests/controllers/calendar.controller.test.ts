import express, { Response } from "express";
import request from "supertest";
import { CalendarController } from "@/controllers/calendar.controller";
import { calendarRoutes } from "@/routes/calendar.routes";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { UserConfigRepository } from "@/repositories/user-config.repository";
import { services } from "@/services";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";

// Mock dependencies
// Repository instances are injected into the controller below, so automocked
// classes are fine here. `@/services` is NOT module-mocked: tests/setup.ts has
// already loaded the real route/controller graph, so the controller holds the
// real `services` singleton. Spy on its members instead.
jest.mock("@/repositories/schedule-data.repository");
jest.mock("@/repositories/user-config.repository");
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

  });

  afterEach(() => {
    jest.restoreAllMocks();
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

      jest.spyOn(services.calendarManager, "getCalendarEvents")
        .mockResolvedValue(mockEvents);
      (calendarController as any).scheduleDataRepository =
        mockScheduleDataRepository;

      await calendarController.getCalendarEvents(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      // No query params: no time bounds and no maxResults override are sent;
      // the 50-result default is applied inside CalendarManagerService.
      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledTimes(1);
      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledWith(
        "test-user-id",
        {}
      );

      // Events are returned exactly as CalendarManagerService produces them.
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        events: mockEvents,
      });
    });

    // Regression for BUG-026: the controller maps startDate/endDate/maxResults
    // to timeMin/timeMax and a numeric maxResults before calling the service.
    it("should handle date range filtering", async () => {
      mockRequest.query = {
        startDate: "2024-01-15T00:00:00Z",
        endDate: "2024-01-16T00:00:00Z",
        maxResults: "10",
      };

      jest.spyOn(services.calendarManager, "getCalendarEvents")
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
      jest.spyOn(services.calendarManager, "getCalendarEvents")
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
      jest.spyOn(services.calendarManager, "createCalendarEvent")
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
      // The scheduleId check lives in the route's express-validator chain
      // (calendar.routes.ts, POST /events), not in the controller, so exercise
      // it through the router with auth stubbed at the service boundary.
      jest.spyOn(services.oauth2, "verifyJWT").mockReturnValue({
        userId: "test-user-id",
        email: "test@example.com",
      } as any);
      jest.spyOn(services.oauth2, "getOAuthStatus").mockResolvedValue({
        isAuthenticated: true,
        needsReauth: false,
        scopes: [],
      } as any);
      const findWithRelations = jest.fn();
      (calendarController as any).scheduleDataRepository = {
        findWithRelations,
      };
      const createEvent = jest.spyOn(
        services.calendarManager,
        "createCalendarEvent"
      );

      const app = express();
      app.use(express.json());
      app.use("/api/calendar", calendarRoutes);

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", "Bearer valid-token")
        .send({}); // Missing scheduleId

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "scheduleId",
            msg: "Schedule ID must be a non-empty string",
          }),
        ])
      );
      expect(findWithRelations).not.toHaveBeenCalled();
      expect(createEvent).not.toHaveBeenCalled();
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

      expect(
        mockScheduleDataRepository.findWithRelations
      ).toHaveBeenCalledWith("nonexistent");
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Schedule not found or access denied",
        code: "SCHEDULE_NOT_FOUND",
      });
    });

    it("should return 404 (not 403) when user doesn't own schedule, without leaking its existence", async () => {
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

      const createEvent = jest.spyOn(
        services.calendarManager,
        "createCalendarEvent"
      );

      await calendarController.createCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      // Foreign schedules get the same response as missing ones.
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Schedule not found or access denied",
        code: "SCHEDULE_NOT_FOUND",
      });
      expect(createEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateCalendarEvent", () => {
    it("should update calendar event successfully", async () => {
      mockRequest.params = { eventId: "google-event-1" };
      mockRequest.body = {
        title: "Updated Event Title",
        description: "Updated description",
      };

      // Not stubbed: CalendarManagerService.updateCalendarEvent has no I/O
      // (it is a local stub), so call through and check the controller exposes
      // what the service really returns.
      const updateSpy = jest.spyOn(
        services.calendarManager,
        "updateCalendarEvent"
      );

      await calendarController.updateCalendarEvent(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(updateSpy).toHaveBeenCalledWith(
        "google-event-1",
        mockRequest.body,
        "test-user-id"
      );

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledTimes(1);
      const body = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.message).toBe("Calendar event updated successfully");
      // The updated values must reach the client. KNOWN SRC DEFECT (left red):
      // the service returns a Google-shaped object (summary/start/end) cast to
      // CalendarEvent, while the controller reads title/startTime/endTime.
      expect(body.event).toMatchObject({
        title: "Updated Event Title",
        description: "Updated description",
      });
    });
  });

  describe("deleteCalendarEvent", () => {
    it("should delete calendar event successfully", async () => {
      mockRequest.params = { eventId: "google-event-1" };

      jest.spyOn(services.calendarManager, "deleteCalendarEvent")
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

      jest.spyOn(services.oauth2, "getOAuthStatus")
        .mockResolvedValue(mockOAuthStatus);
      jest.spyOn(services.calendarManager, "getCalendarEvents")
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

      jest.spyOn(services.oauth2, "getOAuthStatus")
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

      jest.spyOn(services.calendarManager, "createCalendarEvent")
        .mockResolvedValue(mockNewEvent);
      jest.spyOn(services.calendarManager, "updateCalendarEventFromSchedule")
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
    it("should return calendar settings for the user", async () => {
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

      mockUserConfigRepository.findByUserId = jest
        .fn()
        .mockResolvedValue(mockUserConfig);
      (calendarController as any).userConfigRepository =
        mockUserConfigRepository;

      await calendarController.getCalendarSettings(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockUserConfigRepository.findByUserId).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        settings: {
          autoSync: true,
          defaultCalendar: "primary",
          syncPastEvents: false,
          eventReminders: true,
          reminderMinutes: 15,
        },
      });
    });

    it("should return 500 when loading the user config fails", async () => {
      mockUserConfigRepository.findByUserId = jest
        .fn()
        .mockRejectedValue(new Error("db down"));
      (calendarController as any).userConfigRepository =
        mockUserConfigRepository;

      await calendarController.getCalendarSettings(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Internal Server Error",
          code: "CALENDAR_SETTINGS_FAILED",
        })
      );
    });
  });
});
