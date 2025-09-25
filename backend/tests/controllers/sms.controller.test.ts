import request from "supertest";
import express from "express";
import { SMSController } from "../../src/controllers/sms.controller";
import { NotificationService } from "../../src/services/notification.service";
import { UserRepository } from "../../src/repositories/user.repository";
import { authenticateToken } from "../../src/middleware/auth.middleware";

// Mock dependencies
jest.mock("../../src/services/notification.service");
jest.mock("../../src/repositories/user.repository");
jest.mock("../../src/middleware/auth.middleware", () => ({
  authenticateToken: jest.fn(),
}));
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SMSController", () => {
  let app: express.Application;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let smsController: SMSController;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockNotificationService = new NotificationService(
      null,
      null
    ) as jest.Mocked<NotificationService>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    smsController = new SMSController(
      mockNotificationService,
      mockUserRepository
    );

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock auth middleware to add user to request
    (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { userId: "test-user-id", email: "test@example.com" };
      next();
    });

    // Setup routes
    app.post(
      "/sms/configure",
      authenticateToken,
      SMSController.validateSMSConfig,
      smsController.configureSMS
    );
    app.post("/sms/verify", authenticateToken, smsController.verifySMS);
    app.post(
      "/sms/resend-code",
      authenticateToken,
      smsController.resendVerificationCode
    );
    app.get("/sms/status", authenticateToken, smsController.getSMSStatus);
    app.post("/sms/test", authenticateToken, smsController.testSMS);
    app.post("/sms/webhook", smsController.handleWebhook);
  });

  describe("POST /sms/configure", () => {
    it("should configure SMS successfully", async () => {
      mockNotificationService.testSMSService.mockResolvedValue({
        isConfigured: true,
        accountInfo: {
          accountSid: "test",
          friendlyName: "Test",
          status: "active",
        },
      });

      mockUserRepository.updateUserConfig.mockResolvedValue({
        id: "config-id",
        userId: "test-user-id",
        smsNumber: "+48123456789",
        notificationSMS: true,
        smsVerified: false,
      } as any);

      mockNotificationService.sendNotification.mockResolvedValue([
        "notification-id",
      ]);

      const response = await request(app).post("/sms/configure").send({
        smsNumber: "+48123456789",
        enabled: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verificationSent).toBe(true);
      expect(mockUserRepository.updateUserConfig).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({
          smsNumber: "+48123456789",
          notificationSMS: true,
          smsVerified: false,
        })
      );
    });

    it("should disable SMS when enabled is false", async () => {
      mockNotificationService.testSMSService.mockResolvedValue({
        isConfigured: true,
      });

      mockUserRepository.updateUserConfig.mockResolvedValue({} as any);

      const response = await request(app).post("/sms/configure").send({
        smsNumber: "+48123456789",
        enabled: false,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("disabled");
      expect(mockUserRepository.updateUserConfig).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({
          smsNumber: null,
          notificationSMS: false,
        })
      );
    });

    it("should return error for invalid phone number", async () => {
      const response = await request(app).post("/sms/configure").send({
        smsNumber: "invalid",
        enabled: true,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Invalid phone number format",
          }),
        ])
      );
    });

    it("should return error when SMS service is not configured", async () => {
      mockNotificationService.testSMSService.mockResolvedValue({
        isConfigured: false,
        error: "Missing credentials",
      });

      const response = await request(app).post("/sms/configure").send({
        smsNumber: "+48123456789",
        enabled: true,
      });

      expect(response.status).toBe(503);
      expect(response.body.code).toBe("SMS_SERVICE_NOT_CONFIGURED");
    });

    it("should handle verification code sending failure gracefully", async () => {
      mockNotificationService.testSMSService.mockResolvedValue({
        isConfigured: true,
      });

      mockUserRepository.updateUserConfig.mockResolvedValue({} as any);
      mockNotificationService.sendNotification.mockRejectedValue(
        new Error("SMS failed")
      );

      const response = await request(app).post("/sms/configure").send({
        smsNumber: "+48123456789",
        enabled: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verificationSent).toBe(false);
    });
  });

  describe("POST /sms/verify", () => {
    it("should verify SMS code successfully", async () => {
      const mockUserConfig = {
        smsVerificationCode: "123456",
        smsVerificationExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      };

      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: mockUserConfig,
      } as any);

      mockUserRepository.updateUserConfig.mockResolvedValue({} as any);

      const response = await request(app)
        .post("/sms/verify")
        .send({ code: "123456" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(mockUserRepository.updateUserConfig).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({
          smsVerified: true,
          smsVerificationCode: null,
          smsVerificationExpiry: null,
        })
      );
    });

    it("should return error for invalid code format", async () => {
      const response = await request(app)
        .post("/sms/verify")
        .send({ code: "123" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_CODE");
    });

    it("should return error for expired code", async () => {
      const mockUserConfig = {
        smsVerificationCode: "123456",
        smsVerificationExpiry: new Date(Date.now() - 1000), // 1 second ago
      };

      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: mockUserConfig,
      } as any);

      const response = await request(app)
        .post("/sms/verify")
        .send({ code: "123456" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("CODE_EXPIRED");
    });

    it("should return error for wrong code", async () => {
      const mockUserConfig = {
        smsVerificationCode: "123456",
        smsVerificationExpiry: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: mockUserConfig,
      } as any);

      const response = await request(app)
        .post("/sms/verify")
        .send({ code: "654321" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_CODE");
    });

    it("should return error when no verification code exists", async () => {
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: {},
      } as any);

      const response = await request(app)
        .post("/sms/verify")
        .send({ code: "123456" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("NO_VERIFICATION_CODE");
    });
  });

  describe("POST /sms/resend-code", () => {
    it("should resend verification code successfully", async () => {
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: { smsNumber: "+48123456789" },
      } as any);

      mockUserRepository.updateUserConfig.mockResolvedValue({} as any);
      mockNotificationService.sendNotification.mockResolvedValue([
        "notification-id",
      ]);

      const response = await request(app).post("/sms/resend-code");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUserRepository.updateUserConfig).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({
          smsVerificationCode: expect.any(String),
          smsVerificationExpiry: expect.any(Date),
        })
      );
    });

    it("should return error when no SMS number is configured", async () => {
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: {},
      } as any);

      const response = await request(app).post("/sms/resend-code");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("NO_SMS_NUMBER");
    });
  });

  describe("GET /sms/status", () => {
    it("should return SMS status successfully", async () => {
      const mockValidation = {
        isValid: true,
        hasPhoneNumber: true,
        isServiceConfigured: true,
      };

      const mockServiceTest = {
        isConfigured: true,
        accountInfo: {
          accountSid: "test",
          friendlyName: "Test",
          status: "active",
        },
      };

      const mockUserConfig = {
        notificationSMS: true,
        smsVerified: true,
        smsNumber: "+48123456789",
      };

      mockNotificationService.validateSMSConfiguration.mockResolvedValue(
        mockValidation
      );
      mockNotificationService.testSMSService.mockResolvedValue(mockServiceTest);
      mockUserRepository.findByIdWithConfig.mockResolvedValue({
        id: "test-user-id",
        userConfig: mockUserConfig,
      } as any);

      const response = await request(app).get("/sms/status");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        configured: true,
        verified: true,
        hasPhoneNumber: true,
        phoneNumber: "*****6789", // Masked phone number
        serviceConfigured: true,
        pendingVerification: false,
        accountInfo: mockServiceTest.accountInfo,
      });
    });
  });

  describe("POST /sms/test", () => {
    it("should send test SMS successfully", async () => {
      mockNotificationService.validateSMSConfiguration.mockResolvedValue({
        isValid: true,
      });

      mockNotificationService.sendNotification.mockResolvedValue([
        "notification-id",
      ]);

      const response = await request(app).post("/sms/test");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationIds).toEqual(["notification-id"]);
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        "test-user-id",
        "system_alert",
        expect.objectContaining({
          message: expect.stringContaining("Test wiadomości SMS"),
        }),
        ["sms"]
      );
    });

    it("should return error when SMS is not configured", async () => {
      mockNotificationService.validateSMSConfiguration.mockResolvedValue({
        isValid: false,
      });

      const response = await request(app).post("/sms/test");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("SMS_NOT_CONFIGURED");
    });
  });

  describe("POST /sms/webhook", () => {
    it("should handle webhook successfully", async () => {
      const mockNotification = {
        id: "notification-id",
        userId: "test-user-id",
      };

      mockNotificationService.notificationRepository = {
        findByMessageId: jest.fn().mockResolvedValue(mockNotification),
      } as any;

      mockNotificationService.updateDeliveryStatus = jest
        .fn()
        .mockResolvedValue(undefined);

      const response = await request(app).post("/sms/webhook").send({
        MessageSid: "test-message-sid",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockNotificationService.updateDeliveryStatus).toHaveBeenCalledWith(
        "notification-id",
        "delivered",
        undefined
      );
    });

    it("should return error for invalid webhook data", async () => {
      const response = await request(app).post("/sms/webhook").send({
        MessageSid: "test-message-sid",
        // Missing MessageStatus
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid webhook data");
    });

    it("should handle webhook when notification is not found", async () => {
      mockNotificationService.notificationRepository = {
        findByMessageId: jest.fn().mockResolvedValue(null),
      } as any;

      const response = await request(app).post("/sms/webhook").send({
        MessageSid: "test-message-sid",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should map different message statuses correctly", async () => {
      const mockNotification = { id: "notification-id" };
      mockNotificationService.notificationRepository = {
        findByMessageId: jest.fn().mockResolvedValue(mockNotification),
      } as any;
      mockNotificationService.updateDeliveryStatus = jest.fn();

      const statusMappings = [
        { input: "delivered", expected: "delivered" },
        { input: "sent", expected: "sent" },
        { input: "queued", expected: "sent" },
        { input: "failed", expected: "failed" },
        { input: "undelivered", expected: "failed" },
      ];

      for (const { input, expected } of statusMappings) {
        await request(app).post("/sms/webhook").send({
          MessageSid: "test-message-sid",
          MessageStatus: input,
        });

        expect(
          mockNotificationService.updateDeliveryStatus
        ).toHaveBeenCalledWith("notification-id", expected, undefined);
      }
    });
  });
});
