import { prisma } from "@/config/database";
import {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";

/**
 * CalendarEvent Repository Interface
 */
export interface ICalendarEventRepository {
  // Base CRUD operations
  create(data: CreateCalendarEventInput): Promise<CalendarEvent>;
  findById(id: string): Promise<CalendarEvent | null>;
  update(id: string, data: UpdateCalendarEventInput): Promise<CalendarEvent>;
  delete(id: string): Promise<CalendarEvent>;

  // CalendarEvent-specific operations
  findByScheduleId(scheduleId: string): Promise<CalendarEvent | null>;
  findByCalendarEventId(calendarEventId: string): Promise<CalendarEvent | null>;
  findByUserId(userId: string, limit?: number): Promise<CalendarEvent[]>;
  findUpcomingEvents(userId: string, limit?: number): Promise<CalendarEvent[]>;
  findEventsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]>;

  // Calendar management operations
  findConflictingEvents(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]>;
  findEventsNeedingSync(): Promise<CalendarEvent[]>;
}

/**
 * CalendarEvent Repository Implementation
 */
export class CalendarEventRepository
  extends AbstractBaseRepository<
    CalendarEvent,
    CreateCalendarEventInput,
    UpdateCalendarEventInput
  >
  implements ICalendarEventRepository
{
  protected model = prisma.calendarEvent;

  /**
   * Find calendar event by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<CalendarEvent | null> {
    return await this.model.findUnique({
      where: { scheduleId },
    });
  }

  /**
   * Find calendar event by Google Calendar event ID
   */
  async findByCalendarEventId(
    calendarEventId: string
  ): Promise<CalendarEvent | null> {
    return await this.model.findFirst({
      where: { calendarEventId },
    });
  }

  /**
   * Find calendar events by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 20
  ): Promise<CalendarEvent[]> {
    return await this.model.findMany({
      where: { userId },
      orderBy: { startTime: "desc" },
      take: limit,
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
  }

  /**
   * Find upcoming calendar events
   */
  async findUpcomingEvents(
    userId: string,
    limit: number = 10
  ): Promise<CalendarEvent[]> {
    return await this.model.findMany({
      where: {
        userId,
        startTime: {
          gte: new Date(),
        },
      },
      orderBy: { startTime: "asc" },
      take: limit,
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
  }

  /**
   * Find calendar events within date range
   */
  async findEventsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return await this.model.findMany({
      where: {
        userId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
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
      orderBy: { startTime: "asc" },
    });
  }

  /**
   * Find conflicting calendar events
   */
  async findConflictingEvents(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    const whereClause: any = {
      userId,
      OR: [
        {
          // Event starts during the time range
          startTime: {
            gte: startTime,
            lt: endTime,
          },
        },
        {
          // Event ends during the time range
          endTime: {
            gt: startTime,
            lte: endTime,
          },
        },
        {
          // Event encompasses the entire time range
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gte: endTime } },
          ],
        },
      ],
    };

    if (excludeEventId) {
      whereClause.id = { not: excludeEventId };
    }

    return await this.model.findMany({
      where: whereClause,
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
  }

  /**
   * Find events that need synchronization with Google Calendar
   * (events that were updated locally but not synced)
   */
  async findEventsNeedingSync(): Promise<CalendarEvent[]> {
    // This would typically include events with a "needsSync" flag
    // For now, we'll return events created in the last hour that might need verification
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return await this.model.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      include: {
        schedule: true,
        user: true,
      },
    });
  }

  /**
   * Update calendar event with Google Calendar event ID
   */
  async updateWithCalendarEventId(
    id: string,
    calendarEventId: string
  ): Promise<CalendarEvent> {
    return await this.model.update({
      where: { id },
      data: { calendarEventId },
    });
  }

  /**
   * Find events by location
   */
  async findEventsByLocation(
    userId: string,
    location: string
  ): Promise<CalendarEvent[]> {
    return await this.model.findMany({
      where: {
        userId,
        OR: [
          { location: { contains: location, mode: "insensitive" } },
          {
            schedule: {
              location: { contains: location, mode: "insensitive" },
            },
          },
        ],
      },
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
      orderBy: { startTime: "desc" },
    });
  }

  /**
   * Get calendar event statistics
   */
  async getEventStats(userId: string): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    averageDuration: number;
  }> {
    const now = new Date();

    const [totalEvents, upcomingEvents, pastEvents, allEvents] =
      await Promise.all([
        this.model.count({ where: { userId } }),
        this.model.count({
          where: {
            userId,
            startTime: { gte: now },
          },
        }),
        this.model.count({
          where: {
            userId,
            startTime: { lt: now },
          },
        }),
        this.model.findMany({
          where: { userId },
          select: {
            startTime: true,
            endTime: true,
          },
        }),
      ]);

    // Calculate average duration in minutes
    const totalDuration = allEvents.reduce((sum, event) => {
      const duration = event.endTime.getTime() - event.startTime.getTime();
      return sum + duration;
    }, 0);

    const averageDuration =
      allEvents.length > 0
        ? Math.round(totalDuration / allEvents.length / (1000 * 60)) // Convert to minutes
        : 0;

    return {
      totalEvents,
      upcomingEvents,
      pastEvents,
      averageDuration,
    };
  }

  /**
   * Clean up old calendar events (data retention)
   */
  async cleanupOldEvents(daysToKeep: number = 365): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await this.model.deleteMany({
      where: {
        endTime: {
          lt: cutoffDate,
        },
      },
    });
  }
}
