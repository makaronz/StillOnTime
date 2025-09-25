import { prisma } from "@/config/database";
import {
  ProcessedEmail,
  CreateProcessedEmailInput,
  UpdateProcessedEmailInput,
  ProcessedEmailWithSchedule,
  WhereCondition,
  FindManyOptions,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";
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
 * ProcessedEmail Repository Implementation
 */
export class ProcessedEmailRepository
  extends AbstractBaseRepository<
    ProcessedEmail,
    CreateProcessedEmailInput,
    UpdateProcessedEmailInput
  >
  implements IProcessedEmailRepository
{
  protected model = prisma.processedEmail;

  /**
   * Find email by Gmail message ID
   */
  async findByMessageId(messageId: string): Promise<ProcessedEmail | null> {
    return await this.model.findUnique({
      where: { messageId },
    });
  }

  /**
   * Find email by PDF hash (for duplicate detection)
   */
  async findByPdfHash(pdfHash: string): Promise<ProcessedEmail | null> {
    return await this.model.findFirst({
      where: { pdfHash },
    });
  }

  /**
   * Find email with associated schedule data
   */
  async findWithSchedule(
    id: string
  ): Promise<ProcessedEmailWithSchedule | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        user: true,
        schedule: {
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
      },
    });
  }

  /**
   * Find recent emails for a user with schedule data
   */
  async findRecentEmails(
    userId: string,
    limit: number = 20
  ): Promise<ProcessedEmailWithSchedule[]> {
    return await this.model.findMany({
      where: { userId },
      include: {
        user: true,
        schedule: {
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Find emails that are pending processing
   */
  async findPendingEmails(userId: string): Promise<ProcessedEmail[]> {
    return await this.model.findMany({
      where: {
        userId,
        processed: false,
        processingStatus: "pending",
      },
      orderBy: { receivedAt: "asc" },
    });
  }

  /**
   * Find emails that failed processing
   */
  async findFailedEmails(userId: string): Promise<ProcessedEmail[]> {
    return await this.model.findMany({
      where: {
        userId,
        processed: false,
        processingStatus: "failed",
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  /**
   * Check if email is duplicate based on message ID or PDF hash
   */
  async isDuplicate(messageId: string, pdfHash?: string): Promise<boolean> {
    const whereConditions: WhereCondition[] = [{ messageId }];

    if (pdfHash) {
      whereConditions.push({ pdfHash });
    }

    const existingEmail = await this.model.findFirst({
      where: {
        OR: whereConditions,
      },
    });

    return existingEmail !== null;
  }

  /**
   * Mark email as successfully processed
   */
  async markAsProcessed(
    id: string,
    scheduleId?: string
  ): Promise<ProcessedEmail> {
    return await this.model.update({
      where: { id },
      data: {
        processed: true,
        processingStatus: "completed",
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark email as failed with error message
   */
  async markAsFailed(id: string, error: string): Promise<ProcessedEmail> {
    return await this.model.update({
      where: { id },
      data: {
        processed: false,
        processingStatus: "failed",
        error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Generate SHA-256 hash for PDF content (for duplicate detection)
   */
  generatePdfHash(pdfBuffer: Buffer): string {
    return crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  }

  /**
   * Get processing statistics for a user
   */
  async getProcessingStats(userId: string): Promise<{
    total: number;
    processed: number;
    pending: number;
    failed: number;
  }> {
    const [total, processed, pending, failed] = await Promise.all([
      this.model.count({ where: { userId } }),
      this.model.count({ where: { userId, processed: true } }),
      this.model.count({ where: { userId, processingStatus: "pending" } }),
      this.model.count({ where: { userId, processingStatus: "failed" } }),
    ]);

    return { total, processed, pending, failed };
  }

  /**
   * Create email record with duplicate detection
   */
  async createWithDuplicateCheck(
    data: CreateProcessedEmailInput & {
      pdfBuffer?: Buffer;
    }
  ): Promise<ProcessedEmail | null> {
    const { pdfBuffer, ...emailData } = data;

    // Generate PDF hash if buffer provided
    let pdfHash: string | undefined;
    if (pdfBuffer) {
      pdfHash = this.generatePdfHash(pdfBuffer);
    }

    // Check for duplicates
    const isDupe = await this.isDuplicate(
      emailData.messageId as string,
      pdfHash
    );

    if (isDupe) {
      return null; // Email is duplicate, don't create
    }

    // Create new email record
    return await this.create({
      ...emailData,
      pdfHash,
    } as CreateProcessedEmailInput);
  }

  /**
   * Retry failed email processing
   */
  async retryProcessing(id: string): Promise<ProcessedEmail> {
    return await this.model.update({
      where: { id },
      data: {
        processingStatus: "pending",
        error: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find many emails with schedule data and pagination
   */
  async findManyWithSchedule(
    options: FindManyOptions
  ): Promise<ProcessedEmailWithSchedule[]> {
    return await this.model.findMany({
      ...options,
      include: {
        user: true,
        schedule: {
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
      },
    });
  }

  /**
   * Clean up old processed emails (data retention)
   */
  async cleanupOldEmails(daysToKeep: number = 90): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await this.model.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        processed: true,
      },
    });
  }
}
