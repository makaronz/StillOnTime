import request from "supertest";
import { app } from "../../src/index";
import { prisma } from "../../src/config/database";
import { createTestUser, cleanupTestData } from "../setup";

// Mock Twilio to avoid actual SMS sending during tests
jest.mock("twilio", () => {
  return {
    Twilio: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          sid: "test_message_sid",
          status: "queued",
        }),
      },
      api: {
        accounts: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue({
            sid: "test_account_sid",
            friendlyName: "Test Account",
            status: "active",
          }),
          balance: {
            fetch: jest.fn().mockResolvedValue({
              balance: "10.50",
              currency: "USD",
            }),
          },
          usage: {
            records: {
              list: jest.fn().mockResolvedValue([
                {
                  category: "sms",
                  count: "100",
                  countUnit: "messages",
                  description: "SMS messages sent",
                  price: "5.00",
                  priceUnit: "USD",
                },
              ]),
            },
          },
        }),
      },
    })),
  };
});

describe("SMS Endpoints Integration", () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Set up test environment variables
    process.env.TWILIO_ACCOUNT_SID = "test_account_sid";
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
    process.env.TWILIO_FROM_NUMBER = "+1234567890";
    process.env.JWT_SECRET = "test_jwt_secret";
  });

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser();

    // Get auth token
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: testUser.email,
      password: "testpassword123",
    });

    authToken = loginResponse.body.token;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.JWT_SECRET;
  });

  describe("POST /api/sms/configure", () => {
    it("should configure SMS settings successfully", async () => {
      const response = await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verificationSent).toBe(true);

      // Verify database was updated
      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      expect(userConfig).toBeTruthy();
      expect(userConfig.smsNumber).toBe("+48123456789");
      expect(userConfig.notificationSMS).toBe(true);
      expect(userConfig.smsVerified).toBe(false);
      expect(userConfig.smsVerificationCode).toBeTruthy();
      expect(userConfig.smsVerificationExpiry).toBeTruthy();
    });

    it("should disable SMS when enabled is false", async () => {
      // First enable SMS
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      // Then disable it
      const response = await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("disabled");

      // Verify database was updated
      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      expect(userConfig.smsNumber).toBeNull();
      expect(userConfig.notificationSMS).toBe(false);
    });

    it("should return validation error for invalid phone number", async () => {
      const response = await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "invalid-number",
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

    it("should require authentication", async () => {
      const response = await request(app).post("/api/sms/configure").send({
        smsNumber: "+48123456789",
        enabled: true,
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/sms/verify", () => {
    beforeEach(async () => {
      // Configure SMS first
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });
    });

    it("should verify SMS code successfully", async () => {
      // Get the verification code from database
      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      const response = await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: userConfig.smsVerificationCode,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);

      // Verify database was updated
      const updatedConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      expect(updatedConfig.smsVerified).toBe(true);
      expect(updatedConfig.smsVerificationCode).toBeNull();
      expect(updatedConfig.smsVerificationExpiry).toBeNull();
    });

    it("should return error for wrong verification code", async () => {
      const response = await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: "000000",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_CODE");
    });

    it("should return error for expired verification code", async () => {
      // Manually expire the verification code
      await prisma.userConfig.update({
        where: { userId: testUser.id },
        data: {
          smsVerificationExpiry: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      const response = await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: "123456",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("CODE_EXPIRED");
    });
  });

  describe("POST /api/sms/resend-code", () => {
    beforeEach(async () => {
      // Configure SMS first
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });
    });

    it("should resend verification code successfully", async () => {
      const response = await request(app)
        .post("/api/sms/resend-code")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new verification code was generated
      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      expect(userConfig.smsVerificationCode).toBeTruthy();
      expect(userConfig.smsVerificationExpiry).toBeTruthy();
      expect(userConfig.smsVerificationExpiry.getTime()).toBeGreaterThan(
        Date.now()
      );
    });

    it("should return error when no SMS number is configured", async () => {
      // Remove SMS number
      await prisma.userConfig.update({
        where: { userId: testUser.id },
        data: { smsNumber: null },
      });

      const response = await request(app)
        .post("/api/sms/resend-code")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("NO_SMS_NUMBER");
    });
  });

  describe("GET /api/sms/status", () => {
    it("should return SMS status for unconfigured user", async () => {
      const response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: false,
        configured: false,
        verified: false,
        hasPhoneNumber: false,
        phoneNumber: null,
        serviceConfigured: true,
        pendingVerification: false,
        accountInfo: expect.any(Object),
      });
    });

    it("should return SMS status for configured but unverified user", async () => {
      // Configure SMS
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      const response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        configured: false, // Not configured until verified
        verified: false,
        hasPhoneNumber: true,
        phoneNumber: "*****6789", // Masked
        serviceConfigured: true,
        pendingVerification: true,
        accountInfo: expect.any(Object),
      });
    });

    it("should return SMS status for fully configured user", async () => {
      // Configure and verify SMS
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: userConfig.smsVerificationCode,
        });

      const response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        configured: true,
        verified: true,
        hasPhoneNumber: true,
        phoneNumber: "*****6789",
        serviceConfigured: true,
        pendingVerification: false,
        accountInfo: expect.any(Object),
      });
    });
  });

  describe("POST /api/sms/test", () => {
    it("should send test SMS for verified user", async () => {
      // Configure and verify SMS
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: userConfig.smsVerificationCode,
        });

      const response = await request(app)
        .post("/api/sms/test")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationIds).toHaveLength(1);

      // Verify notification was created in database
      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser.id,
          channel: "sms",
          template: "system_alert",
        },
      });

      expect(notification).toBeTruthy();
      expect(notification.message).toContain("Test wiadomości SMS");
    });

    it("should return error for unverified user", async () => {
      // Configure but don't verify SMS
      await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      const response = await request(app)
        .post("/api/sms/test")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("SMS_NOT_CONFIGURED");
    });
  });

  describe("POST /api/sms/webhook", () => {
    it("should handle delivery status webhook", async () => {
      // Create a test notification
      const notification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          channel: "sms",
          template: "system_alert",
          subject: "Test",
          message: "Test message",
          status: "sent",
          data: { messageId: "test_message_sid" },
        },
      });

      const response = await request(app).post("/api/sms/webhook").send({
        MessageSid: "test_message_sid",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify notification status was updated
      const updatedNotification = await prisma.notification.findUnique({
        where: { id: notification.id },
      });

      expect(updatedNotification.status).toBe("sent"); // Status updated via service
    });

    it("should handle webhook for unknown message", async () => {
      const response = await request(app).post("/api/sms/webhook").send({
        MessageSid: "unknown_message_sid",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return error for invalid webhook data", async () => {
      const response = await request(app).post("/api/sms/webhook").send({
        MessageSid: "test_message_sid",
        // Missing MessageStatus
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid webhook data");
    });
  });

  describe("End-to-end SMS workflow", () => {
    it("should complete full SMS configuration and verification workflow", async () => {
      // Step 1: Check initial status
      let response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.body.enabled).toBe(false);
      expect(response.body.configured).toBe(false);

      // Step 2: Configure SMS
      response = await request(app)
        .post("/api/sms/configure")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          smsNumber: "+48123456789",
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.verificationSent).toBe(true);

      // Step 3: Check status after configuration
      response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.body.enabled).toBe(true);
      expect(response.body.configured).toBe(false); // Not yet verified
      expect(response.body.pendingVerification).toBe(true);

      // Step 4: Verify SMS
      const userConfig = await prisma.userConfig.findUnique({
        where: { userId: testUser.id },
      });

      response = await request(app)
        .post("/api/sms/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: userConfig.smsVerificationCode,
        });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);

      // Step 5: Check final status
      response = await request(app)
        .get("/api/sms/status")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.body.enabled).toBe(true);
      expect(response.body.configured).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.pendingVerification).toBe(false);

      // Step 6: Send test SMS
      response = await request(app)
        .post("/api/sms/test")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Step 7: Verify notification was created
      const notifications = await prisma.notification.findMany({
        where: {
          userId: testUser.id,
          channel: "sms",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(notifications).toHaveLength(2); // Verification SMS + Test SMS
      expect(notifications[0].template).toBe("system_alert");
      expect(notifications[0].message).toContain("Test wiadomości SMS");
    });
  });
});
