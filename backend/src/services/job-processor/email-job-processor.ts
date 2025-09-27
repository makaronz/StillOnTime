import Bull, { Job, Queue } from "bull";
import { BaseJobProcessor, JobProcessorOptions } from "./base-job-processor";
import { GmailService } from "../gmail.service";
import { PDFParserService } from "../pdf-parser.service";
import { OAuth2Service } from "../oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { EmailProcessingData } from "@/types";
import { logger } from "@/utils/logger";

export interface EmailProcessingJobData extends EmailProcessingData {
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Email Job Processor
 * Handles email processing and PDF parsing jobs
 */
export class EmailJobProcessor extends BaseJobProcessor {
  private emailProcessingQueue: Queue<EmailProcessingJobData>;

  constructor(
    private gmailService: GmailService,
    private pdfParserService: PDFParserService,
    private oauth2Service: OAuth2Service,
    private processedEmailRepository: ProcessedEmailRepository,
    private scheduleDataRepository: ScheduleDataRepository,
    options: JobProcessorOptions = {}
  ) {
    super(options);

    // Initialize email processing queue
    this.emailProcessingQueue =
      this.createQueue<EmailProcessingJobData>("email-processing");

    // Set up job processor
    this.setupJobProcessor();

    // Set up event listeners
    this.setupQueueEventListeners(
      this.emailProcessingQueue,
      "email-processing"
    );

    logger.info("Email job processor initialized", {
      concurrency: this.options.concurrency,
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
   * Get email processing job statistics
   */
  async getJobStats() {
    return await this.getQueueStats(this.emailProcessingQueue);
  }

  /**
   * Retry failed email processing job
   */
  async retryFailedJob(queue: Queue, jobId: string): Promise<void> {
    return await super.retryFailedJob(queue, jobId);
  }

  /**
   * Retry failed email processing job (convenience method)
   */
  async retryFailedEmailJob(jobId: string): Promise<void> {
    return await this.retryFailedJob(this.emailProcessingQueue, jobId);
  }

  /**
   * Clean up old email processing jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    return await this.cleanupQueue(this.emailProcessingQueue, olderThanHours);
  }

  /**
   * Shutdown email job processor
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down email job processor");
    await this.closeQueue(this.emailProcessingQueue);
  }

  /**
   * Set up job processor for email processing queue
   */
  private setupJobProcessor(): void {
    this.emailProcessingQueue.process(
      "process-email",
      this.options.concurrency!,
      this.processEmailJob.bind(this)
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
        contacts: parsedData.contacts || [],
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
}
