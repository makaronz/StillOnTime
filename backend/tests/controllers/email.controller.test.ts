import request from "supertest";
import express from "express";
import { emailController } from "@/controllers/email.controller";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import {
  authenticateToken,
  requireValidOAuth,
} from "@/middleware/auth.middleware";
import { emailRoutes } from "@/routes/email.routes";

// Mock dependencies
jest.mock("@/services", () => ({
  services: {
    jobProcessor: {
      addEmailProcessingJob: jest.fn(),
      getJobStats: jest.fn(),
      schedulePeriodicEmailCheck: jest.fn(),
      cancelPeriodicEmailCheck: jest.fn(),
    },
    gmail: {
      getEmailStats: jest.fn(),
    },
  },
}));

jest.mock("@/repositories/processed-email.repository");
jest.mock("@/middleware/auth.middleware");

// Import mocked services after mocking
import { services } from "@/services";

const mockProcessedEmailRepository =
  ProcessedEmailRepository as jest.MockedClass<typeof ProcessedEmailRepository>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<
  typeof authenticateToken
>;
const mockRequireValidOAuth = requireValidOAuth as jest.MockedFunction<
  typeof requireValidOAuth
>;

describe("EmailController", () => {
  let app: express.Application;
  let mockUser: { userId: string; email: string };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    mockUser = { userId: "test-user-id", email: "test@example.com" };
    mockAuthenticateToken.mockImplementation(async (req: any, res, next) => {
      req.user = mockUser;
      next();
    });
    mockRequireValidOAuth.mockImplementation(async (req, res, next) => {
      next();
    });

    app.use("/api/email", emailRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("POST /api/email/process", () => {
    it("should trigger manual email processing successfully", async () => {
      const mockJob = {
        id: "job-123",
        status: "queued",
      };

      (
        services.jobProcessor.addEmailProcessingJob as jest.Mock
      ).mockResolvedValue(mockJob);

      const response = await request(app).post("/api/email/process").send({
        messageId: "test-message-id",
        priority: 1,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        job: {
          id: "job-123",
          status: "queued",
          messageId: "test-message-id",
          priority: 1,
        },
        message: "Specific email processing queued",
      });

      expect(services.jobProcessor.addEmailProcessingJob).toHaveBeenCalledWith(
        "test-user-id",
        "test-message-id",
        1
      );
    });

    it("should trigger general email monitoring when no messageId provided", async () => {
      const mockJob = {
        id: "job-456",
        status: "queued",
      };

      (
        services.jobProcessor.addEmailProcessingJob as jest.Mock
      ).mockResolvedValue(mockJob);

      const response = await request(app).post("/api/email/process").send({
        priority: 0,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        job: {
          id: "job-456",
          status: "queued",
          messageId: undefined,
          priority: 0,
        },
        message: "Email monitoring queued",
      });

      expect(services.jobProcessor.addEmailProcessingJob).toHaveBeenCalledWith(
        "test-user-id",
        undefined,
        0
      );
    });

    it("should handle job processor errors", async () => {
      (
        services.jobProcessor.addEmailProcessingJob as jest.Mock
      ).mockRejectedValue(new Error("Job processor failed"));

      const response = await request(app).post("/api/email/process").send({});

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "Internal Server Error",
        message: "Failed to trigger email processing",
        code: "EMAIL_PROCESSING_FAILED",
      });
    });

    it("should validate request parameters", async () => {
      const response = await request(app).post("/api/email/process").send({
        priority: 15, // Invalid priority (max 10)
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("GET /api/email/status", () => {
    it("should return email processing status successfully", async () => {
      const mockStats = {
        totalEmails: 10,
        processedEmails: 8,
        pendingEmails: 1,
        failedEmails: 1,
        lastCheck: new Date(),
      };

      const mockJobStats = {
        emailProcessing: {
          waiting: 2,
          active: 1,
          completed: 10,
          failed: 1,
        },
      };

      const mockRecentEmails = [
        {
          id: "email-1",
          messageId: "msg-1",
          subject: "Test Schedule",
          sender: "test@example.com",
          receivedAt: new Date(),
          processed: true,
          processingStatus: "completed",
          error: null,
          schedule: {
            id: "schedule-1",
            shootingDate: new Date(),
            callTime: "08:00",
            location: "Test Location",
            sceneType: "EXT",
          },
        },
      ];

      (services.gmail.getEmailStats as jest.Mock).mockResolvedValue(mockStats);
      (services.jobProcessor.getJobStats as jest.Mock).mockResolvedValue(
        mockJobStats
      );

      const mockRepository = new mockProcessedEmailRepository();
      mockRepository.findRecentEmails = jest
        .fn()
        .mockResolvedValue(mockRecentEmails);
      (emailController as any).processedEmailRepository = mockRepository;

      const response = await request(app)
        .get("/api/email/status")
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        statistics: mockStats,
        jobQueue: mockJobStats.emailProcessing,
        recentEmails: expect.arrayContaining([
          expect.objectContaining({
            id: "email-1",
            messageId: "msg-1",
            subject: "Test Schedule",
          }),
        ]),
      });
    });

    it("should filter emails by status", async () => {
      const mockPendingEmails = [
        {
          id: "email-pending",
          messageId: "msg-pending",
          subject: "Pending Schedule",
          sender: "test@example.com",
          receivedAt: new Date(),
          processed: false,
          processingStatus: "pending",
          error: null,
        },
      ];

      (services.gmail.getEmailStats as jest.Mock).mockResolvedValue({});
      (services.jobProcessor.getJobStats as jest.Mock).mockResolvedValue({});

      const mockRepository = new mockProcessedEmailRepository();
      mockRepository.findPendingEmails = jest
        .fn()
        .mockResolvedValue(mockPendingEmails);
      (emailController as any).processedEmailRepository = mockRepository;

      const response = await request(app)
        .get("/api/email/status")
        .query({ status: "pending" });

      expect(response.status).toBe(200);
      expect(mockRepository.findPendingEmails).toHaveBeenCalledWith(
        "test-user-id"
      );
    });
  });

  describe("GET /api/email/statistics", () => {
    it("should return processing statistics for default period", async () => {
      const mockOverallStats = {
        total: 100,
        processed: 85,
        pending: 10,
        failed: 5,
      };

      const mockPeriodEmails = [
        {
          processed: true,
          processingStatus: "completed",
          receivedAt: new Date(),
        },
        {
          processed: false,
          processingStatus: "failed",
          receivedAt: new Date(),
        },
      ];

      const mockRepository = new mockProcessedEmailRepository();
      mockRepository.getProcessingStats = jest
        .fn()
        .mockResolvedValue(mockOverallStats);
      mockRepository.findMany = jest.fn().mockResolvedValue(mockPeriodEmails);
      (emailController as any).processedEmailRepository = mockRepository;

      const response = await request(app).get("/api/email/statistics");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        period: "30d",
        overall: mockOverallStats,
        periodStats: {
          total: 2,
          successful: 1,
          failed: 1,
          successRate: 50,
        },
        chartData: expect.any(Array),
      });
    });

    it("should return statistics for specific period", async () => {
      const mockRepository = new mockProcessedEmailRepository();
      mockRepository.getProcessingStats = jest.fn().mockResolvedValue({
        total: 50,
        processed: 45,
        pending: 3,
        failed: 2,
      });
      mockRepository.findMany = jest.fn().mockResolvedValue([]);
      (emailController as any).processedEmailRepository = mockRepository;

      const response = await request(app)
        .get("/api/email/statistics")
        .query({ period: "7d" });

      expect(response.status).toBe(200);
      expect(response.body.period).toBe("7d");
    });
  });

  describe("POST /api/email/monitoring", () => {
    it("should enable periodic email monitoring", async () => {
      (
        services.jobProcessor.schedulePeriodicEmailCheck as jest.Mock
      ).mockResolvedValue({});

      const response = await request(app).post("/api/email/monitoring").send({
        enabled: true,
        intervalMinutes: 10,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        monitoring: {
          enabled: true,
          intervalMinutes: 10,
        },
        message: "Periodic email monitoring enabled",
      });

      expect(
        services.jobProcessor.schedulePeriodicEmailCheck
      ).toHaveBeenCalledWith("test-user-id", 10);
    });

    it("should disable periodic email monitoring", async () => {
      (
        services.jobProcessor.cancelPeriodicEmailCheck as jest.Mock
      ).mockResolvedValue(undefined);

      const response = await request(app).post("/api/email/monitoring").send({
        enabled: false,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        monitoring: {
          enabled: false,
          intervalMinutes: null,
        },
        message: "Periodic email monitoring disabled",
      });

      expect(
        services.jobProcessor.cancelPeriodicEmailCheck
      ).toHaveBeenCalledWith("test-user-id");
    });

    it("should validate enabled field", async () => {
      const response = await request(app).post("/api/email/monitoring").send({
        enabled: "invalid", // Should be boolean
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Bad Request",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("GET /api/email/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/email/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        service: "email-processing",
        timestamp: expect.any(String),
        version: "1.0.0",
      });
    });
  });
});
