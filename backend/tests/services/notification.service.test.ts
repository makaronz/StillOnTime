import { NotificationService } from "../../src/services/notification.service";
import { NotificationRepository } from "../../src/repositories/notification.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import {
  User,
  UserConfig,
  NotificationTemplate,
  NotificationTemplateData,
  ScheduleDataWithRelations,
  RoutePlan,
  WeatherData,
} from "../../src/types";

// Mock dependencies
jest.mock("../../src/repositories/notification.repository");
jest.mock("../../src/repositories/user.repository");
jest.mock("../../src/utils/logger");
jest.mock("nodemailer");

const mockNotificationRepository =
  new NotificationRepository() as jest.Mocked<NotificationRepository>;
const mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;

describe("NotificationService", () => {
  let notificationService: NotificationService;
  let mockUser: User;
  let mockUserConfig: UserConfig;
  let mockScheduleData: ScheduleDataWithRelations;
  let mockRoutePlan: RoutePlan;
  let mockWeatherData: WeatherData;

  beforeEach(() => {
    jest.clearAllMocks();

    notificationService = new NotificationService(
      mockNotificationRepository,
      mockUserRepository
    );

    // Mock data
    mockUser = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      googleId: "google-123",
      accessToken: "token",
      refreshToken: "refresh",
      tokenExpiry: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserConfig = {
      id: "config-1",
      homeAddress: "Home Address",
      panavisionAddress: "Panavision Address",
      bufferCarChange: 15,
      bufferParking: 10,
      bufferEntry: 10,
      bufferTraffic: 20,
      bufferMorningRoutine: 45,
      notificationEmail: true,
      notificationSMS: false,
      notificationPush: true,
      smsNumber: "+48123456789" as any,
      pushToken: "push-token-123" as any,
      userId: "user-1",
    };

    mockScheduleData = {
      id: "schedule-1",
      shootingDate: new Date("2024-01-15"),
      callTime: "08:00",
      location: "Test Location",
      baseLocation: "Base Location",
      sceneType: "EXT",
      scenes: ["1", "2"],
      safetyNotes: "Safety notes",
      equipment: ["Camera", "Lights"],
      contacts: [{ name: "Director", phone: "123456789" }],
      notes: "Test notes",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      emailId: "email-1",
      user: mockUser,
      email: {} as any,
      routePlan: null,
      weatherData: null,
      calendarEvent: null,
    };

    mockRoutePlan = {
      id: "route-1",
      wakeUpTime: new Date("2024-01-15T05:00:00"),
      departureTime: new Date("2024-01-15T06:30:00"),
      arrivalTime: new Date("2024-01-15T07:45:00"),
      totalTravelMinutes: 75,
      routeSegments: [],
      buffers: {
        carChange: 15,
        parking: 10,
        entry: 10,
        traffic: 20,
        morningRoutine: 45,
      },
      calculatedAt: new Date(),
      userId: "user-1",
      scheduleId: "schedule-1",
    };

    mockWeatherData = {
      id: "weather-1",
      forecastDate: new Date("2024-01-15"),
      temperature: 15,
      description: "Partly cloudy",
      windSpeed: 5,
      precipitation: 0,
      humidity: 60,
      warnings: ["Strong wind warning"],
      fetchedAt: new Date(),
      userId: "user-1",
      scheduleId: "schedule-1",
    };
  });

  describe("sendNotification", () => {
    it("should send notification to all enabled channels", async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: mockUserConfig,
      });

      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        channel: "email",
        template: "schedule_processed",
        subject: "Test Subject",
        message: "Test Message",
        data: {},
        scheduledFor: null,
        sentAt: null,
        status: "pending",
        error: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      });

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
        routePlan: mockRoutePlan,
        weatherData: mockWeatherData,
      };

      // Act
      const result = await notificationService.sendNotification(
        "user-1",
        "schedule_processed",
        templateData
      );

      // Assert
      expect(result).toHaveLength(2); // email and push (SMS disabled)
      expect(mockNotificationRepository.create).toHaveBeenCalledTimes(2);
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockUserRepository.findByIdWithConfig).toHaveBeenCalledWith(
        "user-1"
      );
    });

    it("should schedule notification for future delivery", async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: mockUserConfig,
      });

      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        channel: "email",
        template: "wake_up_reminder",
        subject: "Wake Up!",
        message: "Time to wake up",
        data: {},
        scheduledFor: new Date("2024-01-15T05:00:00"),
        sentAt: null,
        status: "pending",
        error: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      const scheduledFor = new Date("2024-01-15T05:00:00");
      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
        routePlan: mockRoutePlan,
      };

      // Act
      const result = await notificationService.sendNotification(
        "user-1",
        "wake_up_reminder",
        templateData,
        ["email"],
        scheduledFor
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledFor,
        })
      );
      // Should not be sent immediately
      expect(mockNotificationRepository.markAsSent).not.toHaveBeenCalled();
    });

    it("should handle user not found error", async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
      };

      // Act & Assert
      await expect(
        notificationService.sendNotification(
          "non-existent-user",
          "schedule_processed",
          templateData
        )
      ).rejects.toThrow("User not found: non-existent-user");
    });

    it("should handle invalid template error", async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: mockUserConfig,
      });

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
      };

      // Act & Assert
      await expect(
        notificationService.sendNotification(
          "user-1",
          "invalid_template" as NotificationTemplate,
          templateData
        )
      ).rejects.toThrow("Template not found: invalid_template");
    });
  });

  describe("processScheduledNotifications", () => {
    it("should process pending scheduled notifications", async () => {
      // Arrange
      const scheduledNotifications = [
        {
          id: "notification-1",
          userId: "user-1",
          channel: "email",
          template: "wake_up_reminder",
          subject: "Wake Up!",
          message: "Time to wake up",
          data: {},
          scheduledFor: new Date("2024-01-15T05:00:00"),
          sentAt: null,
          status: "pending",
          error: null,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockNotificationRepository.findPendingScheduled.mockResolvedValue(
        scheduledNotifications
      );
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: mockUserConfig,
      });
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...scheduledNotifications[0],
        status: "sent",
        sentAt: new Date(),
      });

      // Act
      await notificationService.processScheduledNotifications();

      // Assert
      expect(
        mockNotificationRepository.findPendingScheduled
      ).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockNotificationRepository.markAsSent).toHaveBeenCalledWith(
        "notification-1",
        expect.any(String)
      );
    });

    it("should handle user not found during scheduled processing", async () => {
      // Arrange
      const scheduledNotifications = [
        {
          id: "notification-1",
          userId: "non-existent-user",
          channel: "email",
          template: "wake_up_reminder",
          subject: "Wake Up!",
          message: "Time to wake up",
          data: {},
          scheduledFor: new Date("2024-01-15T05:00:00"),
          sentAt: null,
          status: "pending",
          error: null,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockNotificationRepository.findPendingScheduled.mockResolvedValue(
        scheduledNotifications
      );
      mockUserRepository.findById.mockResolvedValue(null);
      mockNotificationRepository.markAsFailed.mockResolvedValue({
        ...scheduledNotifications[0],
        status: "failed",
        error: "User not found",
      });

      // Act
      await notificationService.processScheduledNotifications();

      // Assert
      expect(mockNotificationRepository.markAsFailed).toHaveBeenCalledWith(
        "notification-1",
        "User not found"
      );
    });
  });

  describe("retryFailedNotifications", () => {
    it("should retry failed notifications", async () => {
      // Arrange
      const failedNotifications = [
        {
          id: "notification-1",
          userId: "user-1",
          channel: "email",
          template: "schedule_processed",
          subject: "Test Subject",
          message: "Test Message",
          data: {},
          scheduledFor: null,
          sentAt: null,
          status: "failed",
          error: "Previous error",
          retryCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockNotificationRepository.findRetryable.mockResolvedValue(
        failedNotifications
      );
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: mockUserConfig,
      });
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...failedNotifications[0],
        status: "sent",
        sentAt: new Date(),
      });

      // Act
      await notificationService.retryFailedNotifications();

      // Assert
      expect(mockNotificationRepository.findRetryable).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockNotificationRepository.markAsSent).toHaveBeenCalledWith(
        "notification-1",
        expect.any(String)
      );
    });
  });

  describe("template rendering", () => {
    it("should render schedule processed template correctly", async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: {
          ...mockUserConfig,
          notificationSMS: false,
          notificationPush: false,
        },
      });

      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        channel: "email",
        template: "schedule_processed",
        subject: "✅ Plan zdjęciowy przetworzony - Test Location",
        message: expect.stringContaining("Test Location"),
        data: {},
        scheduledFor: null,
        sentAt: null,
        status: "pending",
        error: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      });

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
        routePlan: mockRoutePlan,
        weatherData: mockWeatherData,
      };

      // Act
      await notificationService.sendNotification(
        "user-1",
        "schedule_processed",
        templateData,
        ["email"]
      );

      // Assert
      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "✅ Plan zdjęciowy przetworzony - Test Location",
          message: expect.stringContaining("Test Location"),
        })
      );
    });
  });

  describe("notification preferences", () => {
    it("should respect user notification preferences", async () => {
      // Arrange
      const userConfigWithOnlyEmail = {
        ...mockUserConfig,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: userConfigWithOnlyEmail,
      });

      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        channel: "email",
        template: "schedule_processed",
        subject: "Test Subject",
        message: "Test Message",
        data: {},
        scheduledFor: null,
        sentAt: null,
        status: "pending",
        error: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      });

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
      };

      // Act
      const result = await notificationService.sendNotification(
        "user-1",
        "schedule_processed",
        templateData
      );

      // Assert
      expect(result).toHaveLength(1); // Only email should be sent
      expect(mockNotificationRepository.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "email",
        })
      );
    });

    it("should not send SMS if phone number is not configured", async () => {
      // Arrange
      const userConfigWithoutPhone = {
        ...mockUserConfig,
        notificationSMS: true,
        smsNumber: null, // No phone number
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        ...mockUser,
        userConfig: userConfigWithoutPhone,
      });

      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        channel: "email",
        template: "schedule_processed",
        subject: "Test Subject",
        message: "Test Message",
        data: {},
        scheduledFor: null,
        sentAt: null,
        status: "pending",
        error: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.markAsSent.mockResolvedValue({
        ...mockNotification,
        status: "sent",
        sentAt: new Date(),
      });

      const templateData: NotificationTemplateData = {
        scheduleData: mockScheduleData,
      };

      // Act
      const result = await notificationService.sendNotification(
        "user-1",
        "schedule_processed",
        templateData
      );

      // Assert
      expect(result).toHaveLength(2); // email and push, but not SMS
      expect(mockNotificationRepository.create).toHaveBeenCalledTimes(2);

      const createCalls = mockNotificationRepository.create.mock.calls;
      const channels = createCalls.map((call) => call[0].channel);
      expect(channels).toContain("email");
      expect(channels).toContain("push");
      expect(channels).not.toContain("sms");
    });
  });
});
