import { prisma } from "@/prisma";
import {
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationChannel,
  NotificationTemplate,
} from "../types";
import { Prisma } from "@prisma/client";
import { AbstractBaseRepository } from "./base.repository";

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
 * Notification Repository Implementation
 */
export class NotificationRepository
  extends AbstractBaseRepository<
    Notification,
    CreateNotificationInput,
    UpdateNotificationInput
  >
  implements INotificationRepository
{
  protected model = prisma.notification;

  // Prisma-specific methods for advanced usage
  createPrisma(args: Prisma.NotificationCreateArgs) {
    return this.model.create(args);
  }

  createManyPrisma(args: Prisma.NotificationCreateManyArgs) {
    return this.model.createMany(args);
  }

  updatePrisma(args: Prisma.NotificationUpdateArgs) {
    return this.model.update(args);
  }

  findUnique(args: Prisma.NotificationFindUniqueArgs) {
    return this.model.findUnique(args);
  }

  findMany(args?: Prisma.NotificationFindManyArgs) {
    return this.model.findMany(args);
  }

  deletePrisma(args: Prisma.NotificationDeleteArgs) {
    return this.model.delete(args);
  }

  deleteManyPrisma(args: Prisma.NotificationDeleteManyArgs) {
    return this.model.deleteMany(args);
  }
  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<Notification | null> {
    return this.model.findUnique({
      where: { id },
    });
  }

  /**
   * Find notification by external message ID (e.g., Twilio message SID)
   */
  async findByMessageId(messageId: string): Promise<Notification | null> {
    return this.model.findFirst({
      where: {
        data: {
          path: ["messageId"],
          equals: messageId,
        },
      },
    });
  }

  /**
   * Find notifications by user ID
   */
  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      channel?: NotificationChannel;
    }
  ): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.channel) {
      where.channel = options.channel;
    }

    return this.model.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Find pending notifications scheduled for delivery
   */
  async findPendingScheduled(beforeDate?: Date): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      status: "pending",
      scheduledFor: {
        lte: beforeDate || new Date(),
      },
    };

    return this.model.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
    });
  }

  /**
   * Find failed notifications that can be retried
   */
  async findRetryable(maxRetries: number = 3): Promise<Notification[]> {
    return this.model.findMany({
      where: {
        status: "failed",
        retryCount: {
          lt: maxRetries,
        },
      },
      orderBy: { updatedAt: "asc" },
    });
  }

  /**
   * Update notification
   */
  async updateById(
    id: string,
    data: UpdateNotificationInput
  ): Promise<Notification> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(id: string, messageId?: string): Promise<Notification> {
    return this.updateById(id, {
      status: "sent",
      sentAt: new Date(),
      data: messageId ? { messageId } : undefined,
    });
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(id: string, error: string): Promise<Notification> {
    return this.model.update({
      where: { id },
      data: {
        status: "failed",
        error,
        retryCount: {
          increment: 1,
        },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Cancel notification
   */
  async cancel(id: string): Promise<Notification> {
    return this.updateById(id, {
      status: "cancelled",
    });
  }

  /**
   * Delete old notifications
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.model.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
        status: {
          in: ["sent", "cancelled"],
        },
      },
    });

    return result.count;
  }

  /**
   * Get notification statistics for a user
   */
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
    const where: Prisma.NotificationWhereInput = { userId };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const [total, sent, failed, pending, byChannel, byTemplate] =
      await Promise.all([
        this.model.count({ where }),
        this.model.count({ where: { ...where, status: "sent" } }),
        this.model.count({
          where: { ...where, status: "failed" },
        }),
        this.model.count({
          where: { ...where, status: "pending" },
        }),
        this.model.groupBy({
          by: ["channel"],
          where,
          _count: { channel: true },
        }),
        this.model.groupBy({
          by: ["template"],
          where,
          _count: { template: true },
        }),
      ]);

    return {
      total,
      sent,
      failed,
      pending,
      byChannel: byChannel.reduce((acc, item) => {
        acc[item.channel] = item._count.channel;
        return acc;
      }, {} as Record<string, number>),
      byTemplate: byTemplate.reduce((acc, item) => {
        acc[item.template] = item._count.template;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Export a ready-to-use singleton instance
export const notificationRepository = new NotificationRepository();

// Also export as default for flexibility
export default NotificationRepository;
