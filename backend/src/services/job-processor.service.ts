import Bull, { Job, Queue, JobOptions } from "bull";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";
import { GmailService } from "./gmail.service";
import { PDFParserService } from "./pdf-parser.service";
import { OAuth2Service } from "./oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { EmailProcessingData, WeatherUpdateData } from "@/types";

export interface JobProcessorOptions {
  concurrency?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  defaultJobOptions?: JobOptions;
}

export interface EmailProcessingJobData extends EmailProcessingData {
  retryCount?: number;
  maxRetries?: number;
}

export interface WeatherUpdateJobData extends WeatherUpdateData {
  retryCount?: number;
}

export interface PeriodicEmailCheckJobData {
  userId: string;
  lastCheck?: Date;
}

/**
 * Background Job Processor Service
 * Handles asynchronous processing of emails, PDF parsing, and scheduled tasks
 */
export class JobProcessorService {
  private emailProcessingQueue: Queue<EmailProcessingJobData>;
  private weatherUpdateQueue: Queue<WeatherUpdateJobData>;
  private periodicCheckQueue: Queue<PeriodicEmailCheckJobData>;

  private gmailService: GmailService;
  private pdfParserService: PDFParserService;
  private oauth2Service: OAuth2Service;
  private processedEmailRepository: ProcessedEmailRepository;
  private scheduleDataRepository: ScheduleDataRepository;

  private readonly DEFAULT_OPTIONS: JobProcessorOptions = {
    concurrency: 5,
    removeOnComplete: 100,
    removeOnFail: 50,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  };

  constructor(
    gmailService: GmailService,
    pdfParserService: PDFParserService,
    oauth2Service: OAuth2Service,
    processedEmailRepository: ProcessedEmailRepository,
    scheduleDataRepository: ScheduleDataRepository,
    options: JobProcessorOptions = {}
  ) {
    this.gmailService = gmailService;
    this.pdfParserService = pdfParserService;
    this.oauth2Service = oauth2Service;
    this.processedEmailRepository = processedEmailRepository;
    this.scheduleDataRepository = scheduleDataRepository;

    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

    // Initialize job queues
    this.emailProcessingQueue = new Bull<EmailProcessingJobData>(
      "email-processing",
      {
        redis: config.redisUrl,
        defaultJobOptions: finalOptions.defaultJobOptions,
      }
    );

    this.weatherUpdateQueue = new Bull<WeatherUpdateJobData>("weather-update", {
      redis: config.redisUrl,
      defaultJobOptions: finalOptions.defaultJobOptions,
    });

    this.periodicCheckQueue = new Bull<PeriodicEmailCheckJobData>(
      "periodic-email-check",
      {
        redis: config.redisUrl,
        defaultJobOptions: finalOptions.defaultJobOptions,
      }
    );

    // Set up job processors
    this.setupJobProcessors(finalOptions);

    // Set up event listeners
    this.setupEventListeners();

    logger.info("Job processor service initialized", {
      concurrency: finalOptions.concurrency,
      removeOnComplete: finalOptions.removeOnComplete,
      removeOnFail: finalOptions.removeOnFail,
    });
  }

