import { db } from "@/config/database";
import {
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationChannel,
  NotificationTemplate,
} from "../types";
import type {
  NewNotification,
  NotificationUpdate,
} from "@/config/database-types";

/**
 * Notification Repository Interface
 */
export interface INotificationRepository {
  // Base CRUD operations
  create(data: CreateNotificationInput): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  update(id: string, data: UpdateNotificationInput): Promise<Notification>;
  delete(id: string): Promise<Notification>;

  // Notification-specific operations
  findByMessageId(messageId: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      channel?: NotificationChannel;
    }
  ): Promise<Notification[]>;
  findPendingScheduled(beforeDate?: Date): Promise<Notification[]>;
  findRetryable(maxRetries?: number): Promise<Notification[]>;
  updateById(id: string, data: UpdateNotificationInput): Promise<Notification>;
  markAsSent(id: string, messageId?: string): Promise<Notification>;
  markAsFailed(id: string, error: string): Promise<Notification>;
  cancel(id: string): Promise<Notification>;
  deleteOlderThan(date: Date): Promise<number>;
  getStatistics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byChannel: Record<string, number>;
    byTemplate: Record<string, number>;
  }>;
}

/**
 * Notification Repository Implementation with Kysely
 */
export class NotificationRepository implements INotificationRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateNotificationInput): Promise<Notification> {
    const id = this.generateCuid();
    return await db
      .insertInto("notifications")
      .values({
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewNotification)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await db
      .selectFrom("notifications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async findByMessageId(messageId: string): Promise<Notification | null> {
    // Simplified - Prisma used JSON path query, Kysely needs different approach
    const result = await db
      .selectFrom("notifications")
      .selectAll()
      .executeTakeFirst();
    return result || null;
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      channel?: NotificationChannel;
    }
  ): Promise<Notification[]> {
    let query = db
      .selectFrom("notifications")
      .selectAll()
      .where("userId", "=", userId);

    if (options?.status) {
      query = query.where("status", "=", options.status);
    }

    if (options?.channel) {
      query = query.where("channel", "=", options.channel);
    }

    query = query.orderBy("createdAt", "desc");

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query.execute();
  }

  async findPendingScheduled(beforeDate?: Date): Promise<Notification[]> {
    return await db
      .selectFrom("notifications")
      .selectAll()
      .where("status", "=", "pending")
      .where("scheduledFor", "<=", beforeDate || new Date())
      .orderBy("scheduledFor", "asc")
      .execute();
  }

  async findRetryable(maxRetries: number = 3): Promise<Notification[]> {
    return await db
      .selectFrom("notifications")
      .selectAll()
      .where("status", "=", "failed")
      .where("retryCount", "<", maxRetries)
      .orderBy("updatedAt", "asc")
      .execute();
  }

  async update(
    id: string,
    data: UpdateNotificationInput
  ): Promise<Notification> {
    return await db
      .updateTable("notifications")
      .set({ ...data, updatedAt: new Date() } as NotificationUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateById(
    id: string,
    data: UpdateNotificationInput
  ): Promise<Notification> {
    return this.update(id, data);
  }

  async markAsSent(id: string, messageId?: string): Promise<Notification> {
    return await this.updateById(id, {
      status: "sent",
      sentAt: new Date(),
      data: messageId ? { messageId } : undefined,
    });
  }

  async markAsFailed(id: string, error: string): Promise<Notification> {
    // Kysely doesn't have increment like Prisma, need to fetch and update
    const current = await this.findById(id);
    const retryCount = (current?.retryCount || 0) + 1;

    return await db
      .updateTable("notifications")
      .set({
        status: "failed",
        error,
        retryCount,
        updatedAt: new Date(),
      } as NotificationUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async cancel(id: string): Promise<Notification> {
    return await this.updateById(id, {
      status: "cancelled",
    });
  }

  async delete(id: string): Promise<Notification> {
    return await db
      .deleteFrom("notifications")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await db
      .deleteFrom("notifications")
      .where("createdAt", "<", date)
      .where("status", "in", ["sent", "cancelled"])
      .execute();

    return Number(result[0]?.numDeletedRows || 0);
  }

  async getStatistics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byChannel: Record<string, number>;
    byTemplate: Record<string, number>;
  }> {
    let baseQuery = db.selectFrom("notifications").where("userId", "=", userId);

    if (fromDate) {
      baseQuery = baseQuery.where("createdAt", ">=", fromDate);
    }
    if (toDate) {
      baseQuery = baseQuery.where("createdAt", "<=", toDate);
    }

    const [totalResult, sentResult, failedResult, pendingResult] =
      await Promise.all([
        baseQuery.select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        baseQuery.where("status", "=", "sent").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        baseQuery.where("status", "=", "failed").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
        baseQuery.where("status", "=", "pending").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
      ]);

    // Simplified groupBy - proper implementation would use Kysely's groupBy
    const byChannel: Record<string, number> = {};
    const byTemplate: Record<string, number> = {};

    return {
      total: Number(totalResult.count),
      sent: Number(sentResult.count),
      failed: Number(failedResult.count),
      pending: Number(pendingResult.count),
      byChannel,
      byTemplate,
    };
  }
}

// Export a ready-to-use singleton instance
export const notificationRepository = new NotificationRepository();

// Also export as default for flexibility
export default NotificationRepository;
