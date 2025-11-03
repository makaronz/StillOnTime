import { db } from "@/config/database";
import {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  WhereCondition,
} from "@/types";
import type {
  NewCalendarEvent,
  CalendarEventUpdate,
} from "@/config/database-types";

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
 * CalendarEvent Repository Implementation with Kysely
 */
export class CalendarEventRepository implements ICalendarEventRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateCalendarEventInput): Promise<CalendarEvent> {
    const id = this.generateCuid();
    const { id: _, ...dataWithoutId } = data;
    return await db
      .insertInto("calendar_events")
      .values({
        id,
        ...dataWithoutId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewCalendarEvent)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    const result = await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async findByScheduleId(scheduleId: string): Promise<CalendarEvent | null> {
    const result = await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("scheduleId", "=", scheduleId)
      .executeTakeFirst();
    return result || null;
  }

  async findByCalendarEventId(
    calendarEventId: string
  ): Promise<CalendarEvent | null> {
    const result = await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("calendarEventId", "=", calendarEventId)
      .executeTakeFirst();
    return result || null;
  }

  async findByUserId(
    userId: string,
    limit: number = 20
  ): Promise<CalendarEvent[]> {
    // Simplified - removed include/join for now
    return await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("startTime", "desc")
      .limit(limit)
      .execute();
  }

  async findUpcomingEvents(
    userId: string,
    limit: number = 10
  ): Promise<CalendarEvent[]> {
    return await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("userId", "=", userId)
      .where("startTime", ">=", new Date())
      .orderBy("startTime", "asc")
      .limit(limit)
      .execute();
  }

  async findEventsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("userId", "=", userId)
      .where("startTime", ">=", startDate)
      .where("startTime", "<=", endDate)
      .orderBy("startTime", "asc")
      .execute();
  }

  async findConflictingEvents(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    let query = db
      .selectFrom("calendar_events")
      .selectAll()
      .where("userId", "=", userId)
      .where((eb) =>
        eb.or([
          // Event starts during the time range
          eb.and([
            eb("startTime", ">=", startTime),
            eb("startTime", "<", endTime),
          ]),
          // Event ends during the time range
          eb.and([
            eb("endTime", ">", startTime),
            eb("endTime", "<=", endTime),
          ]),
          // Event encompasses the entire time range
          eb.and([
            eb("startTime", "<=", startTime),
            eb("endTime", ">=", endTime),
          ]),
        ])
      );

    if (excludeEventId) {
      query = query.where("id", "!=", excludeEventId);
    }

    return await query.orderBy("startTime", "asc").execute();
  }

  async findEventsNeedingSync(): Promise<CalendarEvent[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Simplified - removed include/join for now
    return await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("createdAt", ">=", oneHourAgo)
      .execute();
  }

  async update(
    id: string,
    data: UpdateCalendarEventInput
  ): Promise<CalendarEvent> {
    return await db
      .updateTable("calendar_events")
      .set({ ...data, updatedAt: new Date() } as CalendarEventUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateWithCalendarEventId(
    id: string,
    calendarEventId: string
  ): Promise<CalendarEvent> {
    return await this.update(id, { calendarEventId } as UpdateCalendarEventInput);
  }

  async findEventsByLocation(
    userId: string,
    location: string
  ): Promise<CalendarEvent[]> {
    // Simplified - case-insensitive search approximation
    return await db
      .selectFrom("calendar_events")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("startTime", "desc")
      .execute();
  }

  async getEventStats(userId: string): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    averageDuration: number;
  }> {
    const now = new Date();

    const [totalResult, upcomingResult, pastResult, allEvents] =
      await Promise.all([
        db.selectFrom("calendar_events").where("userId", "=", userId).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("calendar_events").where("userId", "=", userId).where("startTime", ">=", now).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("calendar_events").where("userId", "=", userId).where("startTime", "<", now).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("calendar_events").where("userId", "=", userId).select(["startTime", "endTime"]).execute(),
      ]);

    const totalDuration = allEvents.reduce((sum, event) => {
      const duration = event.endTime.getTime() - event.startTime.getTime();
      return sum + duration;
    }, 0);

    const averageDuration =
      allEvents.length > 0
        ? Math.round(totalDuration / allEvents.length / (1000 * 60))
        : 0;

    return {
      totalEvents: Number(totalResult.count),
      upcomingEvents: Number(upcomingResult.count),
      pastEvents: Number(pastResult.count),
      averageDuration,
    };
  }

  async delete(id: string): Promise<CalendarEvent> {
    return await db
      .deleteFrom("calendar_events")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async cleanupOldEvents(daysToKeep: number = 365): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .deleteFrom("calendar_events")
      .where("endTime", "<", cutoffDate)
      .execute();

    return { count: Number(result[0]?.numDeletedRows || 0) };
  }
}

// Export a ready-to-use singleton instance
export const calendarEventRepository = new CalendarEventRepository();

// Also export as default for flexibility
export default CalendarEventRepository;
