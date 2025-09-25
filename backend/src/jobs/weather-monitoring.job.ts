import { Job } from "bull";
import { WeatherMonitoringService } from "@/services/weather-monitoring.service";
import { WeatherService } from "@/services/weather.service";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { logger } from "@/utils/logger";

/**
 * Weather Monitoring Job Processor
 * Handles scheduled weather updates and monitoring tasks
 * Implements requirements 5.2, 5.3, 5.4, 5.5
 */

export interface WeatherUpdateJobData {
  type: "update_all" | "update_schedule" | "monitor_changes";
  scheduleId?: string;
  userId?: string;
}

export class WeatherMonitoringJobProcessor {
  private weatherMonitoringService: WeatherMonitoringService;

  constructor() {
    // Initialize services
    const weatherDataRepository = new WeatherDataRepository();
    const scheduleDataRepository = new ScheduleDataRepository();
    const weatherService = new WeatherService(weatherDataRepository);

    this.weatherMonitoringService = new WeatherMonitoringService(
      weatherService,
      weatherDataRepository,
      scheduleDataRepository
    );
  }

  /**
   * Process weather update jobs
   */
  async processWeatherUpdateJob(job: Job<WeatherUpdateJobData>): Promise<void> {
    const { type, scheduleId, userId } = job.data;

    logger.info("Processing weather update job", {
      jobId: job.id,
      type,
      scheduleId,
      userId,
    });

    try {
      switch (type) {
        case "update_all":
          await this.processUpdateAllWeather(job);
          break;

        case "update_schedule":
          if (!scheduleId) {
            throw new Error("Schedule ID required for update_schedule job");
          }
          await this.processUpdateScheduleWeather(job, scheduleId);
          break;

        case "monitor_changes":
          await this.processMonitorWeatherChanges(job);
          break;

        default:
          throw new Error(`Unknown weather job type: ${type}`);
      }

      logger.info("Weather update job completed successfully", {
        jobId: job.id,
        type,
      });
    } catch (error) {
      logger.error("Weather update job failed", {
        jobId: job.id,
        type,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process update all weather job
   */
  private async processUpdateAllWeather(
    job: Job<WeatherUpdateJobData>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await this.weatherMonitoringService.updateWeatherForUpcomingSchedules();

      const duration = Date.now() - startTime;
      logger.info("All weather updates completed", {
        jobId: job.id,
        duration: `${duration}ms`,
      });
    } catch (error) {
      logger.error("Failed to update all weather data", {
        jobId: job.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process update schedule weather job
   */
  private async processUpdateScheduleWeather(
    job: Job<WeatherUpdateJobData>,
    scheduleId: string
  ): Promise<void> {
    try {
      const scheduleRepository = new ScheduleDataRepository();
      const schedule = await scheduleRepository.findWithRelations(scheduleId);

      if (!schedule) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }

      const changeNotification =
        await this.weatherMonitoringService.updateWeatherForSchedule(schedule);

      if (changeNotification) {
        logger.info("Weather changes detected for schedule", {
          jobId: job.id,
          scheduleId,
          changesCount: changeNotification.significantChanges.length,
          overallRisk: changeNotification.impactAnalysis.overallRisk,
        });

        // Process the notification
        await this.weatherMonitoringService.processWeatherChangeNotifications([
          changeNotification,
        ]);
      }
    } catch (error) {
      logger.error("Failed to update schedule weather", {
        jobId: job.id,
        scheduleId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process monitor weather changes job
   */
  private async processMonitorWeatherChanges(
    job: Job<WeatherUpdateJobData>
  ): Promise<void> {
    try {
      // This would implement continuous monitoring logic
      // For now, it's the same as update_all but could be extended
      // to include more sophisticated change detection and alerting

      await this.weatherMonitoringService.updateWeatherForUpcomingSchedules();

      logger.info("Weather monitoring completed", {
        jobId: job.id,
      });
    } catch (error) {
      logger.error("Weather monitoring failed", {
        jobId: job.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get job processing statistics
   */
  async getJobStats(): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    lastProcessedAt: Date | null;
  }> {
    // This would be implemented with actual job queue statistics
    // For now, return mock data
    return {
      totalProcessed: 0,
      successRate: 100,
      averageProcessingTime: 0,
      lastProcessedAt: null,
    };
  }
}

/**
 * Job queue configuration for weather monitoring
 */
export const weatherJobConfig = {
  // Update all weather data every 6 hours
  updateAllWeather: {
    cron: "0 */6 * * *", // Every 6 hours
    jobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  },

  // Monitor weather changes every 2 hours
  monitorWeatherChanges: {
    cron: "0 */2 * * *", // Every 2 hours
    jobOptions: {
      removeOnComplete: 5,
      removeOnFail: 3,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },

  // Individual schedule updates (on-demand)
  updateScheduleWeather: {
    jobOptions: {
      removeOnComplete: 20,
      removeOnFail: 10,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
};
