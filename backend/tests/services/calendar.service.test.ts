import { CalendarService } from "@/services/calendar.service";
import { OAuth2Service } from "@/services/oauth2.service";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { google } from "googleapis";
import { logger } from "@/utils/logger";
import { ScheduleData, RoutePlan, WeatherData, CalendarEvent } from "@/types";

// Mock dependencies
jest.mock("googleapis");
jest.mock("@/utils/logger");
jest.mock("@/services/oauth2.service");
jest.mock("@/repositories/calendar-event.repository");

describe("CalendarService", () => {
  let calendarService: CalendarService;
  let mockOAuth2Service: jest.Mocked<OAuth2Service>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockCalendarAPI: any;
  let mockAuth: any;

  const mockUserId = "user-123";
  const mockScheduleData: ScheduleData = {
    id: "schedule-123",
    shootingDate: new Date("2024-03-15T00:00:00Z"),
    callTime: "08:00",
    location: "Studio Filmowe, Warszawa",
    baseLocation: "Dom",
    sceneType: "EXT",
    scenes: ["Scene 1", "Scene 2"],
    safetyNotes: "Uwaga na mokrą nawierzchnię",
    equipment: ["Kamera", "Statyw"],
    contacts: [
      { name: "Jan Kowalski", role: "Reżyser", phone: "+48123456789" },
    ],
    notes: "Dodatkowe uwagi",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: mockUserId,
    emailId: "email-123",
  };

  const mockRoutePlan: RoutePlan = {
    id: "route-123",
    wakeUpTime: new Date("2024-03-15T05:30:00Z"),
    departureTime: new Date("2024-03-15T06:45:00Z"),
    arrivalTime: new Date("2024-03-15T07:45:00Z"),
    totalTravelMinutes: 60,
    routeSegments: [],
    buffers: {
      carChange: 15,
      parking: 10,
      entry: 10,
      traffic: 20,
      morningRoutine: 45,
    },
    calculatedAt: new Date(),
    userId: mockUserId,
    scheduleId: "schedule-123",
  };

  const mockWeatherData: WeatherData = {
    id: "weather-123",
    forecastDate: new Date("2024-03-15T00:00:00Z"),
    temperature: 15,
    description: "Częściowo pochmurno",
    windSpeed: 5,
    precipitation: 0,
    humidity: 60,
    warnings: ["Silny wiatr po południu"],
    fetchedAt: new Date(),
    userId: mockUserId,
    scheduleId: "schedule-123",
  };

  const mockCalendarEvent: CalendarEvent = {
    id: "calendar-event-123",
    calendarEventId: "google-event-123",
    title: "StillOnTime — Dzień zdjęciowy (Studio Filmowe, Warszawa)",
    startTime: new Date("2024-03-15T06:45:00Z"),
    endTime: new Date("2024-03-15T18:00:00Z"),
    description: "Event description",
    location: "Studio Filmowe, Warszawa",
    createdAt: new Date(),
    userId: mockUserId,
    scheduleId: "schedule-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OAuth2Service
    mockOAuth2Service = {
      getGoogleClient: jest.fn(),
    } as any;

    // Mock CalendarEventRepository
    mockCalendarEventRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findConflictingEvents: jest.fn(),
      findByScheduleId: jest.fn(),
      findByCalendarEventId: jest.fn(),
      findByUserId: jest.fn(),
      findUpcomingEvents: jest.fn(),
      findEventsByDateRange: jest.fn(),
      findEventsNeedingSync: jest.fn(),
    } as any;

    // Mock Google Calendar API
    mockCalendarAPI = {
      events: {
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockAuth = {};

    (google.calendar as jest.Mock).mockReturnValue(mockCalendarAPI);
    mockOAuth2Service.getGoogleClient.mockResolvedValue(mockAuth);

    calendarService = new CalendarService(
      mockOAuth2Service,
      mockCalendarEventRepository
    );
  });

  describe("createCalendarEvent", () => {
    it("should create a calendar event successfully", async () => {
      // Arrange
      const mockGoogleEvent = {
        id: "google-event-123",
        summary: "StillOnTime — Dzień zdjęciowy (Studio Filmowe, Warszawa)",
      };

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: mockGoogleEvent,
      });

      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([]);
      mockCalendarEventRepository.create.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await calendarService.createCalendarEvent(
        mockScheduleData,
        mockRoutePlan,
        mockWeatherData,
        mockUserId
      );

      // Assert
      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(
        mockUserId
      );
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledWith({
        calendarId: "primary",
        requestBody: expect.objectContaining({
          summary: "StillOnTime — Dzień zdjęciowy (Studio Filmowe, Warszawa)",
          location: "Studio Filmowe, Warszawa",
          start: expect.objectContaining({
            timeZone: "Europe/Warsaw",
          }),
          end: expect.objectContaining({
            timeZone: "Europe/Warsaw",
          }),
          reminders: expect.objectContaining({
            useDefault: false,
            overrides: expect.arrayContaining([
              expect.objectContaining({
                method: "popup",
                minutes: expect.any(Number),
              }),
            ]),
          }),
          colorId: "9",
        }),
      });

      expect(mockCalendarEventRepository.create).toHaveBeenCalledWith({
        calendarEventId: "google-event-123",
        title: "StillOnTime — Dzień zdjęciowy (Studio Filmowe, Warszawa)",
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        description: expect.stringContaining("🎬 DZIEŃ ZDJĘCIOWY"),
        location: "Studio Filmowe, Warszawa",
        user: { connect: { id: mockUserId } },
        schedule: { connect: { id: "schedule-123" } },
      });

      expect(result).toEqual(mockCalendarEvent);
    });

    it("should handle conflicts and still create event", async () => {
      // Arrange
      const conflictingEvent = {
        ...mockCalendarEvent,
        id: "conflicting-event",
        title: "Conflicting Event",
      };

      const mockGoogleEvent = {
        id: "google-event-123",
        summary: "StillOnTime — Dzień zdjęciowy (Studio Filmowe, Warszawa)",
      };

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: mockGoogleEvent,
      });

      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([
        conflictingEvent,
      ]);
      mockCalendarEventRepository.create.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await calendarService.createCalendarEvent(
        mockScheduleData,
        mockRoutePlan,
        mockWeatherData,
        mockUserId
      );

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "Calendar conflicts detected",
        expect.objectContaining({
          scheduleId: "schedule-123",
          conflictCount: 1,
        })
      );
      expect(result).toEqual(mockCalendarEvent);
    });

    it("should throw error when Google Calendar event creation fails", async () => {
      // Arrange
      mockCalendarAPI.events.insert.mockRejectedValue(
        new Error("Google Calendar API error")
      );
      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([]);

      // Act & Assert
      await expect(
        calendarService.createCalendarEvent(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId
        )
      ).rejects.toThrow("Failed to create calendar event");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create calendar event",
        expect.objectContaining({
          scheduleId: "schedule-123",
          userId: mockUserId,
        })
      );
    });

    it("should throw error when Google event has no ID", async () => {
      // Arrange
      const mockGoogleEvent = {
        summary: "Event without ID",
      };

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: mockGoogleEvent,
      });
      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([]);

      // Act & Assert
      await expect(
        calendarService.createCalendarEvent(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId
        )
      ).rejects.toThrow("Google Calendar event created but no ID returned");
    });
  });

  describe("setMultipleAlarms", () => {
    it("should return multiple wake-up alarms", async () => {
      // Arrange
      const wakeUpTime = new Date("2024-03-15T05:30:00Z");

      // Act
      const result = await calendarService.setMultipleAlarms(
        wakeUpTime,
        mockUserId
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { method: "popup", minutes: 10 },
        { method: "popup", minutes: 0 },
        { method: "popup", minutes: -5 },
      ]);

      expect(logger.info).toHaveBeenCalledWith(
        "Setting multiple wake-up alarms",
        expect.objectContaining({
          wakeUpTime,
          userId: mockUserId,
          alarmCount: 3,
        })
      );
    });
  });

  describe("updateCalendarEvent", () => {
    it("should update existing calendar event", async () => {
      // Arrange
      const eventId = "calendar-event-123";
      const updatedScheduleData = {
        ...mockScheduleData,
        location: "New Location",
      };

      const updatedGoogleEvent = {
        id: "google-event-123",
        summary: "Updated Event",
      };

      const updatedLocalEvent = {
        ...mockCalendarEvent,
        location: "New Location",
      };

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarAPI.events.update.mockResolvedValue({
        data: updatedGoogleEvent,
      });
      mockCalendarEventRepository.update.mockResolvedValue(updatedLocalEvent);

      // Act
      const result = await calendarService.updateCalendarEvent(
        eventId,
        updatedScheduleData,
        mockRoutePlan,
        mockWeatherData,
        mockUserId
      );

      // Assert
      expect(mockCalendarEventRepository.findById).toHaveBeenCalledWith(
        eventId
      );
      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(
        mockUserId
      );
      expect(mockCalendarAPI.events.update).toHaveBeenCalledWith({
        calendarId: "primary",
        eventId: "google-event-123",
        requestBody: expect.objectContaining({
          summary: expect.stringContaining("New Location"),
          location: "New Location",
        }),
      });
      expect(result).toEqual(updatedLocalEvent);
    });

    it("should throw error when event not found", async () => {
      // Arrange
      const eventId = "non-existent-event";
      mockCalendarEventRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        calendarService.updateCalendarEvent(
          eventId,
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId
        )
      ).rejects.toThrow("Calendar event not found");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("should delete calendar event successfully", async () => {
      // Arrange
      const eventId = "calendar-event-123";

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarAPI.events.delete.mockResolvedValue({});
      mockCalendarEventRepository.delete.mockResolvedValue(mockCalendarEvent);

      // Act
      await calendarService.deleteCalendarEvent(eventId, mockUserId);

      // Assert
      expect(mockCalendarEventRepository.findById).toHaveBeenCalledWith(
        eventId
      );
      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(
        mockUserId
      );
      expect(mockCalendarAPI.events.delete).toHaveBeenCalledWith({
        calendarId: "primary",
        eventId: "google-event-123",
      });
      expect(mockCalendarEventRepository.delete).toHaveBeenCalledWith(eventId);
    });

    it("should throw error when event not found", async () => {
      // Arrange
      const eventId = "non-existent-event";
      mockCalendarEventRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        calendarService.deleteCalendarEvent(eventId, mockUserId)
      ).rejects.toThrow("Calendar event not found");
    });
  });

  describe("detectConflicts", () => {
    it("should detect and categorize conflicts correctly", async () => {
      // Arrange
      const startTime = new Date("2024-03-15T08:00:00Z");
      const endTime = new Date("2024-03-15T10:00:00Z");

      const partialConflict = {
        ...mockCalendarEvent,
        id: "partial-conflict",
        startTime: new Date("2024-03-15T07:00:00Z"),
        endTime: new Date("2024-03-15T09:00:00Z"),
      };

      const completeConflict = {
        ...mockCalendarEvent,
        id: "complete-conflict",
        startTime: new Date("2024-03-15T08:30:00Z"),
        endTime: new Date("2024-03-15T09:30:00Z"),
      };

      const encompassingConflict = {
        ...mockCalendarEvent,
        id: "encompassing-conflict",
        startTime: new Date("2024-03-15T07:00:00Z"),
        endTime: new Date("2024-03-15T11:00:00Z"),
      };

      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([
        partialConflict,
        completeConflict,
        encompassingConflict,
      ]);

      // Act
      const result = await calendarService.detectConflicts(
        mockUserId,
        startTime,
        endTime
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].overlapType).toBe("partial");
      expect(result[1].overlapType).toBe("complete");
      expect(result[2].overlapType).toBe("encompasses");
      expect(result[0].overlapDuration).toBe(60); // 1 hour overlap
      expect(result[1].overlapDuration).toBe(60); // 1 hour overlap
      expect(result[2].overlapDuration).toBe(120); // 2 hours overlap
    });

    it("should return empty array when no conflicts", async () => {
      // Arrange
      const startTime = new Date("2024-03-15T08:00:00Z");
      const endTime = new Date("2024-03-15T10:00:00Z");

      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([]);

      // Act
      const result = await calendarService.detectConflicts(
        mockUserId,
        startTime,
        endTime
      );

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("performBatchOperations", () => {
    it("should perform batch operations successfully", async () => {
      // Arrange
      const operations = [
        {
          operation: "create" as const,
          eventData: {
            title: "New Event",
            description: "Description",
            location: "Location",
            startTime: new Date(),
            endTime: new Date(),
            alarms: [],
            reminders: [],
          },
        },
        {
          operation: "update" as const,
          eventId: "event-to-update",
          eventData: {
            title: "Updated Event",
            description: "Updated Description",
            location: "Updated Location",
            startTime: new Date(),
            endTime: new Date(),
            alarms: [],
            reminders: [],
          },
        },
        {
          operation: "delete" as const,
          eventId: "event-to-delete",
        },
      ];

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: { id: "new-event-id" },
      });
      mockCalendarAPI.events.update.mockResolvedValue({
        data: { id: "updated-event-id" },
      });
      mockCalendarAPI.events.delete.mockResolvedValue({});

      // Act
      const result = await calendarService.performBatchOperations(
        operations,
        mockUserId
      );

      // Assert
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledTimes(1);
      expect(mockCalendarAPI.events.update).toHaveBeenCalledTimes(1);
      expect(mockCalendarAPI.events.delete).toHaveBeenCalledTimes(1);
    });

    it("should handle partial failures in batch operations", async () => {
      // Arrange
      const operations = [
        {
          operation: "create" as const,
          eventData: {
            title: "New Event",
            description: "Description",
            location: "Location",
            startTime: new Date(),
            endTime: new Date(),
            alarms: [],
            reminders: [],
          },
        },
        {
          operation: "update" as const,
          eventId: "event-to-update",
          eventData: {
            title: "Updated Event",
            description: "Updated Description",
            location: "Updated Location",
            startTime: new Date(),
            endTime: new Date(),
            alarms: [],
            reminders: [],
          },
        },
      ];

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: { id: "new-event-id" },
      });
      mockCalendarAPI.events.update.mockRejectedValue(
        new Error("Update failed")
      );

      // Act
      const result = await calendarService.performBatchOperations(
        operations,
        mockUserId
      );

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("Update failed");
    });
  });

  describe("event description generation", () => {
    it("should generate comprehensive event description", async () => {
      // Arrange
      const mockGoogleEvent = {
        id: "google-event-123",
        summary: "Test Event",
      };

      mockCalendarAPI.events.insert.mockResolvedValue({
        data: mockGoogleEvent,
      });
      mockCalendarEventRepository.findConflictingEvents.mockResolvedValue([]);
      mockCalendarEventRepository.create.mockResolvedValue(mockCalendarEvent);

      // Act
      await calendarService.createCalendarEvent(
        mockScheduleData,
        mockRoutePlan,
        mockWeatherData,
        mockUserId
      );

      // Assert
      const createCall = mockCalendarEventRepository.create.mock.calls[0][0];
      const description = createCall.description;

      expect(description).toContain("🎬 DZIEŃ ZDJĘCIOWY");
      expect(description).toContain("📅 Data:");
      expect(description).toContain("⏰ Call Time: 08:00");
      expect(description).toContain("📍 Lokacja: Studio Filmowe, Warszawa");
      expect(description).toContain("🎭 Typ sceny: EXT");
      expect(description).toContain("🎞️ Sceny: Scene 1, Scene 2");
      expect(description).toContain("🚗 PLAN PODRÓŻY");
      expect(description).toContain("⏰ Pobudka:");
      expect(description).toContain("🚪 Wyjazd:");
      expect(description).toContain("🎯 Przyjazd:");
      expect(description).toContain("🌤️ PROGNOZA POGODY");
      expect(description).toContain("🌡️ Temperatura: 15°C");
      expect(description).toContain("☁️ Warunki: Częściowo pochmurno");
      expect(description).toContain("💨 Wiatr: 5 m/s");
      expect(description).toContain("⚠️ OSTRZEŻENIA:");
      expect(description).toContain("Silny wiatr po południu");
      expect(description).toContain("⚠️ UWAGI BEZPIECZEŃSTWA");
      expect(description).toContain("Uwaga na mokrą nawierzchnię");
      expect(description).toContain("📞 KONTAKTY");
      expect(description).toContain("Jan Kowalski (Reżyser) - +48123456789");
      expect(description).toContain("🎥 SPRZĘT");
      expect(description).toContain("• Kamera");
      expect(description).toContain("• Statyw");
      expect(description).toContain("📝 DODATKOWE UWAGI");
      expect(description).toContain("Dodatkowe uwagi");
      expect(description).toContain(
        "🤖 Automatycznie wygenerowane przez StillOnTime"
      );
    });
  });
});
