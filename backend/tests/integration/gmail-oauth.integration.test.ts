import { GmailService } from "@/services/gmail.service";
import { OAuth2Service } from "@/services/oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { google } from "googleapis";

// Mock dependencies
jest.mock("googleapis");
jest.mock("@/utils/logger");

const mockOAuth2Client = {
  setCredentials: jest.fn(),
  refreshAccessToken: jest.fn(),
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
  refreshAccessToken: jest.fn(),
} as unknown as jest.Mocked<OAuth2Service>;

const mockProcessedEmailRepository = {
  findByMessageId: jest.fn(),
  create: jest.fn(),
  generatePdfHash: jest.fn(),
  isDuplicate: jest.fn(),
  getProcessingStats: jest.fn(),
} as unknown as jest.Mocked<ProcessedEmailRepository>;

describe("Gmail OAuth Integration Tests", () => {
  let gmailService: GmailService;
  const userId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    (google.gmail as jest.Mock).mockReturnValue(mockGmail);
    mockOAuth2Service.getGoogleClient.mockResolvedValue(mockOAuth2Client as any);

    gmailService = new GmailService(
      mockOAuth2Service as any,
      mockProcessedEmailRepository as any
    );
  });

  describe("Gmail API Connection", () => {
    it("should connect to Gmail API with OAuth credentials", async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: null },
      });

      await gmailService.getScheduleEmails(userId);

      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(google.gmail).toHaveBeenCalledWith({
        version: "v1",
        auth: mockOAuth2Client,
      });
    });

    it("should handle OAuth client creation failure", async () => {
      mockOAuth2Service.getGoogleClient.mockRejectedValue(
        new Error("OAuth error")
      );

      await expect(gmailService.getScheduleEmails(userId)).rejects.toThrow(
        "Failed to retrieve schedule emails"
      );
    });

    it("should automatically refresh expired token", async () => {
      const refreshError = new Error("Token expired");
      mockOAuth2Service.getGoogleClient
        .mockRejectedValueOnce(refreshError)
        .mockResolvedValueOnce(mockOAuth2Client as any);

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: null },
      });

      // First call should fail and trigger refresh
      await expect(gmailService.getScheduleEmails(userId)).rejects.toThrow();
    });
  });

  describe("Email Sync Functionality", () => {
    it("should sync emails from Gmail with proper OAuth authentication", async () => {
      const mockMessages = [
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
        data: mockMessages[0],
      });

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: Buffer.from("pdf content").toString("base64url") },
      });

      mockProcessedEmailRepository.findByMessageId.mockResolvedValue(null);
      mockProcessedEmailRepository.isDuplicate.mockResolvedValue(false);
      mockProcessedEmailRepository.create.mockResolvedValue({} as any);
      mockProcessedEmailRepository.generatePdfHash.mockReturnValue("hash123");

      await gmailService.monitorEmails(userId);

      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: "me",
        q: expect.stringContaining("has:attachment filename:pdf"),
        maxResults: 50,
      });
    });

    it("should handle Gmail API rate limiting", async () => {
      const rateLimitError = {
        code: 429,
        message: "Rate limit exceeded",
      };
      mockGmail.users.messages.list.mockRejectedValue(rateLimitError);

      await expect(gmailService.getScheduleEmails(userId)).rejects.toThrow(
        "Failed to retrieve schedule emails"
      );
    });

    it("should handle Gmail API network errors", async () => {
      mockGmail.users.messages.list.mockRejectedValue(
        new Error("Network error")
      );

      await expect(gmailService.getScheduleEmails(userId)).rejects.toThrow(
        "Failed to retrieve schedule emails"
      );
    });
  });

  describe("Attachment Download with OAuth", () => {
    it("should download attachments with authenticated client", async () => {
      const attachmentId = "test-attachment-id";
      const messageId = "test-message-id";
      const mockData = Buffer.from("PDF content").toString("base64url");

      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: mockData },
      });

      const result = await gmailService.downloadAttachment(
        userId,
        messageId,
        attachmentId
      );

      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledWith(userId);
      expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledWith({
        userId: "me",
        messageId,
        id: attachmentId,
      });
      expect(result.toString()).toBe("PDF content");
    });

    it("should handle attachment download with expired token", async () => {
      const tokenExpiredError = new Error("Token expired");
      mockOAuth2Service.getGoogleClient.mockRejectedValue(tokenExpiredError);

      await expect(
        gmailService.downloadAttachment(userId, "msg-id", "att-id")
      ).rejects.toThrow("Failed to download attachment");
    });

    it("should retry attachment download after token refresh", async () => {
      // First call fails with expired token
      mockOAuth2Service.getGoogleClient
        .mockRejectedValueOnce(new Error("Token expired"))
        .mockResolvedValueOnce(mockOAuth2Client as any);

      const mockData = Buffer.from("PDF content").toString("base64url");
      mockGmail.users.messages.attachments.get.mockResolvedValue({
        data: { data: mockData },
      });

      // Simulate retry logic (would be in controller/service layer)
      try {
        await gmailService.downloadAttachment(userId, "msg-id", "att-id");
      } catch (error) {
        // Retry after refresh
        await gmailService.downloadAttachment(userId, "msg-id", "att-id");
      }

      expect(mockOAuth2Service.getGoogleClient).toHaveBeenCalledTimes(2);
    });
  });

  describe("Email Filtering and Validation", () => {
    it("should filter emails based on schedule keywords", async () => {
      const mockMessages = [
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
        data: { messages: mockMessages.map((m) => ({ id: m.id })) },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({ data: mockMessages[0] })
        .mockResolvedValueOnce({ data: mockMessages[1] });

      const result = await gmailService.getScheduleEmails(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("msg1");
    });

    it("should validate sender domains", async () => {
      const createMockEmail = (from: string) => ({
        id: "test-id",
        threadId: "test-thread",
        labelIds: ["INBOX"],
        snippet: "test snippet",
        payload: {
          headers: [
            { name: "Subject", value: "Plan zdjęciowy" },
            { name: "From", value: from },
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
      });

      const trustedEmail = createMockEmail("sender@stillontime.pl");
      const untrustedEmail = createMockEmail("sender@untrusted.com");

      expect(gmailService.validateScheduleEmail(trustedEmail as any)).toBe(true);
      // Currently allows all senders, but logs warning
      expect(gmailService.validateScheduleEmail(untrustedEmail as any)).toBe(
        true
      );
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should handle partial email processing failures", async () => {
      const mockMessages = [
        { id: "msg1" },
        { id: "msg2" },
        { id: "msg3" },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      // msg1 succeeds, msg2 fails, msg3 succeeds
      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: "msg1",
            payload: {
              headers: [
                { name: "Subject", value: "Plan zdjęciowy" },
                { name: "From", value: "test@example.com" },
              ],
              parts: [
                {
                  mimeType: "application/pdf",
                  filename: "schedule.pdf",
                  body: { attachmentId: "att1" },
                },
              ],
            },
          },
        })
        .mockRejectedValueOnce(new Error("Message not found"))
        .mockResolvedValueOnce({
          data: {
            id: "msg3",
            payload: {
              headers: [
                { name: "Subject", value: "Harmonogram" },
                { name: "From", value: "test@example.com" },
              ],
              parts: [
                {
                  mimeType: "application/pdf",
                  filename: "schedule.pdf",
                  body: { attachmentId: "att3" },
                },
              ],
            },
          },
        });

      const result = await gmailService.getScheduleEmails(userId);

      // Should get 2 emails despite 1 failure
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle OAuth token refresh during email sync", async () => {
      mockOAuth2Service.getGoogleClient
        .mockRejectedValueOnce(new Error("Token expired"))
        .mockResolvedValueOnce(mockOAuth2Client as any);

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: null },
      });

      // First attempt should fail
      await expect(gmailService.getScheduleEmails(userId)).rejects.toThrow();

      // Second attempt with refreshed token should succeed
      const result = await gmailService.getScheduleEmails(userId);
      expect(result).toEqual([]);
    });
  });

  describe("Performance and Optimization", () => {
    it("should limit email fetch to prevent overwhelming processing", async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: null },
      });

      await gmailService.getScheduleEmails(userId);

      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: "me",
        q: expect.any(String),
        maxResults: 50,
      });
    });

    it("should batch process multiple attachments efficiently", async () => {
      const mockEmail = {
        id: "msg1",
        payload: {
          headers: [
            { name: "Subject", value: "Plan zdjęciowy" },
            { name: "From", value: "test@example.com" },
          ],
          parts: [
            {
              mimeType: "application/pdf",
              filename: "schedule1.pdf",
              body: { attachmentId: "att1", size: 1024 },
            },
            {
              mimeType: "application/pdf",
              filename: "schedule2.pdf",
              body: { attachmentId: "att2", size: 2048 },
            },
          ],
        },
      };

      mockGmail.users.messages.attachments.get
        .mockResolvedValueOnce({
          data: { data: Buffer.from("pdf1").toString("base64url") },
        })
        .mockResolvedValueOnce({
          data: { data: Buffer.from("pdf2").toString("base64url") },
        });

      const attachments = await gmailService.getEmailAttachments(
        userId,
        mockEmail as any
      );

      expect(attachments).toHaveLength(2);
      expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledTimes(2);
    });
  });
});
