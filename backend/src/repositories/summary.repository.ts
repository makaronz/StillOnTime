import { AbstractBaseRepository } from "./base.repository";
import { prisma } from "@/prisma";
import {
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput,
  WhereCondition,
  ScheduleDataWithRelations,
} from "../types";
import { Prisma } from "@prisma/client";

/**
 * Summary Repository Interface
 */
export interface ISummaryRepository {
  // Base CRUD operations
  create(data: CreateSummaryInput): Promise<Summary>;
  findById(id: string): Promise<Summary | null>;
  update(id: string, data: UpdateSummaryInput): Promise<Summary>;
  delete(id: string): Promise<Summary>;

  // Summary-specific operations
  findByScheduleId(scheduleId: string): Promise<Summary | null>;
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      language?: string;
    }
  ): Promise<Summary[]>;
  findWithSchedule(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<Array<Summary & { schedule: ScheduleDataWithRelations }>>;
  upsertByScheduleId(
    scheduleId: string,
    createData: CreateSummaryInput,
    updateData: UpdateSummaryInput
  ): Promise<Summary>;
  deleteOlderThan(date: Date): Promise<number>;
  getStatistics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    total: number;
    byLanguage: Record<string, number>;
    recentCount: number;
  }>;
}

/**
 * Summary Repository Implementation
 */
export class SummaryRepository
  extends AbstractBaseRepository<Summary, CreateSummaryInput, UpdateSummaryInput>
  implements ISummaryRepository
{
  protected model = prisma.summary;

  // Prisma-specific methods for advanced usage
  createPrisma(args: Prisma.SummaryCreateArgs) {
    return this.model.create(args);
  }

  createManyPrisma(args: Prisma.SummaryCreateManyArgs) {
    return this.model.createMany(args);
  }

  updatePrisma(args: Prisma.SummaryUpdateArgs) {
    return this.model.update(args);
  }

  findUnique(args: Prisma.SummaryFindUniqueArgs) {
    return this.model.findUnique(args);
  }

  findMany(args?: Prisma.SummaryFindManyArgs) {
    return this.model.findMany(args);
  }

  deletePrisma(args: Prisma.SummaryDeleteArgs) {
    return this.model.delete(args);
  }

  deleteManyPrisma(args: Prisma.SummaryDeleteManyArgs) {
    return this.model.deleteMany(args);
  }

  /**
   * Find summary by ID
   */
  async findById(id: string): Promise<Summary | null> {
    return await this.model.findUnique({
      where: { id },
    });
  }

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
    const where: WhereCondition = { userId };

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
  ): Promise<Array<Summary & { schedule: ScheduleDataWithRelations }>> {
    const where: WhereCondition = { userId };

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
            user: true,
            email: true,
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
            summary: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

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
    const where: WhereCondition = { userId };

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
        (
          acc: Record<string, number>,
          item: { language: string; _count: { language: number } }
        ) => {
          acc[item.language] = item._count.language;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentCount,
    };
  }
}

// Export a ready-to-use singleton instance
export const summaryRepository = new SummaryRepository();

// Also export as default for flexibility
export default SummaryRepository;
