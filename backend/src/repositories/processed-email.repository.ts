import { db } from "@/config/database";
import {
  ProcessedEmail,
  CreateProcessedEmailInput,
  UpdateProcessedEmailInput,
  ProcessedEmailWithSchedule,
  WhereCondition,
  FindManyOptions,
} from "@/types";
import type {
  NewProcessedEmail,
  ProcessedEmailUpdate,
} from "@/config/database-types";
import crypto from "crypto";

/**
 * ProcessedEmail Repository Interface
 */
export interface IProcessedEmailRepository {
  // Base CRUD operations
  create(data: CreateProcessedEmailInput): Promise<ProcessedEmail>;
  findById(id: string): Promise<ProcessedEmail | null>;
  update(id: string, data: UpdateProcessedEmailInput): Promise<ProcessedEmail>;
  delete(id: string): Promise<ProcessedEmail>;

  // Email-specific operations
  findByMessageId(messageId: string): Promise<ProcessedEmail | null>;
  findByPdfHash(pdfHash: string): Promise<ProcessedEmail | null>;
  findWithSchedule(id: string): Promise<ProcessedEmailWithSchedule | null>;
  findRecentEmails(
    userId: string,
    limit?: number
  ): Promise<ProcessedEmailWithSchedule[]>;
  findPendingEmails(userId: string): Promise<ProcessedEmail[]>;
  findFailedEmails(userId: string): Promise<ProcessedEmail[]>;

  // Duplicate detection
  isDuplicate(messageId: string, pdfHash?: string): Promise<boolean>;
  markAsProcessed(id: string, scheduleId?: string): Promise<ProcessedEmail>;
  markAsFailed(id: string, error: string): Promise<ProcessedEmail>;

  // Utility operations
  generatePdfHash(pdfBuffer: Buffer): string;
  getProcessingStats(userId: string): Promise<{
    total: number;
    processed: number;
    pending: number;
    failed: number;
  }>;
}

/**
 * ProcessedEmail Repository Implementation with Kysely
 */
