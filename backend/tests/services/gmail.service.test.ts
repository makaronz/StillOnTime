import { GmailService, GmailMessage } from "@/services/gmail.service";
import { OAuth2Service } from "@/services/oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { google } from "googleapis";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("googleapis");
jest.mock("@/utils/logger");

const mockGoogleAuth = {
  setCredentials: jest.fn(),
};

const mockGmail = {
  users: {
    messages: {
      list: jest.fn(),
      get: jest.fn(),
      attachments: {
        get: jest.fn(),
      },
    },
  },
};

const mockOAuth2Service = {
  getGoogleClient: jest.fn(),
} as unknown as jest.Mocked<OAuth2Service>;

const mockProcessedEmailRepository = {
  findByMessageId: jest.fn(),
  create: jest.fn(),
  generatePdfHash: jest.fn(),
  isDuplicate: jest.fn(),
  getProcessingStats: jest.fn(),
} as unknown as jest.Mocked<ProcessedEmailRepository>;

describe("GmailService", () => {
  let gmailService: GmailService;
  const userId = "test-user-id";
  const messageId = "test-message-id";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Google APIs
    (google.gmail as jest.Mock).mockReturnValue(mockGmail);
    mockOAuth2Service.getGoogleClient.mockResolvedValue(mockGoogleAuth as any);

    gmailService = new GmailService(
      mockOAuth2Service as any,
      mockProcessedEmailRepository as any
    );
  });

  describe("monitorEmails", () => {
    it("should successfully monitor emails for a user", async () => {
      const mockEmails: GmailMessage[] = [
        {
          id: "msg1",
          threadId: "thread1",
          labelIds: ["INBOX"],
          snippet: "Plan zdjęciowy na jutro",
          payload: {
            headers: [
              { name: "Subject", value: "Plan zdjęciowy - Lokacja A" },
              { name: "From", value: "producer@stillontime.pl" },
            ],
            parts: [
              {
                mimeType: "application/pdf",
                filename: "schedule.pdf",
                body: { attachmentId: "att1", size: 1024 },
              },
            ],
          },
          internalDate: "1640995200000",
          historyId: "hist1",
          sizeEstimate: 2048,
        },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: [{ id: "msg1" }] },
      });

      mockGmail.users.messages.get.mockResolvedValue({
        data: mockEmails[0],
      });

      mockProcessedEmailRepository.findByMessageId.mockResolvedValue(null);
      mockProcessedEmailRepository.isDuplicate.mockResolvedValue(false);
      mockProcessedEmailRepository.create.mockResolvedValue({} as any);
      mockProcessedEmailRepository.generatePdfHash.mockReturnValue("hash123");

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: Buffer.from("pdf content").toString("base64url") },
      });

      await gmailService.monitorEmails(userId);

      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(mockGmail.users.messages.list).toHaveBeenCalled();
      expect(mockProcessedEmailRepository.create).toHaveBeenCalled();
    });

    it("should handle errors during email monitoring", async () => {
      mockOAuth2Service.getGoogleClient.mockRejectedValue(
        new Error("OAuth error")
      );

      await expect(gmailService.monitorEmails(userId)).rejects.toThrow(
        "Email monitoring failed"
      );
    });
  });

  describe("getScheduleEmails", () => {
    it("should return filtered schedule emails", async () => {
      const mockMessages = [{ id: "msg1" }, { id: "msg2" }];

      const mockFullMessages: GmailMessage[] = [
        {
          id: "msg1",
          threadId: "thread1",
          labelIds: ["INBOX"],
          snippet: "Plan zdjęciowy",
          payload: {
            headers: [
              { name: "Subject", value: "Plan zdjęciowy - Test" },
              { name: "From", value: "test@stillontime.pl" },
            ],
            parts: [
              {
                mimeType: "application/pdf",
                filename: "schedule.pdf",
                body: { attachmentId: "att1" },
              },
            ],
          },
          internalDate: "1640995200000",
          historyId: "hist1",
          sizeEstimate: 1024,
        },
        {
          id: "msg2",
          threadId: "thread2",
          labelIds: ["INBOX"],
          snippet: "Regular email",
          payload: {
            headers: [
              { name: "Subject", value: "Regular email" },
              { name: "From", value: "test@example.com" },
            ],
          },
          internalDate: "1640995200000",
          historyId: "hist2",
          sizeEstimate: 512,
        },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({ data: mockFullMessages[0] })
        .mockResolvedValueOnce({ data: mockFullMessages[1] });

      const result = await gmailService.getScheduleEmails(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("msg1");
    });

    it("should return empty array when no messages found", async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: null },
      });

      const result = await gmailService.getScheduleEmails(userId);

      expect(result).toEqual([]);
    });
  });

  describe("validateScheduleEmail", () => {
    const createMockEmail = (
      subject: string,
      from: string,
      hasPdf: boolean = true
    ): GmailMessage => ({
      id: "test-id",
      threadId: "test-thread",
      labelIds: ["INBOX"],
      snippet: "test snippet",
      payload: {
        headers: [
          { name: "Subject", value: subject },
          { name: "From", value: from },
        ],
        parts: hasPdf
          ? [
              {
                mimeType: "application/pdf",
                filename: "schedule.pdf",
                body: { attachmentId: "att1" },
              },
            ]
          : [],
      },
      internalDate: "1640995200000",
      historyId: "hist1",
      sizeEstimate: 1024,
    });

    it("should validate email with schedule keywords and PDF", async () => {
      const email = createMockEmail(
        "Plan zdjęciowy na jutro",
        "producer@stillontime.pl"
      );

      const result = gmailService.validateScheduleEmail(email);

      expect(result).toBe(true);
    });

    it("should reject email without schedule keywords", async () => {
      const email = createMockEmail(
        "Regular meeting",
        "producer@stillontime.pl"
      );

      const result = gmailService.validateScheduleEmail(email);

      expect(result).toBe(false);
    });

    it("should reject email without PDF attachment", async () => {
      const email = createMockEmail(
        "Plan zdjęciowy na jutro",
        "producer@stillontime.pl",
        false
      );

      const result = gmailService.validateScheduleEmail(email);

      expect(result).toBe(false);
    });

    it("should validate email with different schedule keywords", async () => {
      const keywords = [
        "drabinka filmowa",
        "call time 8:00",
        "shooting schedule",
        "harmonogram zdjęć",
      ];

      for (const keyword of keywords) {
        const email = createMockEmail(keyword, "test@example.com");
        const result = gmailService.validateScheduleEmail(email);
        expect(result).toBe(true);
      }
    });
  });

  describe("downloadAttachment", () => {
    it("should successfully download attachment", async () => {
      const attachmentId = "test-attachment-id";
      const mockData = Buffer.from("PDF content").toString("base64url");

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: mockData },
      });

      const result = await gmailService.downloadAttachment(
        userId,
        messageId,
        attachmentId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe("PDF content");
      expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledWith({
        userId: "me",
        messageId,
        id: attachmentId,
      });
    });

    it("should handle download errors", async () => {
      const attachmentId = "test-attachment-id";

      mockGmail.users.messages.attachments.get.mockRejectedValue(
        new Error("Download failed")
      );

      await expect(
        gmailService.downloadAttachment(userId, messageId, attachmentId)
      ).rejects.toThrow("Failed to download attachment");
    });

    it("should handle missing attachment data", async () => {
      const attachmentId = "test-attachment-id";

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: null },
      });

      await expect(
        gmailService.downloadAttachment(userId, messageId, attachmentId)
      ).rejects.toThrow("No attachment data received");
    });
  });

  describe("isEmailProcessed", () => {
    it("should return true for processed email", async () => {
      mockProcessedEmailRepository.findByMessageId.mockResolvedValue({
        id: "processed-email-id",
      } as any);

      const result = await gmailService.isEmailProcessed(messageId);

      expect(result).toBe(true);
      expect(mockProcessedEmailRepository.findByMessageId).toHaveBeenCalledWith(
        messageId
      );
    });

    it("should return false for unprocessed email", async () => {
      mockProcessedEmailRepository.findByMessageId.mockResolvedValue(null);

      const result = await gmailService.isEmailProcessed(messageId);

      expect(result).toBe(false);
    });

    it("should return false on database error", async () => {
      mockProcessedEmailRepository.findByMessageId.mockRejectedValue(
        new Error("Database error")
      );

      const result = await gmailService.isEmailProcessed(messageId);

      expect(result).toBe(false);
    });
  });

  describe("getEmailStats", () => {
    it("should return email processing statistics", async () => {
      const mockStats = {
        total: 10,
        processed: 8,
        pending: 1,
        failed: 1,
      };

      mockProcessedEmailRepository.getProcessingStats.mockResolvedValue(
        mockStats
      );

      const result = await gmailService.getEmailStats(userId);

      expect(result).toEqual({
        totalEmails: 10,
        processedEmails: 8,
        pendingEmails: 1,
        failedEmails: 1,
        lastCheck: expect.any(Date),
      });
    });

    it("should handle stats retrieval errors", async () => {
      mockProcessedEmailRepository.getProcessingStats.mockRejectedValue(
        new Error("Stats error")
      );

      await expect(gmailService.getEmailStats(userId)).rejects.toThrow(
        "Failed to get email statistics"
      );
    });
  });

  describe("processSpecificEmail", () => {
    it("should process a specific email by message ID", async () => {
      const mockEmail: GmailMessage = {
        id: messageId,
        threadId: "thread1",
        labelIds: ["INBOX"],
        snippet: "Plan zdjęciowy",
        payload: {
          headers: [
            { name: "Subject", value: "Plan zdjęciowy - Test" },
            { name: "From", value: "test@stillontime.pl" },
          ],
          parts: [
            {
              mimeType: "application/pdf",
              filename: "schedule.pdf",
              body: { attachmentId: "att1" },
            },
          ],
        },
        internalDate: "1640995200000",
        historyId: "hist1",
        sizeEstimate: 1024,
      };

      mockGmail.users.messages.get.mockResolvedValue({
        data: mockEmail,
      });

      mockProcessedEmailRepository.findByMessageId.mockResolvedValue(null);
      mockProcessedEmailRepository.isDuplicate.mockResolvedValue(false);
      mockProcessedEmailRepository.create.mockResolvedValue({} as any);
      mockProcessedEmailRepository.generatePdfHash.mockReturnValue("hash123");

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: Buffer.from("pdf content").toString("base64url") },
      });

      await gmailService.processSpecificEmail(userId, messageId);

      expect(mockGmail.users.messages.get).toHaveBeenCalledWith({
        userId: "me",
        id: messageId,
        format: "full",
      });
      expect(mockProcessedEmailRepository.create).toHaveBeenCalled();
    });

    it("should reject invalid email", async () => {
      const mockEmail: GmailMessage = {
        id: messageId,
        threadId: "thread1",
        labelIds: ["INBOX"],
        snippet: "Regular email",
        payload: {
          headers: [
            { name: "Subject", value: "Regular email" },
            { name: "From", value: "test@example.com" },
          ],
        },
        internalDate: "1640995200000",
        historyId: "hist1",
        sizeEstimate: 512,
      };

      mockGmail.users.messages.get.mockResolvedValue({
        data: mockEmail,
      });

      await expect(
        gmailService.processSpecificEmail(userId, messageId)
      ).rejects.toThrow("Email does not match schedule criteria");
    });

    it("should handle missing email", async () => {
      mockGmail.users.messages.get.mockResolvedValue({
        data: null,
      });

      await expect(
        gmailService.processSpecificEmail(userId, messageId)
      ).rejects.toThrow("Email not found");
    });
  });
});
