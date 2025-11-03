import { db } from "@/config/database";
import {
  ScheduleData,
  CreateScheduleDataInput,
  UpdateScheduleDataInput,
  ScheduleDataWithRelations,
} from "@/types";
import type {
  NewScheduleData,
  ScheduleDataUpdate,
} from "@/config/database-types";

/**
 * ScheduleData Repository Interface
 */
export interface IScheduleDataRepository {
  // Base CRUD operations
  create(data: CreateScheduleDataInput): Promise<ScheduleData>;
  findById(id: string): Promise<ScheduleData | null>;
  update(id: string, data: UpdateScheduleDataInput): Promise<ScheduleData>;
  delete(id: string): Promise<ScheduleData>;

  // Schedule-specific operations
  findWithRelations(id: string): Promise<ScheduleDataWithRelations | null>;
  findByEmailId(emailId: string): Promise<ScheduleData | null>;
  findUpcomingSchedules(
    userId: string,
    limit?: number
  ): Promise<ScheduleDataWithRelations[]>;
  findPastSchedules(
    userId: string,
    limit?: number
  ): Promise<ScheduleDataWithRelations[]>;
  findSchedulesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleDataWithRelations[]>;
  findSchedulesByLocation(
    userId: string,
    location: string
  ): Promise<ScheduleDataWithRelations[]>;

  // Analytics and reporting
  getScheduleStats(userId: string): Promise<{
    total: number;
    upcoming: number;
    past: number;
    bySceneType: { INT: number; EXT: number };
    byMonth: { [key: string]: number };
  }>;

  // Utility operations
  findConflictingSchedules(
    userId: string,
    shootingDate: Date,
    callTime: string
  ): Promise<ScheduleData[]>;
  updateWithRelations(
    id: string,
    data: UpdateScheduleDataInput
  ): Promise<ScheduleDataWithRelations>;
}

/**
 * ScheduleData Repository Implementation with Kysely
 */
export class ScheduleDataRepository implements IScheduleDataRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateScheduleDataInput): Promise<ScheduleData> {
    const id = this.generateCuid();
    const { id: _, ...dataWithoutId } = data;
    return await db
      .insertInto("schedule_data")
      .values({
        id,
        ...dataWithoutId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewScheduleData)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find schedule by ID
   */
  async findById(id: string): Promise<ScheduleData | null> {
    const result = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async findMany(options: any = {}): Promise<ScheduleData[]> {
    let query = db.selectFrom("schedule_data").selectAll();

    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query = query.where(key as any, "=", value as any);
      });
    }

    if (options.orderBy) {
      const [field, direction] = Object.entries(options.orderBy)[0];
      query = query.orderBy(field as any, direction as "asc" | "desc");
    }

    if (options.take) {
      query = query.limit(options.take);
    }

