import { JobProcessorService } from "@/services/job-processor.service";
import { GmailService } from "@/services/gmail.service";
import { PDFParserService } from "@/services/pdf-parser.service";
import { OAuth2Service } from "@/services/oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import Bull from "bull";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("bull");
jest.mock("@/utils/logger");

const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  on: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn(),
  getJob: jest.fn(),
  clean: jest.fn(),
  close: jest.fn(),
};

const mockGmailService = {
  monitorEmails: jest.fn(),
  processSpecificEmail: jest.fn(),
  getEmailAttachments: jest.fn(),
} as unknown as jest.Mocked<GmailService>;

const mockPDFParserService = {
  parsePDFAttachment: jest.fn(),
  validateExtractedData: jest.fn(),
} as unknown as jest.Mocked<PDFParserService>;

const mockOAuth2Service = {
  getOAuthStatus: jest.fn(),
} as unknown as jest.Mocked<OAuth2Service>;

const mockProcessedEmailRepository = {
  findPendingEmails: jest.fn(),
  findWithSchedule: jest.fn(),
  markAsProcessed: jest.fn(),
  markAsFailed: jest.fn(),
} as unknown as jest.Mocked<ProcessedEmailRepository>;

const mockScheduleDataRepository = {
  findById: jest.fn(),
  create: jest.fn(),
} as unknown as jest.Mocked<ScheduleDataRepository>;

