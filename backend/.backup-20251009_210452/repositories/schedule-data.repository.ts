import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client";
import {
  ScheduleData,
  CreateScheduleDataInput,
  UpdateScheduleDataInput,
  ScheduleDataWithRelations,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";

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
 * ScheduleData Repository Implementation
 */
export class ScheduleDataRepository
  extends AbstractBaseRepository<
    ScheduleData,
    CreateScheduleDataInput,
    UpdateScheduleDataInput
  >
  implements IScheduleDataRepository
{
  protected model = prisma.scheduleData;

  // Prisma-specific methods for advanced usage
  createPrisma(args: Prisma.ScheduleDataCreateArgs) {
    return this.model.create(args);
  }

  createManyPrisma(args: Prisma.ScheduleDataCreateManyArgs) {
    return this.model.createMany(args);
  }

  updatePrisma(args: Prisma.ScheduleDataUpdateArgs) {
    return this.model.update(args);
  }

  findUnique(args: Prisma.ScheduleDataFindUniqueArgs) {
    return this.model.findUnique(args);
  }

  findMany(args?: Prisma.ScheduleDataFindManyArgs) {
    return this.model.findMany(args);
  }

  deletePrisma(args: Prisma.ScheduleDataDeleteArgs) {
    return this.model.delete(args);
  }

  deleteManyPrisma(args: Prisma.ScheduleDataDeleteManyArgs) {
    return this.model.deleteMany(args);
  }

  /**
   * Find schedule by ID
   */
  async findById(id: string): Promise<ScheduleData | null> {
    return await this.model.findUnique({
      where: { id },
    });
  }

  /**
   * Find schedule with all related data
   */
  async findWithRelations(
    id: string
  ): Promise<ScheduleDataWithRelations | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
    });
  }

  /**
   * Find schedule by associated email ID
   */
  async findByEmailId(emailId: string): Promise<ScheduleData | null> {
    return await this.model.findUnique({
      where: { emailId },
    });
  }

  /**
   * Find upcoming schedules for a user
   */
  async findUpcomingSchedules(
    userId: string,
    limit: number = 10
  ): Promise<ScheduleDataWithRelations[]> {
    return await this.model.findMany({
      where: {
        userId,
        shootingDate: {
          gte: new Date(),
        },
      },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
      orderBy: { shootingDate: "asc" },
      take: limit,
    });
  }

  /**
   * Find past schedules for a user
   */
  async findPastSchedules(
    userId: string,
    limit: number = 20
  ): Promise<ScheduleDataWithRelations[]> {
    return await this.model.findMany({
      where: {
        userId,
        shootingDate: {
          lt: new Date(),
        },
      },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
      orderBy: { shootingDate: "desc" },
      take: limit,
    });
  }

  /**
   * Find schedules within a date range
   */
  async findSchedulesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleDataWithRelations[]> {
    return await this.model.findMany({
      where: {
        userId,
        shootingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
      orderBy: { shootingDate: "asc" },
    });
  }

  /**
   * Find schedules by location (fuzzy search)
   */
  async findSchedulesByLocation(
    userId: string,
    location: string
  ): Promise<ScheduleDataWithRelations[]> {
    return await this.model.findMany({
      where: {
        userId,
        OR: [
          { location: { contains: location, mode: "insensitive" } },
          { baseLocation: { contains: location, mode: "insensitive" } },
        ],
      },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
      orderBy: { shootingDate: "desc" },
    });
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

    const [total, upcoming, past, allSchedules] = await Promise.all([
      this.model.count({ where: { userId } }),
      this.model.count({
        where: {
          userId,
          shootingDate: { gte: now },
        },
      }),
      this.model.count({
        where: {
          userId,
          shootingDate: { lt: now },
        },
      }),
      this.model.findMany({
        where: { userId },
        select: {
          sceneType: true,
          shootingDate: true,
        },
      }),
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
      total,
      upcoming,
      past,
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
    // For simplicity, we'll check for same date conflicts
    // In a more sophisticated system, we'd parse call times and check for overlaps
    return await this.model.findMany({
      where: {
        userId,
        shootingDate: {
          gte: new Date(shootingDate.toDateString()), // Start of day
          lt: new Date(
            new Date(shootingDate.toDateString()).getTime() +
              24 * 60 * 60 * 1000
          ), // End of day
        },
      },
    });
  }

  /**
   * Update schedule and return with relations
   */
  async updateWithRelations(
    id: string,
    data: UpdateScheduleDataInput
  ): Promise<ScheduleDataWithRelations> {
    const updated = await this.model.update({
      where: { id },
      data,
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
    });

    return updated;
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

    return await this.createPrisma({ data });
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

    return await this.model.findMany({
      where: {
        shootingDate: {
          gte: tomorrow,
          lte: nextWeek,
        },
        OR: [
          { weatherData: null },
          {
            weatherData: {
              fetchedAt: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
              },
            },
          },
        ],
      },
      include: {
        weatherData: true,
      },
    });
  }

  /**
   * Find schedules needing route recalculation
   */
  async findSchedulesNeedingRouteUpdate(): Promise<ScheduleData[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.model.findMany({
      where: {
        shootingDate: {
          gte: tomorrow,
        },
        routePlan: null,
      },
    });
  }

  /**
   * Find upcoming schedules across all users within date range
   */
  async findUpcomingSchedulesInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleDataWithRelations[]> {
    return await this.model.findMany({
      where: {
        shootingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
        email: true,
        routePlan: true,
        weatherData: true,
        calendarEvent: true,
        summary: true,
      },
      orderBy: { shootingDate: "asc" },
    });
  }
}

// Export a ready-to-use singleton instance
export const scheduleDataRepository = new ScheduleDataRepository();

// Also export as default for flexibility
export default ScheduleDataRepository;
