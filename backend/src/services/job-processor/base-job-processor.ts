import Bull, { Queue, JobOptions } from "bull";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";

export interface JobProcessorOptions {
  concurrency?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  defaultJobOptions?: JobOptions;
}

/**
 * Base Job Processor
 * Provides common functionality for all job processors
 */
export abstract class BaseJobProcessor {
  protected readonly DEFAULT_OPTIONS: JobProcessorOptions = {
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

  protected options: JobProcessorOptions;

  constructor(options: JobProcessorOptions = {}) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Create a Bull queue with standard configuration
   */
  protected createQueue<T = any>(queueName: string): Queue<T> {
    return new Bull<T>(queueName, {
      redis: config.redisUrl,
      defaultJobOptions: this.options.defaultJobOptions,
    });
  }

  /**
   * Set up event listeners for a queue
   */
  protected setupQueueEventListeners<T>(
    queue: Queue<T>,
    queueName: string
  ): void {
    queue.on("completed", (job, result) => {
      logger.info(`${queueName} job completed`, {
        jobId: job.id,
        jobData: job.data,
      });
    });

    queue.on("failed", (job, err) => {
      logger.error(`${queueName} job failed`, {
        jobId: job.id,
        jobData: job.data,
        error: err.message,
      });
    });

    queue.on("stalled", (job) => {
      logger.warn(`${queueName} job stalled`, {
        jobId: job.id,
        jobData: job.data,
      });
    });
  }

  /**
   * Clean up old completed and failed jobs
   */
  protected async cleanupQueue(
    queue: Queue,
    olderThanHours: number = 24
  ): Promise<void> {
    try {
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

      await Promise.all([
        queue.clean(cutoffTime, "completed"),
        queue.clean(cutoffTime, "failed"),
      ]);

      logger.debug("Cleaned up old jobs", {
        queueName: queue.name,
        olderThanHours,
      });
    } catch (error) {
      logger.error("Failed to cleanup old jobs", {
        queueName: queue.name,
        error,
      });
    }
  }

  /**
   * Get job statistics for a queue
   */
  protected async getQueueStats(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * Retry a failed job
   */
  protected async retryFailedJob(queue: Queue, jobId: string): Promise<void> {
    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queue.name}`);
      }

      await job.retry();

      logger.info("Retried failed job", {
        queueName: queue.name,
        jobId,
      });
    } catch (error) {
      logger.error("Failed to retry job", {
        queueName: queue.name,
        jobId,
        error,
      });
      throw error;
    }
  }

  /**
   * Close the queue gracefully
   */
  protected async closeQueue(queue: Queue): Promise<void> {
    try {
      await queue.close();
      logger.info("Queue closed successfully", { queueName: queue.name });
    } catch (error) {
      logger.error("Error closing queue", {
        queueName: queue.name,
        error,
      });
    }
  }
}