export class ProcessedEmailRepository implements IProcessedEmailRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateProcessedEmailInput): Promise<ProcessedEmail> {
    const id = this.generateCuid();
    return await db
      .insertInto("processed_emails")
      .values({
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewProcessedEmail)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<ProcessedEmail | null> {
    const result = await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async findMany(options: any = {}): Promise<ProcessedEmail[]> {
    let query = db.selectFrom("processed_emails").selectAll();

    if (options.where) {
      // Apply where conditions
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

  async update(
    id: string,
    data: UpdateProcessedEmailInput
  ): Promise<ProcessedEmail> {
    return await db
      .updateTable("processed_emails")
      .set({ ...data, updatedAt: new Date() } as ProcessedEmailUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<ProcessedEmail> {
    return await db
      .deleteFrom("processed_emails")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async count(options: any = {}): Promise<number> {
    let query = db.selectFrom("processed_emails").select((eb) =>
      eb.fn.countAll<number>().as("count")
    );

    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query = query.where(key as any, "=", value as any);
      });
    }

    const result = await query.executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async findByMessageId(messageId: string): Promise<ProcessedEmail | null> {
    const result = await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("messageId", "=", messageId)
      .executeTakeFirst();
    return result || null;
  }

  async findByPdfHash(pdfHash: string): Promise<ProcessedEmail | null> {
    const result = await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("pdfHash", "=", pdfHash)
      .executeTakeFirst();
    return result || null;
  }

  async findWithSchedule(
    id: string
  ): Promise<ProcessedEmailWithSchedule | null> {
    // Note: Kysely doesn't have automatic joins like Prisma's include
    // This would need a proper join implementation
    const email = await this.findById(id);
    if (!email) return null;

    // For now, return without relations - proper implementation would use joins
    return email as any;
  }

  async findRecentEmails(
    userId: string,
    limit: number = 20
  ): Promise<ProcessedEmailWithSchedule[]> {
    const emails = await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("receivedAt", "desc")
      .limit(limit)
      .execute();

    return emails as any[];
  }

  async findPendingEmails(userId: string): Promise<ProcessedEmail[]> {
    return await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("userId", "=", userId)
      .where("processed", "=", false)
      .where("processingStatus", "=", "pending")
      .orderBy("receivedAt", "asc")
      .execute();
  }

  async findFailedEmails(userId: string): Promise<ProcessedEmail[]> {
    return await db
      .selectFrom("processed_emails")
      .selectAll()
      .where("userId", "=", userId)
      .where("processed", "=", false)
      .where("processingStatus", "=", "failed")
      .orderBy("receivedAt", "desc")
      .execute();
  }

  async isDuplicate(messageId: string, pdfHash?: string): Promise<boolean> {
    let query = db.selectFrom("processed_emails").select("id");

    if (pdfHash) {
      query = query.where((eb) =>
        eb.or([
          eb("messageId", "=", messageId),
          eb("pdfHash", "=", pdfHash),
        ])
      );
    } else {
      query = query.where("messageId", "=", messageId);
    }

    const result = await query.executeTakeFirst();
    return result !== undefined;
  }

  async markAsProcessed(
    id: string,
    scheduleId?: string
  ): Promise<ProcessedEmail> {
    return await db
      .updateTable("processed_emails")
      .set({
        processed: true,
        processingStatus: "completed",
        updatedAt: new Date(),
      } as ProcessedEmailUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markAsFailed(id: string, error: string): Promise<ProcessedEmail> {
    return await db
      .updateTable("processed_emails")
      .set({
        processed: false,
        processingStatus: "failed",
        error,
        updatedAt: new Date(),
      } as ProcessedEmailUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  generatePdfHash(pdfBuffer: Buffer): string {
    return crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  }

  async getProcessingStats(userId: string): Promise<{
    total: number;
    processed: number;
    pending: number;
    failed: number;
  }> {
    const [total, processed, pending, failed] = await Promise.all([
      this.count({ where: { userId } }),
      this.count({ where: { userId, processed: true } }),
      this.count({ where: { userId, processingStatus: "pending" } }),
      this.count({ where: { userId, processingStatus: "failed" } }),
    ]);

    return { total, processed, pending, failed };
  }

  async createWithDuplicateCheck(
    data: CreateProcessedEmailInput & {
      pdfBuffer?: Buffer;
    }
  ): Promise<ProcessedEmail | null> {
    const { pdfBuffer, ...emailData } = data;

    let pdfHash: string | undefined;
    if (pdfBuffer) {
      pdfHash = this.generatePdfHash(pdfBuffer);
    }

    const isDupe = await this.isDuplicate(
      emailData.messageId as string,
      pdfHash
    );

    if (isDupe) {
      return null;
    }

    return await this.create({
      ...emailData,
      pdfHash,
    } as CreateProcessedEmailInput);
  }

  async retryProcessing(id: string): Promise<ProcessedEmail> {
    return await db
      .updateTable("processed_emails")
      .set({
        processingStatus: "pending",
        error: null,
        updatedAt: new Date(),
      } as ProcessedEmailUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findManyWithSchedule(
    options: FindManyOptions
  ): Promise<ProcessedEmailWithSchedule[]> {
    // Simplified version - proper implementation would use joins
    const emails = await this.findMany(options);
    return emails as any[];
  }

  async cleanupOldEmails(daysToKeep: number = 90): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .deleteFrom("processed_emails")
      .where("createdAt", "<", cutoffDate)
      .where("processed", "=", true)
      .execute();

    return { count: Number(result[0]?.numDeletedRows || 0) };
  }
}

// Export a ready-to-use singleton instance
export const processedEmailRepository = new ProcessedEmailRepository();

// Also export as default for flexibility
export default ProcessedEmailRepository;
