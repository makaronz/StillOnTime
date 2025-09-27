import Bull, { Job, Queue } from "bull";
import { BaseJobProcessor, JobProcessorOptions } from "./base-job-processor";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { WeatherUpdateData } from "@/types";
import { logger } from "@/utils/logger";

export interface WeatherUpdateJobData extends WeatherUpdateData {
  retryCount?: number;
}

/**
 * Weather Job Processor
 * Handles weather updates and route recalculation jobs
 */
export class WeatherJobProcessor extends BaseJobProcessor {
  private weatherUpdateQueue: Queue<WeatherUpdateJobData>;

  constructor(
    private scheduleDataRepository: ScheduleDataRepository,
    options: JobProcessorOptions = {}
  ) {
    super(options);

    // Initialize weather update queue
    this.weatherUpdateQueue =
      this.createQueue<WeatherUpdateJobData>("weather-update");

    // Set up job processors
    this.setupJobProcessors();

    // Set up event listeners
    this.setupQueueEventListeners(this.weatherUpdateQueue, "weather-update");

    logger.info("Weather job processor initialized", {
      concurrency: this.options.concurrency,
    });
  }

  /**
   * Add route recalculation job to queue
   */
  async addRouteRecalculationJob(
    scheduleId: string,
    priority: number = 0
  ): Promise<Job<WeatherUpdateJobData>> {
    try {
      const jobData: WeatherUpdateJobData = {
        scheduleId,
        retryCount: 0,
      };

      const job = await this.weatherUpdateQueue.add(
        "recalculate-route",
        jobData,
        {
          priority,
          delay: 0,
          jobId: `route-recalc-${scheduleId}`,
        }
      );

      logger.info("Added route recalculation job", {
        jobId: job.id,
        scheduleId,
        priority,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add route recalculation job", {
        scheduleId,
        error,
      });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to add route recalculation job: ${errorMessage}`);
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
   * Get weather job statistics
   */
  async getJobStats() {
    return await this.getQueueStats(this.weatherUpdateQueue);
  }

  /**
   * Retry failed weather job
   */
  async retryFailedJob(queue: Queue, jobId: string): Promise<void> {
    return await super.retryFailedJob(queue, jobId);
  }

  /**
   * Retry failed weather job (convenience method)
   */
  async retryFailedWeatherJob(jobId: string): Promise<void> {
    return await this.retryFailedJob(this.weatherUpdateQueue, jobId);
  }

  /**
   * Clean up old weather jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    return await this.cleanupQueue(this.weatherUpdateQueue, olderThanHours);
  }

  /**
   * Shutdown weather job processor
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down weather job processor");
    await this.closeQueue(this.weatherUpdateQueue);
  }

  /**
   * Set up job processors for weather queue
   */
  private setupJobProcessors(): void {
    // Weather update job processor
    this.weatherUpdateQueue.process(
      "update-weather",
      this.options.concurrency!,
      this.processWeatherJob.bind(this)
    );

    // Route recalculation job processor
    this.weatherUpdateQueue.process(
      "recalculate-route",
      this.options.concurrency!,
      this.processRouteRecalculationJob.bind(this)
    );
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
   * Process route recalculation job
   */
  private async processRouteRecalculationJob(
    job: Job<WeatherUpdateJobData>
  ): Promise<void> {
    const { scheduleId, retryCount = 0 } = job.data;

    try {
      logger.info("Processing route recalculation job", {
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

      // TODO: Implement route recalculation service integration
      // This will be implemented in a later task
      logger.info(
        "Route recalculation job placeholder - will be implemented with route service"
      );

      await job.progress(100);

      logger.info("Route recalculation job completed", {
        jobId: job.id,
        scheduleId,
      });
    } catch (error) {
      logger.error("Route recalculation job failed", {
        jobId: job.id,
        scheduleId,
        retryCount,
        error,
      });

      job.data.retryCount = retryCount + 1;
      throw error;
    }
  }
}