describe("JobProcessorService", () => {
  let jobProcessorService: JobProcessorService;
  const userId = "test-user-id";
  const messageId = "test-message-id";
  const scheduleId = "test-schedule-id";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Bull constructor
    (Bull as jest.MockedClass<typeof Bull>).mockImplementation(
      () => mockQueue as any
    );

    jobProcessorService = new JobProcessorService(
      mockGmailService as any,
      mockPDFParserService as any,
      mockOAuth2Service as any,
      mockProcessedEmailRepository as any,
      mockScheduleDataRepository as any
    );
  });

  describe("addEmailProcessingJob", () => {
    it("should add email processing job to queue", async () => {
      const mockJob = { id: "job-123" };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await jobProcessorService.addEmailProcessingJob(
        userId,
        messageId,
        1
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-email",
        {
          userId,
          messageId,
          retryCount: 0,
          maxRetries: 3,
        },
        {
          priority: 1,
          delay: 0,
          jobId: `email-${userId}-${messageId}`,
        }
      );
      expect(result).toBe(mockJob);
    });

    it("should handle job addition errors", async () => {
      mockQueue.add.mockRejectedValue(new Error("Queue error"));

      await expect(
        jobProcessorService.addEmailProcessingJob(userId, messageId)
      ).rejects.toThrow("Failed to add email processing job");
    });

    it("should generate unique job ID when no messageId provided", async () => {
      const mockJob = { id: "job-123" };
      mockQueue.add.mockResolvedValue(mockJob);

      await jobProcessorService.addEmailProcessingJob(userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-email",
        expect.objectContaining({
          userId,
          messageId: undefined,
        }),
        expect.objectContaining({
          jobId: expect.stringMatching(`email-${userId}-\\d+`),
        })
      );
    });
  });

  describe("addWeatherUpdateJob", () => {
    it("should add weather update job to queue", async () => {
      const mockJob = { id: "weather-job-123" };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await jobProcessorService.addWeatherUpdateJob(
        scheduleId,
        2
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        "update-weather",
        {
          scheduleId,
          retryCount: 0,
        },
        {
          priority: 2,
          delay: 0,
          jobId: `weather-${scheduleId}`,
        }
      );
      expect(result).toBe(mockJob);
    });

    it("should handle weather job addition errors", async () => {
      mockQueue.add.mockRejectedValue(new Error("Weather queue error"));

      await expect(
        jobProcessorService.addWeatherUpdateJob(scheduleId)
      ).rejects.toThrow("Failed to add weather update job");
    });
  });

  describe("schedulePeriodicEmailCheck", () => {
    it("should schedule periodic email check", async () => {
      const mockJob = { id: "periodic-job-123" };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await jobProcessorService.schedulePeriodicEmailCheck(
        userId,
        10
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        "periodic-email-check",
        {
          userId,
          lastCheck: expect.any(Date),
        },
        {
          repeat: { every: 600000 }, // 10 minutes in milliseconds
          jobId: `periodic-check-${userId}`,
        }
      );
      expect(result).toBe(mockJob);
    });

    it("should use default interval when not specified", async () => {
      const mockJob = { id: "periodic-job-123" };
      mockQueue.add.mockResolvedValue(mockJob);

      await jobProcessorService.schedulePeriodicEmailCheck(userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "periodic-email-check",
        expect.any(Object),
        expect.objectContaining({
          repeat: { every: 300000 }, // 5 minutes default
        })
      );
    });
  });

  describe("cancelPeriodicEmailCheck", () => {
    it("should cancel existing periodic job", async () => {
      const mockJob = { remove: jest.fn() };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await jobProcessorService.cancelPeriodicEmailCheck(userId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(`periodic-check-${userId}`);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it("should handle missing job gracefully", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(
        jobProcessorService.cancelPeriodicEmailCheck(userId)
      ).resolves.not.toThrow();
    });
  });

  describe("getJobStats", () => {
    it("should return comprehensive job statistics", async () => {
      const mockStats = {
        waiting: [1, 2],
        active: [3],
        completed: [4, 5, 6],
        failed: [7],
      };

      // Mock all queue stat calls
      mockQueue.getWaiting.mockResolvedValue(mockStats.waiting);
      mockQueue.getActive.mockResolvedValue(mockStats.active);
      mockQueue.getCompleted.mockResolvedValue(mockStats.completed);
      mockQueue.getFailed.mockResolvedValue(mockStats.failed);

      const result = await jobProcessorService.getJobStats();

      expect(result).toEqual({
        emailProcessing: {
          waiting: 2,
          active: 1,
          completed: 3,
          failed: 1,
        },
        weatherUpdate: {
          waiting: 2,
          active: 1,
          completed: 3,
          failed: 1,
        },
        periodicCheck: {
          waiting: 2,
          active: 1,
          completed: 3,
          failed: 1,
        },
      });
    });

    it("should handle stats retrieval errors", async () => {
      mockQueue.getWaiting.mockRejectedValue(new Error("Stats error"));

      await expect(jobProcessorService.getJobStats()).rejects.toThrow(
        "Failed to get job statistics"
      );
    });
  });

  describe("retryFailedJob", () => {
    it("should retry failed email processing job", async () => {
      const mockJob = { retry: jest.fn() };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await jobProcessorService.retryFailedJob("email-processing", "job-123");

      expect(mockQueue.getJob).toHaveBeenCalledWith("job-123");
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it("should handle unknown queue names", async () => {
      await expect(
        jobProcessorService.retryFailedJob("unknown-queue", "job-123")
      ).rejects.toThrow("Unknown queue: unknown-queue");
    });

    it("should handle missing jobs", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(
        jobProcessorService.retryFailedJob("email-processing", "job-123")
      ).rejects.toThrow("Job job-123 not found");
    });
  });

  describe("cleanupOldJobs", () => {
    it("should clean up old completed and failed jobs", async () => {
      mockQueue.clean.mockResolvedValue(undefined);

      await jobProcessorService.cleanupOldJobs(48);

      // Should call clean for each queue and status
      expect(mockQueue.clean).toHaveBeenCalledTimes(6); // 3 queues × 2 statuses

      const expectedCutoffTime = expect.any(Number);
      expect(mockQueue.clean).toHaveBeenCalledWith(
        expectedCutoffTime,
        "completed"
      );
      expect(mockQueue.clean).toHaveBeenCalledWith(
        expectedCutoffTime,
        "failed"
      );
    });

    it("should use default cleanup time", async () => {
      mockQueue.clean.mockResolvedValue(undefined);

      await jobProcessorService.cleanupOldJobs();

      expect(mockQueue.clean).toHaveBeenCalledTimes(6);
    });

    it("should handle cleanup errors gracefully", async () => {
      mockQueue.clean.mockRejectedValue(new Error("Cleanup error"));

      await expect(jobProcessorService.cleanupOldJobs()).resolves.not.toThrow();
    });
  });

  describe("shutdown", () => {
    it("should gracefully shutdown all queues", async () => {
      mockQueue.close.mockResolvedValue(undefined);

      await jobProcessorService.shutdown();

      expect(mockQueue.close).toHaveBeenCalledTimes(3); // 3 queues
    });

    it("should handle shutdown errors", async () => {
      mockQueue.close.mockRejectedValue(new Error("Shutdown error"));

      await expect(jobProcessorService.shutdown()).resolves.not.toThrow();
    });
  });

  describe("job processing", () => {
    let mockJob: any;

    beforeEach(() => {
      mockJob = {
        id: "test-job-id",
        data: {},
        progress: jest.fn(),
      };
    });

    describe("processEmailJob", () => {
      beforeEach(() => {
        mockJob.data = {
          userId,
          messageId,
          retryCount: 0,
          maxRetries: 3,
        };
      });

      it("should process specific email when messageId provided", async () => {
        mockGmailService.processSpecificEmail.mockResolvedValue();
        mockProcessedEmailRepository.findPendingEmails.mockResolvedValue([]);

        // Access private method for testing
        const service = jobProcessorService as any;
        await service.processEmailJob(mockJob);

        expect(mockGmailService.processSpecificEmail).toHaveBeenCalledWith(
          userId,
          messageId
        );
        expect(mockJob.progress).toHaveBeenCalledWith(100);
      });

      it("should monitor all emails when no messageId provided", async () => {
        mockJob.data.messageId = undefined;
        mockGmailService.monitorEmails.mockResolvedValue();
        mockProcessedEmailRepository.findPendingEmails.mockResolvedValue([]);

        const service = jobProcessorService as any;
        await service.processEmailJob(mockJob);

        expect(mockGmailService.monitorEmails).toHaveBeenCalledWith(userId);
      });

      it("should process pending emails", async () => {
        const pendingEmails = [
          { id: "email-1", messageId: "msg-1" },
          { id: "email-2", messageId: "msg-2" },
        ];

        mockGmailService.processSpecificEmail.mockResolvedValue();
        mockProcessedEmailRepository.findPendingEmails.mockResolvedValue(
          pendingEmails as any
        );

        // Mock processPendingEmail method
        const service = jobProcessorService as any;
        service.processPendingEmail = jest.fn().mockResolvedValue(undefined);

        await service.processEmailJob(mockJob);

        expect(service.processPendingEmail).toHaveBeenCalledTimes(2);
        expect(service.processPendingEmail).toHaveBeenCalledWith("email-1");
        expect(service.processPendingEmail).toHaveBeenCalledWith("email-2");
      });

      it("should handle individual pending email failures", async () => {
        const pendingEmails = [{ id: "email-1", messageId: "msg-1" }];

        mockGmailService.processSpecificEmail.mockResolvedValue();
        mockProcessedEmailRepository.findPendingEmails.mockResolvedValue(
          pendingEmails as any
        );
        mockProcessedEmailRepository.markAsFailed.mockResolvedValue({} as any);

        const service = jobProcessorService as any;
        service.processPendingEmail = jest
          .fn()
          .mockRejectedValue(new Error("Processing failed"));

        await service.processEmailJob(mockJob);

        expect(mockProcessedEmailRepository.markAsFailed).toHaveBeenCalledWith(
          "email-1",
          "Processing failed"
        );
      });

      it("should increment retry count on failure", async () => {
        mockGmailService.processSpecificEmail.mockRejectedValue(
          new Error("Gmail error")
        );

        const service = jobProcessorService as any;

        await expect(service.processEmailJob(mockJob)).rejects.toThrow(
          "Gmail error"
        );

        expect(mockJob.data.retryCount).toBe(1);
      });
    });

    describe("processWeatherJob", () => {
      beforeEach(() => {
        mockJob.data = {
          scheduleId,
          retryCount: 0,
        };
      });

      it("should process weather update job", async () => {
        const mockSchedule = { id: scheduleId, location: "Test Location" };
        mockScheduleDataRepository.findById.mockResolvedValue(
          mockSchedule as any
        );

        const service = jobProcessorService as any;
        await service.processWeatherJob(mockJob);

        expect(mockScheduleDataRepository.findById).toHaveBeenCalledWith(
          scheduleId
        );
        expect(mockJob.progress).toHaveBeenCalledWith(100);
      });

      it("should handle missing schedule", async () => {
        mockScheduleDataRepository.findById.mockResolvedValue(null);

        const service = jobProcessorService as any;

        await expect(service.processWeatherJob(mockJob)).rejects.toThrow(
          `Schedule ${scheduleId} not found`
        );
      });

      it("should increment retry count on failure", async () => {
        mockScheduleDataRepository.findById.mockRejectedValue(
          new Error("Database error")
        );

        const service = jobProcessorService as any;

        await expect(service.processWeatherJob(mockJob)).rejects.toThrow(
          "Database error"
        );

        expect(mockJob.data.retryCount).toBe(1);
      });
    });

    describe("processPeriodicEmailCheck", () => {
      beforeEach(() => {
        mockJob.data = {
          userId,
          lastCheck: new Date(),
        };
      });

      it("should process periodic email check", async () => {
        mockOAuth2Service.getOAuthStatus.mockResolvedValue({
          isAuthenticated: true,
          scopes: [],
          needsReauth: false,
        });
        mockGmailService.monitorEmails.mockResolvedValue();

        const service = jobProcessorService as any;
        await service.processPeriodicEmailCheck(mockJob);

        expect(mockOAuth2Service.getOAuthStatus).toHaveBeenCalledWith(userId);
        expect(mockGmailService.monitorEmails).toHaveBeenCalledWith(userId);
        expect(mockJob.progress).toHaveBeenCalledWith(100);
        expect(mockJob.data.lastCheck).toBeInstanceOf(Date);
      });

      it("should skip check for unauthenticated user", async () => {
        mockOAuth2Service.getOAuthStatus.mockResolvedValue({
          isAuthenticated: false,
          scopes: [],
          needsReauth: true,
        });

        const service = jobProcessorService as any;
        await service.processPeriodicEmailCheck(mockJob);

        expect(mockGmailService.monitorEmails).not.toHaveBeenCalled();
      });

      it("should not throw on periodic check errors", async () => {
        mockOAuth2Service.getOAuthStatus.mockRejectedValue(
          new Error("OAuth error")
        );

        const service = jobProcessorService as any;

        await expect(
          service.processPeriodicEmailCheck(mockJob)
        ).resolves.not.toThrow();
      });
    });
  });

  describe("processPendingEmail", () => {
    it("should process pending email with PDF parsing", async () => {
      const mockEmail = {
        id: "email-1",
        userId,
        messageId: "msg-1",
        threadId: "thread-1",
        receivedAt: new Date(),
      };

      const mockAttachments = [
        {
          attachmentId: "att-1",
          filename: "schedule.pdf",
          mimeType: "application/pdf",
          size: 1024,
          data: Buffer.from("pdf content"),
        },
      ];

      const mockParsedData = {
        shootingDate: new Date(),
        callTime: "08:30",
        location: "Test Location",
        confidence: 0.9,
      };

      const mockValidation = {
        isValid: true,
        errors: [],
        confidence: 0.9,
      };

      const mockScheduleData = { id: "schedule-1" };

      mockProcessedEmailRepository.findWithSchedule.mockResolvedValue(
        mockEmail as any
      );
      mockGmailService.getEmailAttachments.mockResolvedValue(mockAttachments);
      mockPDFParserService.parsePDFAttachment.mockResolvedValue(
        mockParsedData as any
      );
      mockPDFParserService.validateExtractedData.mockReturnValue(
        mockValidation
      );
      mockScheduleDataRepository.create.mockResolvedValue(
        mockScheduleData as any
      );
      mockProcessedEmailRepository.markAsProcessed.mockResolvedValue({} as any);

      const service = jobProcessorService as any;
      await service.processPendingEmail("email-1");

      expect(mockPDFParserService.parsePDFAttachment).toHaveBeenCalledWith(
        mockAttachments[0].data,
        "schedule.pdf"
      );
      expect(mockScheduleDataRepository.create).toHaveBeenCalled();
      expect(mockProcessedEmailRepository.markAsProcessed).toHaveBeenCalledWith(
        "email-1"
      );
    });

    it("should handle validation failures", async () => {
      const mockEmail = {
        id: "email-1",
        userId,
        messageId: "msg-1",
        threadId: "thread-1",
        receivedAt: new Date(),
      };

      const mockAttachments = [
        {
          attachmentId: "att-1",
          filename: "schedule.pdf",
          mimeType: "application/pdf",
          size: 1024,
          data: Buffer.from("pdf content"),
        },
      ];

      const mockParsedData = {
        confidence: 0.3, // Low confidence
      };

      const mockValidation = {
        isValid: false,
        errors: ["Confidence too low", "Missing required fields"],
        confidence: 0.3,
      };

      mockProcessedEmailRepository.findWithSchedule.mockResolvedValue(
        mockEmail as any
      );
      mockGmailService.getEmailAttachments.mockResolvedValue(mockAttachments);
      mockPDFParserService.parsePDFAttachment.mockResolvedValue(
        mockParsedData as any
      );
      mockPDFParserService.validateExtractedData.mockReturnValue(
        mockValidation
      );
      mockProcessedEmailRepository.markAsFailed.mockResolvedValue({} as any);

      const service = jobProcessorService as any;
      await service.processPendingEmail("email-1");

      expect(mockProcessedEmailRepository.markAsFailed).toHaveBeenCalledWith(
        "email-1",
        "Validation failed: Confidence too low, Missing required fields"
      );
      expect(mockScheduleDataRepository.create).not.toHaveBeenCalled();
    });

    it("should handle missing email", async () => {
      mockProcessedEmailRepository.findWithSchedule.mockResolvedValue(null);

      const service = jobProcessorService as any;

      await expect(service.processPendingEmail("email-1")).rejects.toThrow(
        "Email email-1 not found"
      );
    });

    it("should handle missing attachments", async () => {
      const mockEmail = {
        id: "email-1",
        userId,
        messageId: "msg-1",
        threadId: "thread-1",
        receivedAt: new Date(),
      };

      mockProcessedEmailRepository.findWithSchedule.mockResolvedValue(
        mockEmail as any
      );
      mockGmailService.getEmailAttachments.mockResolvedValue([]);

      const service = jobProcessorService as any;

      await expect(service.processPendingEmail("email-1")).rejects.toThrow(
        "No PDF attachments found"
      );
    });
  });
});