  /**
   * Add email processing job to queue
   */
  async addEmailProcessingJob(
    userId: string,
    messageId?: string,
    priority: number = 0
  ): Promise<Job<EmailProcessingJobData>> {
    try {
      const jobData: EmailProcessingJobData = {
        userId,
        messageId,
        retryCount: 0,
        maxRetries: 3,
      };

      const job = await this.emailProcessingQueue.add(
        "process-email",
        jobData,
        {
          priority,
          delay: 0,
          jobId: messageId
            ? `email-${userId}-${messageId}`
            : `email-${userId}-${Date.now()}`,
        }
      );

      logger.info("Added email processing job", {
        jobId: job.id,
        userId,
        messageId,
        priority,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add email processing job", {
        userId,
        messageId,
        error,
      });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to add email processing job: ${errorMessage}`);
    }
  }

  /**
   * Add weather update job to queue
   */
  async addWeatherUpdateJob(
    scheduleId: string,
    priority: number = 0
  ): Promise<Job<WeatherUpdateJobData>> {
    try {
      const jobData: WeatherUpdateJobData = {
        scheduleId,
        retryCount: 0,
      };

      const job = await this.weatherUpdateQueue.add("update-weather", jobData, {
        priority,
        delay: 0,
        jobId: `weather-${scheduleId}`,
      });

      logger.info("Added weather update job", {
        jobId: job.id,
        scheduleId,
        priority,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add weather update job", {
        scheduleId,
        error,
      });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to add weather update job: ${errorMessage}`);
    }
  }

  /**
   * Schedule periodic email checks for a user
   */
  async schedulePeriodicEmailCheck(
    userId: string,
    intervalMinutes: number = 5
  ): Promise<Job<PeriodicEmailCheckJobData>> {
    try {
      const jobData: PeriodicEmailCheckJobData = {
        userId,
        lastCheck: new Date(),
      };

      const job = await this.periodicCheckQueue.add(
        "periodic-email-check",
        jobData,
        {
          repeat: { every: intervalMinutes * 60 * 1000 }, // Convert to milliseconds
          jobId: `periodic-check-${userId}`,
        }
      );

      logger.info("Scheduled periodic email check", {
        jobId: job.id,
        userId,
        intervalMinutes,
      });

      return job;
    } catch (error) {
      logger.error("Failed to schedule periodic email check", {
        userId,
        intervalMinutes,
        error,
      });
      throw new Error(
        `Failed to schedule periodic email check: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Cancel periodic email check for a user
   */
  async cancelPeriodicEmailCheck(userId: string): Promise<void> {
    try {
      const jobId = `periodic-check-${userId}`;
      const job = await this.periodicCheckQueue.getJob(jobId);

      if (job) {
        await job.remove();
        logger.info("Cancelled periodic email check", { userId, jobId });
      }
    } catch (error) {
      logger.error("Failed to cancel periodic email check", {
        userId,
        error,
      });
    }
  }

  /**
   * Get job statistics for monitoring
   */
  async getJobStats(): Promise<{
    emailProcessing: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    weatherUpdate: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    periodicCheck: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    try {
      const [
        emailWaiting,
        emailActive,
        emailCompleted,
        emailFailed,
        weatherWaiting,
        weatherActive,
        weatherCompleted,
        weatherFailed,
        periodicWaiting,
        periodicActive,
        periodicCompleted,
        periodicFailed,
      ] = await Promise.all([
        this.emailProcessingQueue.getWaiting(),
        this.emailProcessingQueue.getActive(),
        this.emailProcessingQueue.getCompleted(),
        this.emailProcessingQueue.getFailed(),
        this.weatherUpdateQueue.getWaiting(),
        this.weatherUpdateQueue.getActive(),
        this.weatherUpdateQueue.getCompleted(),
        this.weatherUpdateQueue.getFailed(),
        this.periodicCheckQueue.getWaiting(),
        this.periodicCheckQueue.getActive(),
        this.periodicCheckQueue.getCompleted(),
        this.periodicCheckQueue.getFailed(),
      ]);

      return {
        emailProcessing: {
          waiting: emailWaiting.length,
          active: emailActive.length,
          completed: emailCompleted.length,
          failed: emailFailed.length,
        },
        weatherUpdate: {
          waiting: weatherWaiting.length,
          active: weatherActive.length,
          completed: weatherCompleted.length,
          failed: weatherFailed.length,
        },
        periodicCheck: {
          waiting: periodicWaiting.length,
          active: periodicActive.length,
          completed: periodicCompleted.length,
          failed: periodicFailed.length,
        },
      };
    } catch (error) {
      logger.error("Failed to get job statistics", { error });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get job statistics: ${errorMessage}`);
    }
  }

  /**
   * Retry failed job
   */
  async retryFailedJob(queueName: string, jobId: string): Promise<void> {
    try {
      let queue: Queue;

      switch (queueName) {
        case "email-processing":
          queue = this.emailProcessingQueue;
          break;
        case "weather-update":
          queue = this.weatherUpdateQueue;
          break;
        case "periodic-email-check":
          queue = this.periodicCheckQueue;
          break;
        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
      }

      await job.retry();

      logger.info("Retried failed job", { queueName, jobId });
    } catch (error) {
      logger.error("Failed to retry job", { queueName, jobId, error });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to retry job: ${errorMessage}`);
    }
  }

  /**
   * Clean up old completed and failed jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    try {
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

      await Promise.all([
        this.emailProcessingQueue.clean(cutoffTime, "completed"),
        this.emailProcessingQueue.clean(cutoffTime, "failed"),
        this.weatherUpdateQueue.clean(cutoffTime, "completed"),
        this.weatherUpdateQueue.clean(cutoffTime, "failed"),
        this.periodicCheckQueue.clean(cutoffTime, "completed"),
        this.periodicCheckQueue.clean(cutoffTime, "failed"),
      ]);

      logger.info("Cleaned up old jobs", { olderThanHours });
    } catch (error) {
      logger.error("Failed to cleanup old jobs", { error });
    }
  }

  /**
   * Gracefully shutdown job processor
   */
  async shutdown(): Promise<void> {
    try {
      logger.info("Shutting down job processor service");

      await Promise.all([
        this.emailProcessingQueue.close(),
        this.weatherUpdateQueue.close(),
        this.periodicCheckQueue.close(),
      ]);

      logger.info("Job processor service shutdown complete");
    } catch (error) {
      logger.error("Error during job processor shutdown", { error });
    }
  }

  /**
   * Set up job processors for each queue
   */
  private setupJobProcessors(options: JobProcessorOptions): void {
    // Email processing job processor
    this.emailProcessingQueue.process(
      "process-email",
      options.concurrency!,
      this.processEmailJob.bind(this)
    );

    // Weather update job processor
    this.weatherUpdateQueue.process(
      "update-weather",
      options.concurrency!,
      this.processWeatherJob.bind(this)
    );

    // Periodic email check processor
    this.periodicCheckQueue.process(
      "periodic-email-check",
      1, // Single concurrency for periodic checks
      this.processPeriodicEmailCheck.bind(this)
    );
  }

  /**
   * Process email job
   */
  private async processEmailJob(
    job: Job<EmailProcessingJobData>
  ): Promise<void> {
    const { userId, messageId, retryCount = 0, maxRetries = 3 } = job.data;

    try {
      logger.info("Processing email job", {
        jobId: job.id,
        userId,
        messageId,
        retryCount,
      });

      // Update job progress
      await job.progress(10);

      if (messageId) {
        // Process specific email
        await this.gmailService.processSpecificEmail(userId, messageId);
      } else {
        // Monitor all emails for user
        await this.gmailService.monitorEmails(userId);
      }

      await job.progress(50);

      // Get processed emails that need PDF parsing
      const pendingEmails =
        await this.processedEmailRepository.findPendingEmails(userId);

      for (const email of pendingEmails) {
        try {
          await this.processPendingEmail(email.id);
          await job.progress(50 + 50 / pendingEmails.length);
        } catch (error) {
          logger.error("Failed to process pending email", {
            emailId: email.id,
            error,
          });

          await this.processedEmailRepository.markAsFailed(
            email.id,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      await job.progress(100);

      logger.info("Email job completed successfully", {
        jobId: job.id,
        userId,
        messageId,
        processedEmails: pendingEmails.length,
      });
    } catch (error) {
      logger.error("Email job failed", {
        jobId: job.id,
        userId,
        messageId,
        retryCount,
        error,
      });

      // Increment retry count
      job.data.retryCount = retryCount + 1;

      // If we haven't exceeded max retries, the job will be retried automatically
      if (retryCount >= maxRetries) {
        logger.error("Email job exceeded max retries", {
          jobId: job.id,
          userId,
          messageId,
          maxRetries,
        });
      }

      throw error;
    }
  }

  /**
   * Process weather update job
   */
  private async processWeatherJob(
    job: Job<WeatherUpdateJobData>
  ): Promise<void> {
    const { scheduleId, retryCount = 0 } = job.data;

    try {
      logger.info("Processing weather update job", {
        jobId: job.id,
        scheduleId,
        retryCount,
      });

      await job.progress(10);

      // Get schedule data
      const schedule = await this.scheduleDataRepository.findById(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }

      await job.progress(50);

      // TODO: Implement weather service integration
      // This will be implemented in a later task
      logger.info(
        "Weather update job placeholder - will be implemented with weather service"
      );

      await job.progress(100);

      logger.info("Weather update job completed", {
        jobId: job.id,
        scheduleId,
      });
    } catch (error) {
      logger.error("Weather update job failed", {
        jobId: job.id,
        scheduleId,
        retryCount,
        error,
      });

      job.data.retryCount = retryCount + 1;
      throw error;
    }
  }

  /**
   * Process periodic email check job
   */
  private async processPeriodicEmailCheck(
    job: Job<PeriodicEmailCheckJobData>
  ): Promise<void> {
    const { userId, lastCheck } = job.data;

    try {
      logger.info("Processing periodic email check", {
        jobId: job.id,
        userId,
        lastCheck,
      });

      await job.progress(25);

      // Check OAuth status
      const oauthStatus = await this.oauth2Service.getOAuthStatus(userId);
      if (!oauthStatus.isAuthenticated) {
        logger.warn("User not authenticated, skipping periodic check", {
          userId,
        });
        return;
      }

      await job.progress(50);

      // Monitor emails
      await this.gmailService.monitorEmails(userId);

      await job.progress(75);

      // Update last check time
      job.data.lastCheck = new Date();

      await job.progress(100);

      logger.info("Periodic email check completed", {
        jobId: job.id,
        userId,
      });
    } catch (error) {
      logger.error("Periodic email check failed", {
        jobId: job.id,
        userId,
        error,
      });

      // Don't throw error for periodic jobs - just log and continue
      // The job will retry automatically based on the schedule
    }
  }

  /**
   * Process pending email with PDF parsing
   */
  private async processPendingEmail(emailId: string): Promise<void> {
    try {
      const email = await this.processedEmailRepository.findWithSchedule(
        emailId
      );
      if (!email) {
        throw new Error(`Email ${emailId} not found`);
      }

      // Get email attachments
      const attachments = await this.gmailService.getEmailAttachments(
        email.userId,
        {
          id: email.messageId,
          threadId: email.threadId || "",
          labelIds: [],
          snippet: "",
          payload: {},
          internalDate: email.receivedAt.getTime().toString(),
          historyId: "",
          sizeEstimate: 0,
        }
      );

      if (attachments.length === 0) {
        throw new Error("No PDF attachments found");
      }

      // Parse PDF
      const pdfData = attachments[0].data;
      if (!pdfData) {
        throw new Error("PDF data not available");
      }

      const parsedData = await this.pdfParserService.parsePDFAttachment(
        pdfData,
        attachments[0].filename
      );

      // Validate parsed data
      const validation =
        this.pdfParserService.validateExtractedData(parsedData);

      if (!validation.isValid) {
        logger.warn("PDF parsing validation failed", {
          emailId,
          errors: validation.errors,
          confidence: parsedData.confidence,
        });

        // Mark as failed with validation errors
        await this.processedEmailRepository.markAsFailed(
          emailId,
          `Validation failed: ${validation.errors.join(", ")}`
        );
        return;
      }

      // Create schedule data record
      const scheduleData = await this.scheduleDataRepository.create({
        shootingDate: parsedData.shootingDate!,
        callTime: parsedData.callTime!,
        location: parsedData.location!,
        baseLocation: parsedData.baseLocation,
        sceneType: parsedData.sceneType || "INT",
        scenes: parsedData.scenes || [],
        safetyNotes: parsedData.safetyNotes,
        equipment: parsedData.equipment || [],
        contacts: (parsedData.contacts as any) || [],
        notes: parsedData.notes,
        user: {
          connect: { id: email.userId },
        },
        email: {
          connect: { id: emailId },
        },
      });

      // Mark email as processed
      await this.processedEmailRepository.markAsProcessed(emailId);

      logger.info("Successfully processed pending email", {
        emailId,
        scheduleId: scheduleData.id,
        confidence: parsedData.confidence,
      });
    } catch (error) {
      logger.error("Failed to process pending email", { emailId, error });
      throw error;
    }
  }

  /**
   * Set up event listeners for job queues
   */
  private setupEventListeners(): void {
    // Email processing queue events
    this.emailProcessingQueue.on("completed", (job, result) => {
      logger.info("Email processing job completed", {
        jobId: job.id,
        userId: job.data.userId,
        messageId: job.data.messageId,
      });
    });

    this.emailProcessingQueue.on("failed", (job, err) => {
      logger.error("Email processing job failed", {
        jobId: job.id,
        userId: job.data.userId,
        messageId: job.data.messageId,
        error: err.message,
      });
    });

    this.emailProcessingQueue.on("stalled", (job) => {
      logger.warn("Email processing job stalled", {
        jobId: job.id,
        userId: job.data.userId,
      });
    });

    // Weather update queue events
    this.weatherUpdateQueue.on("completed", (job, result) => {
      logger.info("Weather update job completed", {
        jobId: job.id,
        scheduleId: job.data.scheduleId,
      });
    });

    this.weatherUpdateQueue.on("failed", (job, err) => {
      logger.error("Weather update job failed", {
        jobId: job.id,
        scheduleId: job.data.scheduleId,
        error: err.message,
      });
    });

    // Periodic check queue events
    this.periodicCheckQueue.on("completed", (job, result) => {
      logger.debug("Periodic email check completed", {
        jobId: job.id,
        userId: job.data.userId,
      });
    });

    this.periodicCheckQueue.on("failed", (job, err) => {
      logger.warn("Periodic email check failed", {
        jobId: job.id,
        userId: job.data.userId,
        error: err.message,
      });
    });
  }
}