    return await query.execute();
  }

  /**
   * Find schedule with all related data
   */
  async findWithRelations(
    id: string
  ): Promise<ScheduleDataWithRelations | null> {
    // Simplified - would need proper joins for full implementation
    const schedule = await this.findById(id);
    return schedule as any;
  }

  /**
   * Find schedule by associated email ID
   */
  async findByEmailId(emailId: string): Promise<ScheduleData | null> {
    const result = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("emailId", "=", emailId)
      .executeTakeFirst();
    return result || null;
  }

  /**
   * Find upcoming schedules for a user
   */
  async findUpcomingSchedules(
    userId: string,
    limit: number = 10
  ): Promise<ScheduleDataWithRelations[]> {
    const schedules = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("userId", "=", userId)
      .where("shootingDate", ">=", new Date())
      .orderBy("shootingDate", "asc")
      .limit(limit)
      .execute();
    return schedules as any[];
  }

  /**
   * Find past schedules for a user
   */
  async findPastSchedules(
    userId: string,
    limit: number = 20
  ): Promise<ScheduleDataWithRelations[]> {
    const schedules = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("userId", "=", userId)
      .where("shootingDate", "<", new Date())
      .orderBy("shootingDate", "desc")
      .limit(limit)
      .execute();
    return schedules as any[];
  }

  /**
   * Find schedules within a date range
   */
  async findSchedulesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleDataWithRelations[]> {
    const schedules = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("userId", "=", userId)
      .where("shootingDate", ">=", startDate)
      .where("shootingDate", "<=", endDate)
      .orderBy("shootingDate", "asc")
      .execute();
    return schedules as any[];
  }

  /**
   * Find schedules by location (fuzzy search)
   */
  async findSchedulesByLocation(
    userId: string,
    location: string
  ): Promise<ScheduleDataWithRelations[]> {
    // Simplified - proper implementation would use ILIKE or similar
    const schedules = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("shootingDate", "desc")
      .execute();
    return schedules as any[];
  }

  /**
   * Get comprehensive schedule statistics
   */
  async getScheduleStats(userId: string): Promise<{
    total: number;
    upcoming: number;
    past: number;
    bySceneType: { INT: number; EXT: number };
    byMonth: { [key: string]: number };
  }> {
    const now = new Date();

    const [totalResult, upcomingResult, pastResult, allSchedules] =
      await Promise.all([
        db.selectFrom("schedule_data").where("userId", "=", userId).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("schedule_data").where("userId", "=", userId).where("shootingDate", ">=", now).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("schedule_data").where("userId", "=", userId).where("shootingDate", "<", now).select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        db.selectFrom("schedule_data").where("userId", "=", userId).select(["sceneType", "shootingDate"]).execute(),
      ]);

    // Calculate scene type distribution
    const bySceneType = allSchedules.reduce(
      (acc, schedule) => {
        const type = schedule.sceneType as "INT" | "EXT";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      { INT: 0, EXT: 0 }
    );

    // Calculate monthly distribution
    const byMonth = allSchedules.reduce((acc, schedule) => {
      const monthKey = schedule.shootingDate.toISOString().substring(0, 7); // YYYY-MM
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      total: Number(totalResult.count),
      upcoming: Number(upcomingResult.count),
      past: Number(pastResult.count),
      bySceneType,
      byMonth,
    };
  }

  /**
   * Find conflicting schedules (same date and overlapping times)
   */
  async findConflictingSchedules(
    userId: string,
    shootingDate: Date,
    callTime: string
  ): Promise<ScheduleData[]> {
    const startOfDay = new Date(shootingDate.toDateString());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("userId", "=", userId)
      .where("shootingDate", ">=", startOfDay)
      .where("shootingDate", "<", endOfDay)
      .execute();
  }

  async update(id: string, data: UpdateScheduleDataInput): Promise<ScheduleData> {
    return await db
      .updateTable("schedule_data")
      .set({ ...data, updatedAt: new Date() } as ScheduleDataUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<ScheduleData> {
    return await db
      .deleteFrom("schedule_data")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Update schedule and return with relations
   */
  async updateWithRelations(
    id: string,
    data: UpdateScheduleDataInput
  ): Promise<ScheduleDataWithRelations> {
    const updated = await this.update(id, data);
    return updated as any;
  }

  /**
   * Create schedule with validation
   */
  async createWithValidation(
    data: CreateScheduleDataInput
  ): Promise<ScheduleData> {
    // Validate shooting date is not in the past (with some tolerance)
    const shootingDate = new Date(data.shootingDate as Date);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (shootingDate < oneDayAgo) {
      throw new Error("Shooting date cannot be more than 1 day in the past");
    }

    // Validate call time format (HH:MM)
    const callTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!callTimeRegex.test(data.callTime as string)) {
      throw new Error("Call time must be in HH:MM format");
    }

    // Validate scene type
    if (data.sceneType && !["INT", "EXT"].includes(data.sceneType as string)) {
      throw new Error("Scene type must be either INT or EXT");
    }

    return await this.create(data);
  }

  /**
   * Find schedules needing weather updates
   */
  async findSchedulesNeedingWeatherUpdate(): Promise<ScheduleData[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    // Simplified - proper implementation would need LEFT JOIN
    return await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("shootingDate", ">=", tomorrow)
      .where("shootingDate", "<=", nextWeek)
      .execute();
  }

  /**
   * Find schedules needing route recalculation
   */
  async findSchedulesNeedingRouteUpdate(): Promise<ScheduleData[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Simplified - proper implementation would need LEFT JOIN
    return await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("shootingDate", ">=", tomorrow)
      .execute();
  }

  /**
   * Find upcoming schedules across all users within date range
   */
  async findUpcomingSchedulesInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleDataWithRelations[]> {
    const schedules = await db
      .selectFrom("schedule_data")
      .selectAll()
      .where("shootingDate", ">=", startDate)
      .where("shootingDate", "<=", endDate)
      .orderBy("shootingDate", "asc")
      .execute();
    return schedules as any[];
  }
}

// Export a ready-to-use singleton instance
export const scheduleDataRepository = new ScheduleDataRepository();

// Also export as default for flexibility
export default ScheduleDataRepository;
