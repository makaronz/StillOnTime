/**
 * Job Processor Services Index
 * Exports all job processor components and creates a composed service
 */

export * from "./base-job-processor";
export * from "./email-job-processor";
export * from "./weather-job-processor";
export * from "./periodic-job-processor";

import { EmailJobProcessor } from "./email-job-processor";
import { WeatherJobProcessor } from "./weather-job-processor";
import { PeriodicJobProcessor } from "./periodic-job-processor";
import { JobProcessorOptions } from "./base-job-processor";
import { GmailService } from "../gmail.service";
import { PDFParserService } from "../pdf-parser.service";
import { OAuth2Service } from "../oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { logger } from "@/utils/logger";

/**
 * Composed Job Processor Service
 * Combines all job processing functionality using service composition pattern
 */
export class JobProcessorService {
  private emailProcessor: EmailJobProcessor;
  private weatherProcessor: WeatherJobProcessor;
  private periodicProcessor: PeriodicJobProcessor;

  constructor(
    gmailService: GmailService,
    pdfParserService: PDFParserService,
    oauth2Service: OAuth2Service,
    processedEmailRepository: ProcessedEmailRepository,
    scheduleDataRepository: ScheduleDataRepository,
    options: JobProcessorOptions = {}
  ) {
    // Initialize individual processors
    this.emailProcessor = new EmailJobProcessor(
      gmailService,
      pdfParserService,
      oauth2Service,
      processedEmailRepository,
      scheduleDataRepository,
      options
    );

    this.weatherProcessor = new WeatherJobProcessor(
      scheduleDataRepository,
      options
    );

    this.periodicProcessor = new PeriodicJobProcessor(
      oauth2Service,
      gmailService,
      options
    );

    logger.info("Composed job processor service initialized");
  }

  // Email processing methods
  async addEmailProcessingJob(
    userId: string,
    messageId?: string,
    priority: number = 0
  ) {
    return await this.emailProcessor.addEmailProcessingJob(
      userId,
      messageId,
      priority
    );
  }

  // Weather and route processing methods
  async addRouteRecalculationJob(scheduleId: string, priority: number = 0) {
    return await this.weatherProcessor.addRouteRecalculationJob(
      scheduleId,
      priority
    );
  }

  async addWeatherUpdateJob(scheduleId: string, priority: number = 0) {
    return await this.weatherProcessor.addWeatherUpdateJob(
      scheduleId,
      priority
    );
  }

  // Periodic processing methods
  async schedulePeriodicEmailCheck(
    userId: string,
    intervalMinutes: number = 5
  ) {
    return await this.periodicProcessor.schedulePeriodicEmailCheck(
      userId,
      intervalMinutes
    );
  }

  async cancelPeriodicEmailCheck(userId: string) {
    return await this.periodicProcessor.cancelPeriodicEmailCheck(userId);
  }

  // Statistics and monitoring methods
  async getJobStats() {
    const [emailStats, weatherStats, periodicStats] = await Promise.all([
      this.emailProcessor.getJobStats(),
      this.weatherProcessor.getJobStats(),
      this.periodicProcessor.getJobStats(),
    ]);

    return {
      emailProcessing: emailStats,
      weatherUpdate: weatherStats,
      periodicCheck: periodicStats,
    };
  }

  // Job management methods
  async retryFailedJob(queueName: string, jobId: string): Promise<void> {
    switch (queueName) {
      case "email-processing":
        return await this.emailProcessor.retryFailedJob(jobId);
      case "weather-update":
        return await this.weatherProcessor.retryFailedJob(jobId);
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  // Cleanup methods
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    await Promise.all([
      this.emailProcessor.cleanupOldJobs(olderThanHours),
      this.weatherProcessor.cleanupOldJobs(olderThanHours),
      this.periodicProcessor.cleanupOldJobs(olderThanHours),
    ]);

    logger.info("Cleaned up old jobs across all processors", {
      olderThanHours,
    });
  }

  // Shutdown methods
  async shutdown(): Promise<void> {
    logger.info("Shutting down composed job processor service");

    await Promise.all([
      this.emailProcessor.shutdown(),
      this.weatherProcessor.shutdown(),
      this.periodicProcessor.shutdown(),
    ]);

    logger.info("Composed job processor service shutdown complete");
  }
}
