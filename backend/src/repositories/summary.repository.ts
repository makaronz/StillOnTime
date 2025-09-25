import { AbstractBaseRepository } from "./base.repository";
import { prisma } from "../config/database";
import { Summary, CreateSummaryInput, UpdateSummaryInput } from "../types";

export class SummaryRepository extends AbstractBaseRepository<
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput
> {
  protected model = prisma.summary;
  // Inherits create from AbstractBaseRepository

  // Inherits findById from AbstractBaseRepository

  /**
   * Find summary by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<Summary | null> {
    return this.model.findUnique({
      where: { scheduleId },
    });
  }

  /**
   * Find summaries by user ID
   */
  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      language?: string;
    }
  ): Promise<Summary[]> {
    const where: any = { userId };

    if (options?.language) {
      where.language = options.language;
    }

    return this.model.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Find summaries with schedule data
   */
  async findWithSchedule(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<Array<Summary & { schedule: any }>> {
    const where: any = { userId };

    if (options?.fromDate || options?.toDate) {
      where.schedule = {};
      if (options.fromDate) {
        where.schedule.shootingDate = { gte: options.fromDate };
      }
      if (options.toDate) {
        where.schedule.shootingDate = {
          ...where.schedule.shootingDate,
          lte: options.toDate,
        };
      }
    }

    return this.model.findMany({
      where,
      include: {
        schedule: {
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  // Inherits update from AbstractBaseRepository

  /**
   * Update or create summary by schedule ID
   */
  async upsertByScheduleId(
    scheduleId: string,
    createData: CreateSummaryInput,
    updateData: UpdateSummaryInput
  ): Promise<Summary> {
    return this.model.upsert({
      where: { scheduleId },
      create: createData,
      update: updateData,
    });
  }

  // Inherits delete from AbstractBaseRepository

  /**
   * Delete summaries older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.model.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
      },
    });

    return result.count;
  }

  /**
   * Get summary statistics for a user
   */
  async getStatistics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    total: number;
    byLanguage: Record<string, number>;
    recentCount: number;
  }> {
    const where: any = { userId };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const [total, byLanguage, recentCount] = await Promise.all([
      this.model.count({ where }),
      this.model.groupBy({
        by: ["language"],
        where,
        _count: { language: true },
      }),
      this.model.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      total,
      byLanguage: byLanguage.reduce(
        (acc: Record<string, number>, item: any) => {
          acc[item.language] = item._count.language;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentCount,
    };
  }
}
