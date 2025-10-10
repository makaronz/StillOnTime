import { db } from "@/config/database";
import {
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput,
  WhereCondition,
  ScheduleDataWithRelations,
} from "../types";
import type { NewSummary, SummaryUpdate } from "@/config/database-types";

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
 * Summary Repository Implementation with Kysely
 */
export class SummaryRepository implements ISummaryRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateSummaryInput): Promise<Summary> {
    const id = this.generateCuid();
    return await db
      .insertInto("summaries")
      .values({
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewSummary)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find summary by ID
   */
  async findById(id: string): Promise<Summary | null> {
    const result = await db
      .selectFrom("summaries")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async update(id: string, data: UpdateSummaryInput): Promise<Summary> {
    return await db
      .updateTable("summaries")
      .set({ ...data, updatedAt: new Date() } as SummaryUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<Summary> {
    return await db
      .deleteFrom("summaries")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find summary by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<Summary | null> {
    const result = await db
      .selectFrom("summaries")
      .selectAll()
      .where("scheduleId", "=", scheduleId)
      .executeTakeFirst();
    return result || null;
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
    let query = db
      .selectFrom("summaries")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc");

    if (options?.language) {
      query = query.where("language", "=", options.language);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query.execute();
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
    let query = db
      .selectFrom("summaries")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc");

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const summaries = await query.execute();
    return summaries as any[];
  }

  /**
   * Update or create summary by schedule ID
   */
  async upsertByScheduleId(
    scheduleId: string,
    createData: CreateSummaryInput,
    updateData: UpdateSummaryInput
  ): Promise<Summary> {
    const existing = await this.findByScheduleId(scheduleId);
    if (existing) {
      return await this.update(existing.id, updateData);
    }
    return await this.create(createData);
  }

  /**
   * Delete summaries older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await db
      .deleteFrom("summaries")
      .where("createdAt", "<", date)
      .executeTakeFirst();

    return Number(result.numDeletedRows || 0);
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
    let query = db
      .selectFrom("summaries")
      .where("userId", "=", userId);

    if (fromDate) {
      query = query.where("createdAt", ">=", fromDate);
    }
    if (toDate) {
      query = query.where("createdAt", "<=", toDate);
    }

    const [totalResult, allSummaries, recentResult] = await Promise.all([
      query.select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
      query.select("language").execute(),
      db.selectFrom("summaries")
        .where("userId", "=", userId)
        .where("createdAt", ">=", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow(),
    ]);

    const byLanguage = allSummaries.reduce((acc, summary) => {
      acc[summary.language] = (acc[summary.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: Number(totalResult.count),
      byLanguage,
      recentCount: Number(recentResult.count),
    };
  }
}

// Export a ready-to-use singleton instance
export const summaryRepository = new SummaryRepository();

// Also export as default for flexibility
export default SummaryRepository;
