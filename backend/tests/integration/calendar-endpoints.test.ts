import request from "supertest";
import { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { createTestApp } from "../setup";
import { services } from "@/services";

// Mock external services
jest.mock("@/services");

describe("Calendar Endpoints Integration Tests", () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let testUserId: string;
  let testScheduleId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL ||
            "postgresql://test:test@localhost:5432/test_db",
        },
      },
    });

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        googleId: "test-google-id",
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      },
    });

    testUserId = testUser.id;

    // Mock JWT token for authentication
    authToken = "Bearer test-jwt-token";

    // Mock authentication middleware to return our test user
    jest.doMock("@/middleware/auth.middleware", () => ({
      authenticateToken: (req: any, res: any, next: any) => {
        req.user = { userId: testUserId, email: "test@example.com" };
        next();
      },
      requireValidOAuth: (req: any, res: any, next: any) => {
        next();
      },
    }));

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

  beforeEach(async () => {
    // Create test email
    const testEmail = await prisma.processedEmail.create({
      data: {
        messageId: "test-message-id",
        subject: "Test Schedule Email",
        sender: "test@stillontime.com",
        receivedAt: new Date(),
        threadId: "test-thread-id",
        processed: true,
        processingStatus: "completed",
        userId: testUserId,
      },
    });

    // Create test schedule
    const testSchedule = await prisma.scheduleData.create({
      data: {
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location, Warsaw",
        baseLocation: "Panavision Warsaw",
        sceneType: "EXT",
        scenes: ["Scene 1", "Scene 2"],
        safetyNotes: "Wear safety gear",
        equipment: ["Camera", "Lights"],
        contacts: [{ name: "Director", phone: "+48123456789" }],
        notes: "Test shooting day",
        userId: testUserId,
        emailId: testEmail.id,
      },
    });

    testScheduleId = testSchedule.id;

    // Create test route plan
    await prisma.routePlan.create({
      data: {
        wakeUpTime: new Date("2024-01-15T05:00:00Z"),
        departureTime: new Date("2024-01-15T06:30:00Z"),
        arrivalTime: new Date("2024-01-15T07:45:00Z"),
        totalTravelMinutes: 75,
        routeSegments: [
          {
            from: "Home",
            to: "Panavision",
            duration: 30,
            distance: "15 km",
          },
        ],
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        userId: testUserId,
        scheduleId: testScheduleId,
      },
    });

    // Create test weather data
    await prisma.weatherData.create({
      data: {
        forecastDate: new Date("2024-01-15"),
        temperature: 15,
        description: "Partly cloudy",
        windSpeed: 5,
        precipitation: 0,
        humidity: 65,
        warnings: [],
        userId: testUserId,
        scheduleId: testScheduleId,
      },
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.weatherData.deleteMany({ where: { userId: testUserId } });
    await prisma.routePlan.deleteMany({ where: { userId: testUserId } });
    await prisma.calendarEvent.deleteMany({ where: { userId: testUserId } });
    await prisma.scheduleData.deleteMany({ where: { userId: testUserId } });
    await prisma.processedEmail.deleteMany({ where: { userId: testUserId } });
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe("GET /api/calendar/events", () => {
    it("should return calendar events with default parameters", async () => {
      const mockEvents = [
        {
          id: "event-1",
          summary: "StillOnTime — Dzień zdjęciowy (Test Location)",
          description: "Shooting schedule details",
          location: "Test Location, Warsaw",
          start: { dateTime: "2024-01-15T08:00:00Z" },
          end: { dateTime: "2024-01-15T18:00:00Z" },
          attendees: [],
          reminders: { useDefault: false },
          created: "2024-01-14T10:00:00Z",
          updated: "2024-01-14T10:00:00Z",
        },
      ];

      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockResolvedValue(mockEvents);

      const response = await request(app)
        .get("/api/calendar/events")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        events: [
          {
            id: "event-1",
            title: "StillOnTime — Dzień zdjęciowy (Test Location)",
            description: "Shooting schedule details",
            location: "Test Location, Warsaw",
            startTime: "2024-01-15T08:00:00Z",
            endTime: "2024-01-15T18:00:00Z",
            attendees: [],
            reminders: { useDefault: false },
            created: "2024-01-14T10:00:00Z",
            updated: "2024-01-14T10:00:00Z",
          },
        ],
      });

      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledWith(
        testUserId,
        {
          timeMin: undefined,
          timeMax: undefined,
          maxResults: 50,
        }
      );
    });

    it("should handle date range filtering", async () => {
      services.calendarManager.getCalendarEvents = jest
        .fn()
        .mockResolvedValue([]);

      const response = await request(app)
        .get("/api/calendar/events")
        .query({
          startDate: "2024-01-15T00:00:00Z",
          endDate: "2024-01-16T00:00:00Z",
          maxResults: "10",
        })
        .set("Authorization", authToken)
        .expect(200);

      expect(services.calendarManager.getCalendarEvents).toHaveBeenCalledWith(
        testUserId,
        {
          timeMin: new Date("2024-01-15T00:00:00Z"),
          timeMax: new Date("2024-01-16T00:00:00Z"),
          maxResults: 10,
        }
      );

      expect(response.body).toMatchObject({
        success: true,
        events: [],
      });
    });

    it("should return 401 without authentication", async () => {
      await request(app).get("/api/calendar/events").expect(401);
    });
  });

  describe("POST /api/calendar/events", () => {
    it("should create calendar event for schedule", async () => {
      const mockCalendarEvent = {
        id: "cal-event-1",
        calendarEventId: "google-event-1",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-01-15T06:30:00Z"),
        endTime: new Date("2024-01-15T18:00:00Z"),
        description: "Shooting schedule with route and weather info",
        location: "Test Location, Warsaw",
      };

      services.calendarManager.createCalendarEvent = jest
        .fn()
        .mockResolvedValue(mockCalendarEvent);

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", authToken)
        .send({ scheduleId: testScheduleId })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        calendarEvent: {
          id: "cal-event-1",
          calendarEventId: "google-event-1",
          title: "StillOnTime — Dzień zdjęciowy (Test Location)",
          startTime: "2024-01-15T06:30:00.000Z",
          endTime: "2024-01-15T18:00:00.000Z",
          description: "Shooting schedule with route and weather info",
          location: "Test Location, Warsaw",
        },
        message: "Calendar event created successfully",
      });

      expect(services.calendarManager.createCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testScheduleId,
          location: "Test Location, Warsaw",
        }),
        expect.any(Object), // routePlan
        expect.any(Object), // weatherData
        testUserId
      );
    });

    it("should return 400 when schedule ID is missing", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", authToken)
        .send({}) // Missing scheduleId
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "MISSING_SCHEDULE_ID",
      });
    });

    it("should return 404 when schedule not found", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", authToken)
        .send({ scheduleId: "non-existent-id" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Not Found",
        code: "SCHEDULE_NOT_FOUND",
      });
    });
  });

  describe("PUT /api/calendar/events/:eventId", () => {
    it("should update calendar event successfully", async () => {
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

      const updateData = {
        title: "Updated Event Title",
        description: "Updated description",
      };

      const response = await request(app)
        .put("/api/calendar/events/google-event-1")
        .set("Authorization", authToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
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

      expect(services.calendarManager.updateCalendarEvent).toHaveBeenCalledWith(
        "google-event-1",
        updateData,
        testUserId
      );
    });

    it("should return 400 for invalid data", async () => {
      const invalidData = {
        title: "", // Empty title
      };

      const response = await request(app)
        .put("/api/calendar/events/google-event-1")
        .set("Authorization", authToken)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("DELETE /api/calendar/events/:eventId", () => {
    it("should delete calendar event successfully", async () => {
      services.calendarManager.deleteCalendarEvent = jest
        .fn()
        .mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/calendar/events/google-event-1")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Calendar event deleted successfully",
      });

      expect(services.calendarManager.deleteCalendarEvent).toHaveBeenCalledWith(
        "google-event-1",
        testUserId
      );
    });
  });

  describe("GET /api/calendar/sync/status", () => {
    it("should return calendar sync status with access", async () => {
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

      const response = await request(app)
        .get("/api/calendar/sync/status")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
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

    it("should return sync status without calendar access", async () => {
      const mockOAuthStatus = {
        isAuthenticated: true,
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"], // No calendar scope
        expiresAt: new Date("2024-01-16T00:00:00Z"),
        needsReauth: false,
      };

      services.oauth2.getOAuthStatus = jest
        .fn()
        .mockResolvedValue(mockOAuthStatus);

      const response = await request(app)
        .get("/api/calendar/sync/status")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
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

  describe("POST /api/calendar/sync", () => {
    it("should sync calendar events for multiple schedules", async () => {
      // Create second schedule
      const testEmail2 = await prisma.processedEmail.create({
        data: {
          messageId: "test-message-id-2",
          subject: "Test Schedule Email 2",
          sender: "test@stillontime.com",
          receivedAt: new Date(),
          threadId: "test-thread-id-2",
          processed: true,
          processingStatus: "completed",
          userId: testUserId,
        },
      });

      const testSchedule2 = await prisma.scheduleData.create({
        data: {
          shootingDate: new Date("2024-01-16"),
          callTime: "09:00",
          location: "Location 2, Warsaw",
          baseLocation: "Panavision Warsaw",
          sceneType: "INT",
          userId: testUserId,
          emailId: testEmail2.id,
        },
      });

      // Create calendar event for second schedule
      await prisma.calendarEvent.create({
        data: {
          calendarEventId: "google-event-2",
          title: "Existing Event",
          startTime: new Date("2024-01-16T08:00:00Z"),
          endTime: new Date("2024-01-16T18:00:00Z"),
          description: "Existing event description",
          location: "Location 2, Warsaw",
          userId: testUserId,
          scheduleId: testSchedule2.id,
        },
      });

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

      services.calendarManager.createCalendarEvent = jest
        .fn()
        .mockResolvedValue(mockNewEvent);
      services.calendarManager.updateCalendarEventFromSchedule = jest
        .fn()
        .mockResolvedValue(mockUpdatedEvent);

      const response = await request(app)
        .post("/api/calendar/sync")
        .set("Authorization", authToken)
        .send({ scheduleIds: [testScheduleId, testSchedule2.id] })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        results: [
          {
            scheduleId: testScheduleId,
            success: true,
            eventId: "google-event-1",
          },
          {
            scheduleId: testSchedule2.id,
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

      expect(
        services.calendarManager.createCalendarEvent
      ).toHaveBeenCalledTimes(1);
      expect(
        services.calendarManager.updateCalendarEventFromSchedule
      ).toHaveBeenCalledTimes(1);

      // Clean up
      await prisma.calendarEvent.deleteMany({
        where: { scheduleId: testSchedule2.id },
      });
      await prisma.scheduleData.delete({ where: { id: testSchedule2.id } });
      await prisma.processedEmail.delete({ where: { id: testEmail2.id } });
    });

    it("should return 400 when schedule IDs are missing", async () => {
      const response = await request(app)
        .post("/api/calendar/sync")
        .set("Authorization", authToken)
        .send({}) // Missing scheduleIds
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "MISSING_SCHEDULE_IDS",
      });
    });

    it("should return 400 when schedule IDs is not an array", async () => {
      const response = await request(app)
        .post("/api/calendar/sync")
        .set("Authorization", authToken)
        .send({ scheduleIds: "not-an-array" })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("GET /api/calendar/settings", () => {
    it("should return calendar settings with available calendars", async () => {
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

      services.calendarManager.getCalendarList = jest
        .fn()
        .mockResolvedValue(mockCalendars);

      const response = await request(app)
        .get("/api/calendar/settings")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
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

      expect(services.calendarManager.getCalendarList).toHaveBeenCalledWith(
        testUserId
      );
    });
  });

  describe("GET /api/calendar/health", () => {
    it("should return health status", async () => {
      const response = await request(app)
        .get("/api/calendar/health")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        status: "healthy",
        service: "calendar-management",
        timestamp: expect.any(String),
        version: "1.0.0",
      });
    });
  });
});
