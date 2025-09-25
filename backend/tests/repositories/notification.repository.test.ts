import { NotificationRepository } from "../../src/repositories/notification.repository";
import { prisma } from "../../src/config/database";
import {
  Notification,
  CreateNotificationInput,
  NotificationChannel,
  NotificationTemplate,
} from "../../src/types";

// Mock Prisma
jest.mock("../../src/config/database", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("NotificationRepository", () => {
  let notificationRepository: NotificationRepository;
  let mockNotification: Notification;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationRepository = new NotificationRepository();

    mockNotification = {
      id: "notification-1",
      userId: "user-1",
      channel: "email",
      template: "schedule_processed",
      subject: "Test Subject",
      message: "Test Message",
      data: { key: "value" },
      scheduledFor: null,
      sentAt: null,
      status: "pending",
      error: null,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("create", () => {
    it("should create a new notification", async () => {
      // Arrange
      const createData: CreateNotificationInput = {
        user: { connect: { id: "user-1" } },
        channel: "email",
        template: "schedule_processed",
        subject: "Test Subject",
        message: "Test Message",
        data: { key: "value" },
        status: "pending",
        retryCount: 0,
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      // Act
      const result = await notificationRepository.create(createData);

      // Assert
      expect(result).toEqual(mockNotification);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  describe("findById", () => {
    it("should find notification by ID", async () => {
      // Arrange
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);

      // Act
      const result = await notificationRepository.findById("notification-1");

      // Assert
      expect(result).toEqual(mockNotification);
      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: "notification-1" },
      });
    });

    it("should return null if notification not found", async () => {
      // Arrange
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      // Act
      const result = await notificationRepository.findById("non-existent");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find notifications by user ID", async () => {
      // Arrange
      const notifications = [mockNotification];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      // Act
      const result = await notificationRepository.findByUserId("user-1");

      // Assert
      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: undefined,
        skip: undefined,
      });
    });

    it("should apply filters and pagination", async () => {
      // Arrange
      const notifications = [mockNotification];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const options = {
        limit: 10,
        offset: 5,
        status: "sent",
        channel: "email" as NotificationChannel,
      };

      // Act
      const result = await notificationRepository.findByUserId(
        "user-1",
        options
      );

      // Assert
      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          status: "sent",
          channel: "email",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 5,
      });
    });
  });

  describe("findPendingScheduled", () => {
    it("should find pending scheduled notifications", async () => {
      // Arrange
      const scheduledNotifications = [
        {
          ...mockNotification,
          scheduledFor: new Date("2024-01-15T05:00:00"),
        },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(
        scheduledNotifications
      );

      const beforeDate = new Date("2024-01-15T06:00:00");

      // Act
      const result = await notificationRepository.findPendingScheduled(
        beforeDate
      );

      // Assert
      expect(result).toEqual(scheduledNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: "pending",
          scheduledFor: {
            lte: beforeDate,
          },
        },
        orderBy: { scheduledFor: "asc" },
      });
    });

    it("should use current date if no beforeDate provided", async () => {
      // Arrange
      const scheduledNotifications = [mockNotification];
      mockPrisma.notification.findMany.mockResolvedValue(
        scheduledNotifications
      );

      // Act
      const result = await notificationRepository.findPendingScheduled();

      // Assert
      expect(result).toEqual(scheduledNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: "pending",
          scheduledFor: {
            lte: expect.any(Date),
          },
        },
        orderBy: { scheduledFor: "asc" },
      });
    });
  });

  describe("findRetryable", () => {
    it("should find failed notifications that can be retried", async () => {
      // Arrange
      const failedNotifications = [
        {
          ...mockNotification,
          status: "failed",
          retryCount: 2,
        },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(failedNotifications);

      // Act
      const result = await notificationRepository.findRetryable(3);

      // Assert
      expect(result).toEqual(failedNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: "failed",
          retryCount: {
            lt: 3,
          },
        },
        orderBy: { updatedAt: "asc" },
      });
    });
  });

  describe("update", () => {
    it("should update notification", async () => {
      // Arrange
      const updatedNotification = {
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      };
      mockPrisma.notification.update.mockResolvedValue(updatedNotification);

      const updateData = {
        status: "sent",
        sentAt: new Date(),
      };

      // Act
      const result = await notificationRepository.update(
        "notification-1",
        updateData
      );

      // Assert
      expect(result).toEqual(updatedNotification);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notification-1" },
        data: updateData,
      });
    });
  });

  describe("markAsSent", () => {
    it("should mark notification as sent", async () => {
      // Arrange
      const sentNotification = {
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      };
      mockPrisma.notification.update.mockResolvedValue(sentNotification);

      // Act
      const result = await notificationRepository.markAsSent(
        "notification-1",
        "msg-123"
      );

      // Assert
      expect(result).toEqual(sentNotification);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notification-1" },
        data: {
          status: "sent",
          sentAt: expect.any(Date),
          data: { messageId: "msg-123" },
        },
      });
    });

    it("should mark as sent without messageId", async () => {
      // Arrange
      const sentNotification = {
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      };
      mockPrisma.notification.update.mockResolvedValue(sentNotification);

      // Act
      const result = await notificationRepository.markAsSent("notification-1");

      // Assert
      expect(result).toEqual(sentNotification);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notification-1" },
        data: {
          status: "sent",
          sentAt: expect.any(Date),
          data: undefined,
        },
      });
    });
  });

  describe("markAsFailed", () => {
    it("should mark notification as failed and increment retry count", async () => {
      // Arrange
      const failedNotification = {
        ...mockNotification,
        status: "failed",
        error: "Delivery failed",
        retryCount: 1,
      };
      mockPrisma.notification.update.mockResolvedValue(failedNotification);

      // Act
      const result = await notificationRepository.markAsFailed(
        "notification-1",
        "Delivery failed"
      );

      // Assert
      expect(result).toEqual(failedNotification);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notification-1" },
        data: {
          status: "failed",
          error: "Delivery failed",
          retryCount: {
            increment: 1,
          },
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("cancel", () => {
    it("should cancel notification", async () => {
      // Arrange
      const cancelledNotification = {
        ...mockNotification,
        status: "cancelled",
      };
      mockPrisma.notification.update.mockResolvedValue(cancelledNotification);

      // Act
      const result = await notificationRepository.cancel("notification-1");

      // Assert
      expect(result).toEqual(cancelledNotification);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notification-1" },
        data: {
          status: "cancelled",
        },
      });
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete old notifications", async () => {
      // Arrange
      const deleteResult = { count: 5 };
      mockPrisma.notification.deleteMany.mockResolvedValue(deleteResult);

      const cutoffDate = new Date("2024-01-01");

      // Act
      const result = await notificationRepository.deleteOlderThan(cutoffDate);

      // Assert
      expect(result).toBe(5);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          status: {
            in: ["sent", "cancelled"],
          },
        },
      });
    });
  });

  describe("getStatistics", () => {
    it("should return notification statistics", async () => {
      // Arrange
      mockPrisma.notification.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // sent
        .mockResolvedValueOnce(15) // failed
        .mockResolvedValueOnce(5); // pending

      mockPrisma.notification.groupBy
        .mockResolvedValueOnce([
          { channel: "email", _count: { channel: 60 } },
          { channel: "sms", _count: { channel: 25 } },
          { channel: "push", _count: { channel: 15 } },
        ])
        .mockResolvedValueOnce([
          { template: "schedule_processed", _count: { template: 50 } },
          { template: "weather_warning", _count: { template: 30 } },
          { template: "wake_up_reminder", _count: { template: 20 } },
        ]);

      // Act
      const result = await notificationRepository.getStatistics("user-1");

      // Assert
      expect(result).toEqual({
        total: 100,
        sent: 80,
        failed: 15,
        pending: 5,
        byChannel: {
          email: 60,
          sms: 25,
          push: 15,
        },
        byTemplate: {
          schedule_processed: 50,
          weather_warning: 30,
          wake_up_reminder: 20,
        },
      });
    });

    it("should apply date filters", async () => {
      // Arrange
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-01-31");

      mockPrisma.notification.count.mockResolvedValue(50);
      mockPrisma.notification.groupBy.mockResolvedValue([]);

      // Act
      await notificationRepository.getStatistics("user-1", fromDate, toDate);

      // Assert
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });
    });
  });
});
