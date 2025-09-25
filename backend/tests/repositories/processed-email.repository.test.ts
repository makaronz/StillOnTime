import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { prisma } from "@/config/database";
import { ProcessedEmail } from "@/types";
import crypto from "crypto";

// Mock the database module
jest.mock("@/config/database");

describe("ProcessedEmailRepository", () => {
  let processedEmailRepository: ProcessedEmailRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    processedEmailRepository = new ProcessedEmailRepository();
    jest.clearAllMocks();
  });

  describe("findByMessageId", () => {
    it("should find email by message ID", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: false,
        processingStatus: "pending",
        pdfHash: "hash-123",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.findUnique.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.findByMessageId("msg-123");

      expect(mockPrisma.processedEmail.findUnique).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
      });
      expect(result).toEqual(mockEmail);
    });
  });

  describe("findByPdfHash", () => {
    it("should find email by PDF hash", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: false,
        processingStatus: "pending",
        pdfHash: "hash-123",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.findFirst.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.findByPdfHash("hash-123");

      expect(mockPrisma.processedEmail.findFirst).toHaveBeenCalledWith({
        where: { pdfHash: "hash-123" },
      });
      expect(result).toEqual(mockEmail);
    });
  });

  describe("isDuplicate", () => {
    it("should return true if email with message ID exists", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: false,
        processingStatus: "pending",
        pdfHash: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.findFirst.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.isDuplicate("msg-123");

      expect(mockPrisma.processedEmail.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ messageId: "msg-123" }],
        },
      });
      expect(result).toBe(true);
    });

    it("should return true if email with PDF hash exists", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-456",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: false,
        processingStatus: "pending",
        pdfHash: "hash-123",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.findFirst.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.isDuplicate(
        "msg-123",
        "hash-123"
      );

      expect(mockPrisma.processedEmail.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ messageId: "msg-123" }, { pdfHash: "hash-123" }],
        },
      });
      expect(result).toBe(true);
    });

    it("should return false if no duplicate found", async () => {
      mockPrisma.processedEmail.findFirst.mockResolvedValue(null);

      const result = await processedEmailRepository.isDuplicate("msg-123");

      expect(result).toBe(false);
    });
  });

  describe("markAsProcessed", () => {
    it("should mark email as processed", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: true,
        processingStatus: "completed",
        pdfHash: "hash-123",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.update.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.markAsProcessed("email-1");

      expect(mockPrisma.processedEmail.update).toHaveBeenCalledWith({
        where: { id: "email-1" },
        data: {
          processed: true,
          processingStatus: "completed",
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockEmail);
    });
  });

  describe("markAsFailed", () => {
    it("should mark email as failed with error message", async () => {
      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        threadId: "thread-123",
        processed: false,
        processingStatus: "failed",
        pdfHash: "hash-123",
        error: "PDF parsing failed",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
      };

      mockPrisma.processedEmail.update.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.markAsFailed(
        "email-1",
        "PDF parsing failed"
      );

      expect(mockPrisma.processedEmail.update).toHaveBeenCalledWith({
        where: { id: "email-1" },
        data: {
          processed: false,
          processingStatus: "failed",
          error: "PDF parsing failed",
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockEmail);
    });
  });

  describe("generatePdfHash", () => {
    it("should generate SHA-256 hash for PDF buffer", () => {
      const pdfBuffer = Buffer.from("test pdf content");
      const expectedHash = crypto
        .createHash("sha256")
        .update(pdfBuffer)
        .digest("hex");

      const result = processedEmailRepository.generatePdfHash(pdfBuffer);

      expect(result).toBe(expectedHash);
    });
  });

  describe("getProcessingStats", () => {
    it("should return processing statistics", async () => {
      mockPrisma.processedEmail.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // processed
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1); // failed

      const result = await processedEmailRepository.getProcessingStats(
        "user-1"
      );

      expect(result).toEqual({
        total: 10,
        processed: 7,
        pending: 2,
        failed: 1,
      });

      expect(mockPrisma.processedEmail.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.processedEmail.count).toHaveBeenNthCalledWith(1, {
        where: { userId: "user-1" },
      });
      expect(mockPrisma.processedEmail.count).toHaveBeenNthCalledWith(2, {
        where: { userId: "user-1", processed: true },
      });
      expect(mockPrisma.processedEmail.count).toHaveBeenNthCalledWith(3, {
        where: { userId: "user-1", processingStatus: "pending" },
      });
      expect(mockPrisma.processedEmail.count).toHaveBeenNthCalledWith(4, {
        where: { userId: "user-1", processingStatus: "failed" },
      });
    });
  });

  describe("createWithDuplicateCheck", () => {
    it("should create email if not duplicate", async () => {
      const emailData = {
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        processed: false,
        processingStatus: "pending",
        user: { connect: { id: "user-1" } },
      };

      const pdfBuffer = Buffer.from("test pdf content");
      const expectedHash = crypto
        .createHash("sha256")
        .update(pdfBuffer)
        .digest("hex");

      const mockEmail: ProcessedEmail = {
        id: "email-1",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        processed: false,
        processingStatus: "pending",
        userId: "user-1",
        threadId: null,
        pdfHash: expectedHash,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.processedEmail.findFirst.mockResolvedValue(null); // Not duplicate
      mockPrisma.processedEmail.create.mockResolvedValue(mockEmail);

      const result = await processedEmailRepository.createWithDuplicateCheck({
        ...emailData,
        pdfBuffer,
      });

      expect(mockPrisma.processedEmail.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ messageId: "msg-123" }, { pdfHash: expectedHash }],
        },
      });
      expect(mockPrisma.processedEmail.create).toHaveBeenCalledWith({
        data: {
          ...emailData,
          pdfHash: expectedHash,
        },
      });
      expect(result).toEqual(mockEmail);
    });

    it("should return null if duplicate found", async () => {
      const emailData = {
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        processed: false,
        processingStatus: "pending",
        user: { connect: { id: "user-1" } },
      };

      const mockExistingEmail: ProcessedEmail = {
        id: "email-existing",
        messageId: "msg-123",
        subject: "Test Schedule",
        sender: "sender@example.com",
        receivedAt: new Date(),
        processed: false,
        processingStatus: "pending",
        userId: "user-1",
        threadId: null,
        pdfHash: "existing-hash",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.processedEmail.findFirst.mockResolvedValue(mockExistingEmail); // Duplicate found

      const result = await processedEmailRepository.createWithDuplicateCheck(
        emailData
      );

      expect(result).toBeNull();
      expect(mockPrisma.processedEmail.create).not.toHaveBeenCalled();
    });
  });
});
