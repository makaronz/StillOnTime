import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { prisma } from "@/config/database";
import { CalendarEvent } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("CalendarEventRepository", () => {
  let calendarEventRepository: CalendarEventRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    calendarEventRepository = new CalendarEventRepository();
    jest.clearAllMocks();
  });

  describe("findByScheduleId", () => {
    it("should find calendar event by schedule ID", async () => {
      const mockCalendarEvent: CalendarEvent = {
        id: "event-1",
        calendarEventId: "google-event-123",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-12-01T06:00:00Z"),
        endTime: new Date("2024-12-01T18:00:00Z"),
        description: "Shooting day details",
        location: "Test Location",
        createdAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.calendarEvent.findUnique.mockResolvedValue(mockCalendarEvent);

      const result = await calendarEventRepository.findByScheduleId(
        "schedule-1"
      );

      expect(mockPrisma.calendarEvent.findUnique).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
      });
      expect(result).toEqual(mockCalendarEvent);
    });

    it("should return null if calendar event not found", async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue(null);

      const result = await calendarEventRepository.findByScheduleId(
        "nonexistent"
      );

      expect(result).toBeNull();
    });
  });

  describe("findByCalendarEventId", () => {
    it("should find calendar event by Google Calendar event ID", async () => {
      const mockCalendarEvent: CalendarEvent = {
        id: "event-1",
        calendarEventId: "google-event-123",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-12-01T06:00:00Z"),
        endTime: new Date("2024-12-01T18:00:00Z"),
        description: "Shooting day details",
        location: "Test Location",
        createdAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.calendarEvent.findFirst.mockResolvedValue(mockCalendarEvent);

      const result = await calendarEventRepository.findByCalendarEventId(
        "google-event-123"
      );

      expect(mockPrisma.calendarEvent.findFirst).toHaveBeenCalledWith({
        where: { calendarEventId: "google-event-123" },
      });
      expect(result).toEqual(mockCalendarEvent);
    });
  });

  describe("findUpcomingEvents", () => {
    it("should find upcoming calendar events", async () => {
      const mockEvents = [
        {
          id: "event-1",
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          schedule: {
            location: "Test Location",
            shootingDate: new Date(),
            callTime: "08:00",
            sceneType: "EXT",
          },
        },
      ];

      mockPrisma.calendarEvent.findMany.mockResolvedValue(mockEvents);

      const result = await calendarEventRepository.findUpcomingEvents(
        "user-1",
        5
      );

      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          startTime: {
            gte: expect.any(Date),
          },
        },
        orderBy: { startTime: "asc" },
        take: 5,
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
      });
      expect(result).toEqual(mockEvents);
    });
  });

  describe("findConflictingEvents", () => {
    it("should find conflicting events without exclusion", async () => {
      const startTime = new Date("2024-12-01T08:00:00Z");
      const endTime = new Date("2024-12-01T18:00:00Z");

      const mockConflictingEvents = [
        {
          id: "event-2",
          startTime: new Date("2024-12-01T10:00:00Z"),
          endTime: new Date("2024-12-01T12:00:00Z"),
          schedule: {
            location: "Another Location",
            shootingDate: new Date(),
            callTime: "10:00",
          },
        },
      ];

      mockPrisma.calendarEvent.findMany.mockResolvedValue(
        mockConflictingEvents
      );

      const result = await calendarEventRepository.findConflictingEvents(
        "user-1",
        startTime,
        endTime
      );

      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          OR: [
            {
              startTime: {
                gte: startTime,
                lt: endTime,
              },
            },
            {
              endTime: {
                gt: startTime,
                lte: endTime,
              },
            },
            {
              AND: [
                { startTime: { lte: startTime } },
                { endTime: { gte: endTime } },
              ],
            },
          ],
        },
        include: {
          schedule: {
            select: {
              location: true,
              shootingDate: true,
              callTime: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });
      expect(result).toEqual(mockConflictingEvents);
    });

    it("should find conflicting events with exclusion", async () => {
      const startTime = new Date("2024-12-01T08:00:00Z");
      const endTime = new Date("2024-12-01T18:00:00Z");

      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);

      const result = await calendarEventRepository.findConflictingEvents(
        "user-1",
        startTime,
        endTime,
        "event-1"
      );

      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          id: { not: "event-1" },
          OR: [
            {
              startTime: {
                gte: startTime,
                lt: endTime,
              },
            },
            {
              endTime: {
                gt: startTime,
                lte: endTime,
              },
            },
            {
              AND: [
                { startTime: { lte: startTime } },
                { endTime: { gte: endTime } },
              ],
            },
          ],
        },
        include: {
          schedule: {
            select: {
              location: true,
              shootingDate: true,
              callTime: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });
      expect(result).toEqual([]);
    });
  });

  describe("getEventStats", () => {
    it("should return event statistics", async () => {
      const now = new Date();
      const mockEvents = [
        {
          startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Yesterday
          endTime: new Date(
            now.getTime() - 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000
          ), // 8 hours duration
        },
        {
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
          endTime: new Date(
            now.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000
          ), // 10 hours duration
        },
      ];

      mockPrisma.calendarEvent.count
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1) // upcoming
        .mockResolvedValueOnce(1); // past

      mockPrisma.calendarEvent.findMany.mockResolvedValue(mockEvents);

      const result = await calendarEventRepository.getEventStats("user-1");

      expect(result).toEqual({
        totalEvents: 2,
        upcomingEvents: 1,
        pastEvents: 1,
        averageDuration: 540, // (8*60 + 10*60) / 2 = 540 minutes
      });
    });

    it("should return zero stats for user with no events", async () => {
      mockPrisma.calendarEvent.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // upcoming
        .mockResolvedValueOnce(0); // past

      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);

      const result = await calendarEventRepository.getEventStats("user-1");

      expect(result).toEqual({
        totalEvents: 0,
        upcomingEvents: 0,
        pastEvents: 0,
        averageDuration: 0,
      });
    });
  });

  describe("updateWithCalendarEventId", () => {
    it("should update calendar event with Google Calendar event ID", async () => {
      const mockUpdatedEvent: CalendarEvent = {
        id: "event-1",
        calendarEventId: "google-event-123",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-12-01T06:00:00Z"),
        endTime: new Date("2024-12-01T18:00:00Z"),
        description: "Shooting day details",
        location: "Test Location",
        createdAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.calendarEvent.update.mockResolvedValue(mockUpdatedEvent);

      const result = await calendarEventRepository.updateWithCalendarEventId(
        "event-1",
        "google-event-123"
      );

      expect(mockPrisma.calendarEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { calendarEventId: "google-event-123" },
      });
      expect(result).toEqual(mockUpdatedEvent);
    });
  });

  describe("cleanupOldEvents", () => {
    it("should cleanup old events with default retention", async () => {
      const mockResult = { count: 3 };

      mockPrisma.calendarEvent.deleteMany.mockResolvedValue(mockResult);

      const result = await calendarEventRepository.cleanupOldEvents();

      expect(mockPrisma.calendarEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          endTime: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it("should cleanup old events with custom retention", async () => {
      const mockResult = { count: 1 };

      mockPrisma.calendarEvent.deleteMany.mockResolvedValue(mockResult);

      const result = await calendarEventRepository.cleanupOldEvents(30);

      expect(mockPrisma.calendarEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          endTime: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
