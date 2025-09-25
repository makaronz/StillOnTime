import request from "supertest";
import { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { createTestApp } from "../setup";
import { services } from "@/services";

// Mock external services
jest.mock("@/services");

describe("Schedule Endpoints Integration Tests", () => {
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
      jobProcessor: {
        addRouteRecalculationJob: jest.fn().mockResolvedValue({ id: "job-1" }),
        addWeatherUpdateJob: jest.fn().mockResolvedValue({ id: "job-2" }),
      },
      weather: {
        getWeatherForecast: jest.fn().mockResolvedValue({
          temperature: 15,
          description: "Partly cloudy",
          windSpeed: 5,
          precipitation: 0,
          warnings: [],
        }),
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
          {
            from: "Panavision",
            to: "Test Location",
            duration: 45,
            distance: "25 km",
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
        warnings: ["WIND_WARNING"],
        userId: testUserId,
        scheduleId: testScheduleId,
      },
    });
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

  describe("GET /api/schedule", () => {
    it("should return schedules with pagination", async () => {
      const response = await request(app)
        .get("/api/schedule")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        schedules: expect.arrayContaining([
          expect.objectContaining({
            id: testScheduleId,
            shootingDate: "2024-01-15T00:00:00.000Z",
            callTime: "08:00",
            location: "Test Location, Warsaw",
            sceneType: "EXT",
            hasRoutePlan: true,
            hasWeatherData: true,
            hasCalendarEvent: false,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 20,
          type: "all",
        },
      });
    });

    it("should filter schedules by type", async () => {
      const response = await request(app)
        .get("/api/schedule?type=upcoming")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.type).toBe("upcoming");
    });

    it("should filter schedules by scene type", async () => {
      const response = await request(app)
        .get("/api/schedule?sceneType=EXT")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.schedules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sceneType: "EXT",
          }),
        ])
      );
    });

    it("should return 401 without authentication", async () => {
      await request(app).get("/api/schedule").expect(401);
    });
  });

  describe("GET /api/schedule/:scheduleId", () => {
    it("should return schedule with all relations", async () => {
      const response = await request(app)
        .get(`/api/schedule/${testScheduleId}`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        schedule: expect.objectContaining({
          id: testScheduleId,
          shootingDate: "2024-01-15T00:00:00.000Z",
          callTime: "08:00",
          location: "Test Location, Warsaw",
          sceneType: "EXT",
          scenes: ["Scene 1", "Scene 2"],
          safetyNotes: "Wear safety gear",
          equipment: ["Camera", "Lights"],
          email: expect.objectContaining({
            subject: "Test Schedule Email",
          }),
          routePlan: expect.objectContaining({
            wakeUpTime: expect.any(String),
            departureTime: expect.any(String),
            arrivalTime: expect.any(String),
          }),
          weatherData: expect.objectContaining({
            temperature: 15,
            description: "Partly cloudy",
          }),
        }),
      });
    });

    it("should return 404 for non-existent schedule", async () => {
      const response = await request(app)
        .get("/api/schedule/non-existent-id")
        .set("Authorization", authToken)
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Not Found",
        code: "SCHEDULE_NOT_FOUND",
      });
    });
  });

  describe("PUT /api/schedule/:scheduleId", () => {
    it("should update schedule successfully", async () => {
      const updateData = {
        location: "Updated Location",
        callTime: "09:00",
        safetyNotes: "Updated safety notes",
      };

      const response = await request(app)
        .put(`/api/schedule/${testScheduleId}`)
        .set("Authorization", authToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        schedule: expect.objectContaining({
          id: testScheduleId,
          location: "Updated Location",
          callTime: "09:00",
          safetyNotes: "Updated safety notes",
        }),
        message: "Schedule updated successfully",
      });

      // Verify background jobs were triggered
      expect(
        services.jobProcessor.addRouteRecalculationJob
      ).toHaveBeenCalledWith(testScheduleId);
    });

    it("should return 400 for invalid data", async () => {
      const invalidData = {
        callTime: "invalid-time", // Invalid format
      };

      const response = await request(app)
        .put(`/api/schedule/${testScheduleId}`)
        .set("Authorization", authToken)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("DELETE /api/schedule/:scheduleId", () => {
    it("should delete schedule successfully", async () => {
      const response = await request(app)
        .delete(`/api/schedule/${testScheduleId}`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Schedule deleted successfully",
      });

      // Verify schedule was deleted
      const deletedSchedule = await prisma.scheduleData.findUnique({
        where: { id: testScheduleId },
      });
      expect(deletedSchedule).toBeNull();
    });
  });

  describe("GET /api/schedule/statistics", () => {
    it("should return schedule statistics", async () => {
      const response = await request(app)
        .get("/api/schedule/statistics")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statistics: expect.objectContaining({
          schedules: expect.any(Object),
          routes: expect.any(Object),
          weather: expect.any(Object),
        }),
      });
    });
  });

  describe("GET /api/schedule/:scheduleId/route", () => {
    it("should return route plan for schedule", async () => {
      const response = await request(app)
        .get(`/api/schedule/${testScheduleId}/route`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        routePlan: expect.objectContaining({
          scheduleId: testScheduleId,
          wakeUpTime: expect.any(String),
          departureTime: expect.any(String),
          arrivalTime: expect.any(String),
          totalTravelMinutes: 75,
          routeSegments: expect.arrayContaining([
            expect.objectContaining({
              from: "Home",
              to: "Panavision",
            }),
          ]),
        }),
      });
    });
  });

  describe("PUT /api/schedule/:scheduleId/route", () => {
    it("should update route plan successfully", async () => {
      const updateData = {
        wakeUpTime: "2024-01-15T04:30:00Z",
        departureTime: "2024-01-15T06:00:00Z",
        totalTravelMinutes: 90,
      };

      const response = await request(app)
        .put(`/api/schedule/${testScheduleId}/route`)
        .set("Authorization", authToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        routePlan: expect.objectContaining({
          wakeUpTime: "2024-01-15T04:30:00.000Z",
          departureTime: "2024-01-15T06:00:00.000Z",
          totalTravelMinutes: 90,
        }),
        message: "Route plan updated successfully",
      });
    });
  });

  describe("POST /api/schedule/:scheduleId/route/recalculate", () => {
    it("should trigger route recalculation", async () => {
      const response = await request(app)
        .post(`/api/schedule/${testScheduleId}/route/recalculate`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: expect.objectContaining({
          id: "job-1",
          status: "queued",
        }),
        message: "Route recalculation queued",
      });

      expect(
        services.jobProcessor.addRouteRecalculationJob
      ).toHaveBeenCalledWith(testScheduleId);
    });
  });

  describe("GET /api/schedule/:scheduleId/weather", () => {
    it("should return weather data for schedule", async () => {
      const response = await request(app)
        .get(`/api/schedule/${testScheduleId}/weather`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        weatherData: expect.objectContaining({
          scheduleId: testScheduleId,
          forecastDate: "2024-01-15T00:00:00.000Z",
          temperature: 15,
          description: "Partly cloudy",
          windSpeed: 5,
          precipitation: 0,
          warnings: ["WIND_WARNING"],
        }),
      });
    });
  });

  describe("POST /api/schedule/:scheduleId/weather/update", () => {
    it("should trigger weather update", async () => {
      const response = await request(app)
        .post(`/api/schedule/${testScheduleId}/weather/update`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: expect.objectContaining({
          id: "job-2",
          status: "queued",
        }),
        message: "Weather update queued",
      });

      expect(services.jobProcessor.addWeatherUpdateJob).toHaveBeenCalledWith(
        testScheduleId
      );
    });
  });

  describe("GET /api/schedule/weather/forecast", () => {
    it("should return weather forecast for location and date", async () => {
      const response = await request(app)
        .get("/api/schedule/weather/forecast")
        .query({
          location: "Warsaw, Poland",
          date: "2024-01-15",
        })
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        forecast: expect.objectContaining({
          temperature: 15,
          description: "Partly cloudy",
          windSpeed: 5,
          precipitation: 0,
          warnings: [],
        }),
      });

      expect(services.weather.getWeatherForecast).toHaveBeenCalledWith(
        "Warsaw, Poland",
        "2024-01-15"
      );
    });

    it("should return 400 when location or date is missing", async () => {
      const response = await request(app)
        .get("/api/schedule/weather/forecast")
        .query({ location: "Warsaw, Poland" }) // Missing date
        .set("Authorization", authToken)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Bad Request",
        code: "MISSING_PARAMETERS",
      });
    });
  });

  describe("GET /api/schedule/weather/warnings", () => {
    it("should return weather warnings for user", async () => {
      const response = await request(app)
        .get("/api/schedule/weather/warnings")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        warnings: expect.arrayContaining([
          expect.objectContaining({
            scheduleId: testScheduleId,
            warnings: ["WIND_WARNING"],
            schedule: expect.objectContaining({
              location: "Test Location, Warsaw",
              sceneType: "EXT",
            }),
          }),
        ]),
      });
    });
  });
});
