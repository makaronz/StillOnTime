import { SMSService } from "../../src/services/sms.service";
import { logger } from "../../src/utils/logger";

// Mock Twilio
jest.mock("twilio", () => {
  return {
    Twilio: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
      api: {
        accounts: jest.fn().mockReturnValue({
          fetch: jest.fn(),
          balance: {
            fetch: jest.fn(),
          },
          usage: {
            records: {
              list: jest.fn(),
            },
          },
        }),
      },
    })),
  };
});

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SMSService", () => {
  let smsService: SMSService;
  let mockTwilioClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env.TWILIO_ACCOUNT_SID = "test_account_sid";
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
    process.env.TWILIO_FROM_NUMBER = "+1234567890";

    smsService = new SMSService();

    // Get the mocked Twilio client
    const { Twilio } = require("twilio");
    mockTwilioClient = new Twilio();
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  describe("initialization", () => {
    it("should initialize successfully with valid configuration", () => {
      expect(smsService.isServiceConfigured()).toBe(true);
    });

    it("should not initialize without required environment variables", () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      const newService = new SMSService();
      expect(newService.isServiceConfigured()).toBe(false);
    });

    it("should log warning when configuration is missing", () => {
      delete process.env.TWILIO_AUTH_TOKEN;
      new SMSService();
      expect(logger.warn).toHaveBeenCalledWith(
        "Twilio SMS service not configured - missing environment variables",
        expect.any(Object)
      );
    });
  });

  describe("sendSMS", () => {
    it("should send SMS successfully with valid phone number", async () => {
      const mockMessage = {
        sid: "test_message_sid",
        status: "queued",
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS("+48123456789", "Test message");

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test_message_sid");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Test message",
        from: "+1234567890",
        to: "+48123456789",
        statusCallback: undefined,
        maxPrice: undefined,
        validityPeriod: undefined,
      });
    });

    it("should handle Polish mobile number format", async () => {
      const mockMessage = {
        sid: "test_message_sid",
        status: "queued",
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS("123456789", "Test message");

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+48123456789",
        })
      );
    });

    it("should handle US phone number format", async () => {
      const mockMessage = {
        sid: "test_message_sid",
        status: "queued",
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS("2125551234", "Test message");

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+12125551234",
        })
      );
    });

    it("should return error for invalid phone number", async () => {
      const result = await smsService.sendSMS("invalid", "Test message");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid phone number");
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });

    it("should truncate long messages", async () => {
      const longMessage = "a".repeat(1700);
      const mockMessage = {
        sid: "test_message_sid",
        status: "queued",
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS("+48123456789", longMessage);

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringMatching(/^a+\.\.\.$/),
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "SMS message truncated due to length limit",
        expect.any(Object)
      );
    });

    it("should return error when service is not configured", async () => {
      const unconfiguredService = new SMSService();
      // Clear environment variables to make it unconfigured
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await unconfiguredService.sendSMS("+48123456789", "Test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("SMS service not configured");
    });

    it("should handle Twilio API errors", async () => {
      const error = new Error("Twilio API error");
      error.code = 21211;
      mockTwilioClient.messages.create.mockRejectedValue(error);

      const result = await smsService.sendSMS("+48123456789", "Test message");

      expect(result.success).toBe(false);
      expect(result.error).toContain("SMS delivery failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send SMS",
        expect.objectContaining({
          error: "Twilio API error",
          errorCode: 21211,
        })
      );
    });

    it("should send SMS with options", async () => {
      const mockMessage = {
        sid: "test_message_sid",
        status: "queued",
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const options = {
        statusCallback: "https://example.com/webhook",
        maxPrice: "0.05",
        validityPeriod: 3600,
      };

      const result = await smsService.sendSMS("+48123456789", "Test", options);

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Test",
        from: "+1234567890",
        to: "+48123456789",
        statusCallback: "https://example.com/webhook",
        maxPrice: "0.05",
        validityPeriod: 3600,
      });
    });
  });

  describe("getDeliveryStatus", () => {
    it("should fetch delivery status successfully", async () => {
      const mockMessage = {
        sid: "test_message_sid",
        status: "delivered",
        errorCode: null,
        errorMessage: null,
        dateUpdated: new Date(),
      };

      mockTwilioClient.messages = jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockMessage),
      });

      const status = await smsService.getDeliveryStatus("test_message_sid");

      expect(status.messageId).toBe("test_message_sid");
      expect(status.status).toBe("delivered");
      expect(status.deliveredAt).toEqual(mockMessage.dateUpdated);
    });

    it("should throw error when service is not configured", async () => {
      const unconfiguredService = new SMSService();
      delete process.env.TWILIO_ACCOUNT_SID;

      await expect(
        unconfiguredService.getDeliveryStatus("test_message_sid")
      ).rejects.toThrow("SMS service not configured");
    });

    it("should handle API errors when fetching status", async () => {
      const error = new Error("Message not found");
      mockTwilioClient.messages = jest.fn().mockReturnValue({
        fetch: jest.fn().mockRejectedValue(error),
      });

      await expect(
        smsService.getDeliveryStatus("invalid_message_sid")
      ).rejects.toThrow("Message not found");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch SMS delivery status",
        expect.objectContaining({
          messageId: "invalid_message_sid",
          error: "Message not found",
        })
      );
    });
  });

  describe("testConfiguration", () => {
    it("should return success for valid configuration", async () => {
      const mockAccount = {
        sid: "test_account_sid",
        friendlyName: "Test Account",
        status: "active",
      };

      mockTwilioClient.api.accounts().fetch.mockResolvedValue(mockAccount);

      const result = await smsService.testConfiguration();

      expect(result.isConfigured).toBe(true);
      expect(result.accountInfo).toEqual({
        accountSid: "test_account_sid",
        friendlyName: "Test Account",
        status: "active",
      });
    });

    it("should return error for invalid configuration", async () => {
      const error = new Error("Authentication failed");
      mockTwilioClient.api.accounts().fetch.mockRejectedValue(error);

      const result = await smsService.testConfiguration();

      expect(result.isConfigured).toBe(false);
      expect(result.error).toContain("Configuration test failed");
    });

    it("should return error when service is not configured", async () => {
      const unconfiguredService = new SMSService();
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await unconfiguredService.testConfiguration();

      expect(result.isConfigured).toBe(false);
      expect(result.error).toContain("SMS service not configured");
    });
  });

  describe("getAccountUsage", () => {
    it("should fetch account usage successfully", async () => {
      const mockBalance = {
        balance: "10.50",
        currency: "USD",
      };

      const mockUsage = [
        {
          category: "sms",
          count: "100",
          countUnit: "messages",
          description: "SMS messages sent",
          price: "5.00",
          priceUnit: "USD",
        },
      ];

      mockTwilioClient.api
        .accounts()
        .balance.fetch.mockResolvedValue(mockBalance);
      mockTwilioClient.api
        .accounts()
        .usage.records.list.mockResolvedValue(mockUsage);

      const result = await smsService.getAccountUsage();

      expect(result.balance).toBe("10.50");
      expect(result.currency).toBe("USD");
      expect(result.usage).toHaveLength(1);
      expect(result.usage[0].category).toBe("sms");
    });

    it("should return error when service is not configured", async () => {
      const unconfiguredService = new SMSService();
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await unconfiguredService.getAccountUsage();

      expect(result.error).toBe("SMS service not configured");
    });

    it("should handle API errors", async () => {
      const error = new Error("API error");
      mockTwilioClient.api.accounts().balance.fetch.mockRejectedValue(error);

      const result = await smsService.getAccountUsage();

      expect(result.error).toContain("Failed to fetch usage");
    });
  });

  describe("handleDeliveryStatusWebhook", () => {
    it("should parse webhook data correctly", () => {
      const webhookData = {
        MessageSid: "test_message_sid",
        MessageStatus: "delivered",
        ErrorCode: null,
        ErrorMessage: null,
      };

      const status = smsService.handleDeliveryStatusWebhook(webhookData);

      expect(status.messageId).toBe("test_message_sid");
      expect(status.status).toBe("delivered");
      expect(status.errorCode).toBeNull();
      expect(status.errorMessage).toBeNull();
    });

    it("should handle failed delivery webhook", () => {
      const webhookData = {
        MessageSid: "test_message_sid",
        MessageStatus: "failed",
        ErrorCode: "30008",
        ErrorMessage: "Unknown error",
      };

      const status = smsService.handleDeliveryStatusWebhook(webhookData);

      expect(status.messageId).toBe("test_message_sid");
      expect(status.status).toBe("failed");
      expect(status.errorCode).toBe("30008");
      expect(status.errorMessage).toBe("Unknown error");
    });
  });

  describe("phone number validation", () => {
    const testCases = [
      // Valid cases
      { input: "+48123456789", expected: true, formatted: "+48123456789" },
      { input: "123456789", expected: true, formatted: "+48123456789" },
      { input: "48123456789", expected: true, formatted: "+48123456789" },
      { input: "+12125551234", expected: true, formatted: "+12125551234" },
      { input: "2125551234", expected: true, formatted: "+12125551234" },
      { input: "12125551234", expected: true, formatted: "+12125551234" },

      // Invalid cases
      { input: "", expected: false },
      { input: "123", expected: false },
      { input: "abc123456789", expected: false },
      { input: "012345678", expected: false }, // Polish landline
      { input: "123456789012345678", expected: false }, // Too long
    ];

    testCases.forEach(({ input, expected, formatted }) => {
      it(`should ${
        expected ? "accept" : "reject"
      } phone number: ${input}`, async () => {
        if (expected) {
          const mockMessage = { sid: "test", status: "queued" };
          mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

          const result = await smsService.sendSMS(input, "Test");
          expect(result.success).toBe(true);
          expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
            expect.objectContaining({ to: formatted })
          );
        } else {
          const result = await smsService.sendSMS(input, "Test");
          expect(result.success).toBe(false);
          expect(result.error).toContain("Invalid phone number");
        }
      });
    });
  });
});
