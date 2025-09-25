import { CalendarManagerService } from "@/services/calendar-manager.service";
import { CalendarService } from "@/services/calendar.service";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { logger } from "@/utils/logger";
import { ScheduleData, RoutePlan, WeatherData, CalendarEvent } from "@/types";

// Mock dependencies
jest.mock("@/utils/logger");
jest.mock("@/services/calendar.service");
jest.mock("@/repositories/calendar-event.repository");
jest.mock("@/repositories/schedule-data.repository");

describe("CalendarManagerService", () => {
  let calendarManagerService: CalendarManagerService;
  let mockCalendarService: jest.Mocked<CalendarService>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockScheduleDataRepository: jest.Mocked<ScheduleDataRepository>;

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

  const mockConflictingEvent: CalendarEvent = {
    id: "conflicting-event-123",
    calendarEventId: "google-conflicting-123",
    title: "Conflicting Event",
    startTime: new Date("2024-03-15T07:00:00Z"),
    endTime: new Date("2024-03-15T09:00:00Z"),
    description: "Conflicting event description",
    location: "Other Location",
    createdAt: new Date(),
    userId: mockUserId,
    scheduleId: "other-schedule-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CalendarService
    mockCalendarService = {
      createCalendarEvent: jest.fn(),
      updateCalendarEvent: jest.fn(),
      deleteCalendarEvent: jest.fn(),
      detectConflicts: jest.fn(),
      performBatchOperations: jest.fn(),
      setMultipleAlarms: jest.fn(),
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
      getEventStats: jest.fn(),
    } as any;

    // Mock ScheduleDataRepository
    mockScheduleDataRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
    } as any;

    calendarManagerService = new CalendarManagerService(
      mockCalendarService,
      mockCalendarEventRepository,
      mockScheduleDataRepository
    );
  });

  describe("createEventWithConflictResolution", () => {
    it("should create event without conflicts", async () => {
      // Arrange
      mockCalendarService.detectConflicts.mockResolvedValue([]);
      mockCalendarService.createCalendarEvent.mockResolvedValue(
        mockCalendarEvent
      );

      // Act
      const result =
        await calendarManagerService.createEventWithConflictResolution(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId,
          true
        );

      // Assert
      expect(mockCalendarService.detectConflicts).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockCalendarService.createCalendarEvent).toHaveBeenCalledWith(
        mockScheduleData,
        mockRoutePlan,
        mockWeatherData,
        mockUserId
      );
      expect(result.event).toEqual(mockCalendarEvent);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect and resolve conflicts automatically", async () => {
      // Arrange
      const mockConflict = {
        conflictingEvent: mockConflictingEvent,
        overlapType: "partial" as const,
        overlapDuration: 20, // 20 minutes overlap
      };

      mockCalendarService.detectConflicts.mockResolvedValue([mockConflict]);
      mockCalendarService.createCalendarEvent.mockResolvedValue(
        mockCalendarEvent
      );
      mockCalendarEventRepository.update.mockResolvedValue(
        mockConflictingEvent
      );

      // Act
      const result =
        await calendarManagerService.createEventWithConflictResolution(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId,
          true
        );

      // Assert
      expect(result.event).toEqual(mockCalendarEvent);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBeDefined();
      expect(result.conflicts[0].resolution?.strategy).toBe("reschedule");
    });

    it("should detect conflicts but not resolve when autoResolve is false", async () => {
      // Arrange
      const mockConflict = {
        conflictingEvent: mockConflictingEvent,
        overlapType: "partial" as const,
        overlapDuration: 60,
      };

      mockCalendarService.detectConflicts.mockResolvedValue([mockConflict]);
      mockCalendarService.createCalendarEvent.mockResolvedValue(
        mockCalendarEvent
      );

      // Act
      const result =
        await calendarManagerService.createEventWithConflictResolution(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId,
          false
        );

      // Assert
      expect(result.event).toEqual(mockCalendarEvent);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBeUndefined();
    });

    it("should handle major conflicts with override strategy", async () => {
      // Arrange
      const mockConflict = {
        conflictingEvent: {
          ...mockConflictingEvent,
          title: "StillOnTime — Other Shoot",
        },
        overlapType: "complete" as const,
        overlapDuration: 120, // 2 hours overlap
      };

      mockCalendarService.detectConflicts.mockResolvedValue([mockConflict]);
      mockCalendarService.createCalendarEvent.mockResolvedValue(
        mockCalendarEvent
      );

      // Act
      const result =
        await calendarManagerService.createEventWithConflictResolution(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId,
          true
        );

      // Assert
      expect(result.conflicts[0].resolution?.strategy).toBe("override");
      expect(result.conflicts[0].resolution?.reason).toContain(
        "Film shoot takes priority"
      );
    });
  });

  describe("performBatchSync", () => {
    it("should sync all events successfully", async () => {
      // Arrange
      const eventsToSync = [mockCalendarEvent, mockConflictingEvent];
      mockCalendarEventRepository.findEventsNeedingSync.mockResolvedValue(
        eventsToSync
      );

      // Act
      const result = await calendarManagerService.performBatchSync(mockUserId);

      // Assert
      expect(
        mockCalendarEventRepository.findEventsNeedingSync
      ).toHaveBeenCalled();
      expect(result.synced).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should sync specific events when eventIds provided", async () => {
      // Arrange
      const eventIds = ["calendar-event-123"];
      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await calendarManagerService.performBatchSync(
        mockUserId,
        eventIds
      );

      // Assert
      expect(mockCalendarEventRepository.findById).toHaveBeenCalledWith(
        "calendar-event-123"
      );
      expect(result.synced).toHaveLength(1);
    });

    it("should handle sync failures gracefully", async () => {
      // Arrange
      const eventsToSync = [mockCalendarEvent];
      mockCalendarEventRepository.findEventsNeedingSync.mockResolvedValue(
        eventsToSync
      );

      // Mock sync failure by making the service throw an error
      jest
        .spyOn(calendarManagerService as any, "syncSingleEvent")
        .mockRejectedValue(new Error("Sync failed"));

      // Act
      const result = await calendarManagerService.performBatchSync(mockUserId);

      // Assert
      expect(result.synced).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("Sync failed");
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync status for all user events", async () => {
      // Arrange
      const userEvents = [mockCalendarEvent, mockConflictingEvent];
      mockCalendarEventRepository.findByUserId.mockResolvedValue(userEvents);

      // Act
      const result = await calendarManagerService.getSyncStatus(mockUserId);

      // Assert
      expect(mockCalendarEventRepository.findByUserId).toHaveBeenCalledWith(
        mockUserId
      );
      expect(result).toHaveLength(2);
      expect(result[0].eventId).toBe(mockCalendarEvent.id);
      expect(result[0].syncStatus).toBe("synced");
    });

    it("should return sync status for specific events", async () => {
      // Arrange
      const eventIds = ["calendar-event-123"];
      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await calendarManagerService.getSyncStatus(
        mockUserId,
        eventIds
      );

      // Assert
      expect(mockCalendarEventRepository.findById).toHaveBeenCalledWith(
        "calendar-event-123"
      );
      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe(mockCalendarEvent.id);
    });

    it("should handle events without Google Calendar ID", async () => {
      // Arrange
      const eventWithoutGoogleId = {
        ...mockCalendarEvent,
        calendarEventId: "",
      };
      mockCalendarEventRepository.findByUserId.mockResolvedValue([
        eventWithoutGoogleId,
      ]);

      // Act
      const result = await calendarManagerService.getSyncStatus(mockUserId);

      // Assert
      expect(result[0].syncStatus).toBe("pending");
      expect(result[0].needsManualReview).toBe(false);
    });
  });

  describe("applyManualOverride", () => {
    it("should apply time override successfully", async () => {
      // Arrange
      const override = {
        overrideType: "time" as const,
        originalValue: {
          startTime: mockCalendarEvent.startTime,
          endTime: mockCalendarEvent.endTime,
        },
        overrideValue: {
          startTime: new Date("2024-03-15T07:00:00Z"),
          endTime: new Date("2024-03-15T19:00:00Z"),
        },
        reason: "Schedule change requested",
        appliedBy: "user-123",
      };

      const updatedEvent = {
        ...mockCalendarEvent,
        startTime: new Date("2024-03-15T07:00:00Z"),
        endTime: new Date("2024-03-15T19:00:00Z"),
      };

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarEventRepository.update.mockResolvedValue(updatedEvent);

      // Act
      const result = await calendarManagerService.applyManualOverride(
        mockCalendarEvent.id,
        override,
        mockUserId
      );

      // Assert
      expect(mockCalendarEventRepository.findById).toHaveBeenCalledWith(
        mockCalendarEvent.id
      );
      expect(mockCalendarEventRepository.update).toHaveBeenCalledWith(
        mockCalendarEvent.id,
        {
          startTime: override.overrideValue.startTime,
          endTime: override.overrideValue.endTime,
        }
      );
      expect(result).toEqual(updatedEvent);
    });

    it("should apply location override successfully", async () => {
      // Arrange
      const override = {
        overrideType: "location" as const,
        originalValue: mockCalendarEvent.location,
        overrideValue: "New Location",
        reason: "Location changed",
        appliedBy: "user-123",
      };

      const updatedEvent = {
        ...mockCalendarEvent,
        location: "New Location",
      };

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarEventRepository.update.mockResolvedValue(updatedEvent);

      // Act
      const result = await calendarManagerService.applyManualOverride(
        mockCalendarEvent.id,
        override,
        mockUserId
      );

      // Assert
      expect(mockCalendarEventRepository.update).toHaveBeenCalledWith(
        mockCalendarEvent.id,
        { location: "New Location" }
      );
      expect(result).toEqual(updatedEvent);
    });

    it("should apply description override successfully", async () => {
      // Arrange
      const override = {
        overrideType: "description" as const,
        originalValue: mockCalendarEvent.description,
        overrideValue: "Updated description",
        reason: "Description update requested",
        appliedBy: "user-123",
      };

      const updatedEvent = {
        ...mockCalendarEvent,
        description: "Updated description",
      };

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarEventRepository.update.mockResolvedValue(updatedEvent);

      // Act
      const result = await calendarManagerService.applyManualOverride(
        mockCalendarEvent.id,
        override,
        mockUserId
      );

      // Assert
      expect(mockCalendarEventRepository.update).toHaveBeenCalledWith(
        mockCalendarEvent.id,
        { description: "Updated description" }
      );
      expect(result).toEqual(updatedEvent);
    });

    it("should handle alarm override with logging", async () => {
      // Arrange
      const override = {
        overrideType: "alarms" as const,
        originalValue: [],
        overrideValue: [
          { method: "popup", minutes: 15 },
          { method: "email", minutes: 60 },
        ],
        reason: "Custom alarm setup",
        appliedBy: "user-123",
      };

      mockCalendarEventRepository.findById.mockResolvedValue(mockCalendarEvent);
      mockCalendarEventRepository.update.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await calendarManagerService.applyManualOverride(
        mockCalendarEvent.id,
        override,
        mockUserId
      );

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "Alarm override requested",
        expect.objectContaining({
          eventId: mockCalendarEvent.id,
          alarms: override.overrideValue,
        })
      );
      expect(result).toEqual(mockCalendarEvent);
    });

    it("should throw error when event not found", async () => {
      // Arrange
      const override = {
        overrideType: "location" as const,
        originalValue: "Old Location",
        overrideValue: "New Location",
        reason: "Location changed",
        appliedBy: "user-123",
      };

      mockCalendarEventRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        calendarManagerService.applyManualOverride(
          "non-existent-event",
          override,
          mockUserId
        )
      ).rejects.toThrow("Calendar event not found");
    });
  });

  describe("getCalendarAnalytics", () => {
    it("should return comprehensive analytics", async () => {
      // Arrange
      const mockStats = {
        totalEvents: 50,
        upcomingEvents: 10,
        pastEvents: 40,
        averageDuration: 120, // 2 hours
      };

      const mockEvents = [
        { ...mockCalendarEvent, location: "Studio A" },
        { ...mockCalendarEvent, id: "event-2", location: "Studio A" },
        { ...mockCalendarEvent, id: "event-3", location: "Studio B" },
      ];

      mockCalendarEventRepository.getEventStats.mockResolvedValue(mockStats);
      mockCalendarEventRepository.findByUserId.mockResolvedValue(mockEvents);

      // Act
      const result = await calendarManagerService.getCalendarAnalytics(
        mockUserId
      );

      // Assert
      expect(result.totalEvents).toBe(50);
      expect(result.upcomingEvents).toBe(10);
      expect(result.averageEventDuration).toBe(120);
      expect(result.mostCommonLocations).toEqual([
        { location: "Studio A", count: 2 },
        { location: "Studio B", count: 1 },
      ]);
      expect(result.conflictRate).toBe(0); // Placeholder value
      expect(result.syncSuccessRate).toBe(95); // Placeholder value
    });

    it("should return analytics for specific date range", async () => {
      // Arrange
      const dateRange = {
        start: new Date("2024-03-01"),
        end: new Date("2024-03-31"),
      };

      const mockStats = {
        totalEvents: 10,
        upcomingEvents: 5,
        pastEvents: 5,
        averageDuration: 90,
      };

      mockCalendarEventRepository.getEventStats.mockResolvedValue(mockStats);
      mockCalendarEventRepository.findEventsByDateRange.mockResolvedValue([
        mockCalendarEvent,
      ]);

      // Act
      const result = await calendarManagerService.getCalendarAnalytics(
        mockUserId,
        dateRange
      );

      // Assert
      expect(
        mockCalendarEventRepository.findEventsByDateRange
      ).toHaveBeenCalledWith(mockUserId, dateRange.start, dateRange.end);
      expect(result.totalEvents).toBe(10);
    });
  });

  describe("error handling", () => {
    it("should handle createEventWithConflictResolution errors", async () => {
      // Arrange
      mockCalendarService.detectConflicts.mockRejectedValue(
        new Error("Conflict detection failed")
      );

      // Act & Assert
      await expect(
        calendarManagerService.createEventWithConflictResolution(
          mockScheduleData,
          mockRoutePlan,
          mockWeatherData,
          mockUserId
        )
      ).rejects.toThrow(
        "Failed to create calendar event with conflict resolution"
      );
    });

    it("should handle performBatchSync errors", async () => {
      // Arrange
      mockCalendarEventRepository.findEventsNeedingSync.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        calendarManagerService.performBatchSync(mockUserId)
      ).rejects.toThrow("Failed to perform batch synchronization");
    });

    it("should handle getSyncStatus errors", async () => {
      // Arrange
      mockCalendarEventRepository.findByUserId.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        calendarManagerService.getSyncStatus(mockUserId)
      ).rejects.toThrow("Failed to get sync status");
    });

    it("should handle applyManualOverride errors", async () => {
      // Arrange
      const override = {
        overrideType: "location" as const,
        originalValue: "Old Location",
        overrideValue: "New Location",
        reason: "Location changed",
        appliedBy: "user-123",
      };

      mockCalendarEventRepository.findById.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        calendarManagerService.applyManualOverride(
          mockCalendarEvent.id,
          override,
          mockUserId
        )
      ).rejects.toThrow("Failed to apply manual override");
    });

    it("should handle getCalendarAnalytics errors", async () => {
      // Arrange
      mockCalendarEventRepository.getEventStats.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(
        calendarManagerService.getCalendarAnalytics(mockUserId)
      ).rejects.toThrow("Failed to get calendar analytics");
    });
  });
});
