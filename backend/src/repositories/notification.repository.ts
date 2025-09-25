import { BaseRepository } from "./base.repository";
import {
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationChannel,
  NotificationTemplate,
} from "../types";
import { Prisma } from "@prisma/client";

export class NotificationRepository extends BaseRepository {
  /**
   * Create a new notification
   */
  async create(data: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data,
    });
  }

  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where: { id },
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

    return this.prisma.notification.findMany({
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

    return this.prisma.notification.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
    });
  }

  /**
   * Find failed notifications that can be retried
   */
  async findRetryable(maxRetries: number = 3): Promise<Notification[]> {
    return this.prisma.notification.findMany({
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
  async update(
    id: string,
    data: UpdateNotificationInput
  ): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(id: string, messageId?: string): Promise<Notification> {
    return this.update(id, {
      status: "sent",
      sentAt: new Date(),
      data: messageId ? { messageId } : undefined,
    });
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(id: string, error: string): Promise<Notification> {
    return this.prisma.notification.update({
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
    return this.update(id, {
      status: "cancelled",
    });
  }

  /**
   * Delete old notifications
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
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
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({ where: { ...where, status: "sent" } }),
        this.prisma.notification.count({
          where: { ...where, status: "failed" },
        }),
        this.prisma.notification.count({
          where: { ...where, status: "pending" },
        }),
        this.prisma.notification.groupBy({
          by: ["channel"],
          where,
          _count: { channel: true },
        }),
        this.prisma.notification.groupBy({
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
