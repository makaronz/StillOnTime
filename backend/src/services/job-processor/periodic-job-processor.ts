import Bull, { Job, Queue } from "bull";
import { BaseJobProcessor, JobProcessorOptions } from "./base-job-processor";
import { OAuth2Service } from "../oauth2.service";
import { GmailService } from "../gmail.service";
import { logger } from "@/utils/logger";

export interface PeriodicEmailCheckJobData {
  userId: string;
  lastCheck?: Date;
}

/**
 * Periodic Job Processor
 * Handles scheduled and recurring jobs
 */
export class PeriodicJobProcessor extends BaseJobProcessor {
  private periodicCheckQueue: Queue<PeriodicEmailCheckJobData>;

  constructor(
    private oauth2Service: OAuth2Service,
    private gmailService: GmailService,
    options: JobProcessorOptions = {}
  ) {
    super(options);

    // Initialize periodic check queue
    this.periodicCheckQueue = this.createQueue<PeriodicEmailCheckJobData>(
      "periodic-email-check"
    );

    // Set up job processor
    this.setupJobProcessor();

    // Set up event listeners
    this.setupPeriodicEventListeners();

    logger.info("Periodic job processor initialized");
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
   * Get periodic job statistics
   */
  async getJobStats() {
    return await this.getQueueStats(this.periodicCheckQueue);
  }

  /**
   * Clean up old periodic jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    return await this.cleanupQueue(this.periodicCheckQueue, olderThanHours);
  }

  /**
   * Shutdown periodic job processor
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down periodic job processor");
    await this.closeQueue(this.periodicCheckQueue);
  }

  /**
   * Set up job processor for periodic check queue
   */
  private setupJobProcessor(): void {
    this.periodicCheckQueue.process(
      "periodic-email-check",
      1, // Single concurrency for periodic checks
      this.processPeriodicEmailCheck.bind(this)
    );
  }

  /**
   * Set up event listeners specific to periodic jobs
   */
  private setupPeriodicEventListeners(): void {
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
}
