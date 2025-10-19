import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { logger } from "@/utils/logger";
import { db } from "@/config/database";
import { cacheService } from "@/services/cache.service";
import { performanceMonitoringService } from "./performance-monitoring.service";
import path from "path";
import os from "os";

/**
 * Email processing job interface
 */
export interface EmailProcessingJob {
  id: string;
  messageId: string;
  userId: string;
  subject: string;
  sender: string;
  receivedAt: Date;
  threadId?: string;
  pdfHash?: string;
  priority: "low" | "medium" | "high";
  retryCount: number;
  maxRetries: number;
}

/**
 * Worker pool configuration
 */
interface WorkerPoolConfig {
  maxWorkers: number;
  minWorkers: number;
  workerTimeout: number;
  maxQueueSize: number;
  retryDelay: number;
}

/**
 * Processing statistics
 */
interface ProcessingStats {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  averageProcessingTime: number;
  workersActive: number;
  queueSize: number;
  processingRate: number; // emails per minute
}

/**
 * Parallel Email Processing Service
 * Uses worker threads for parallel email processing with load balancing
 */
export class ParallelEmailProcessorService {
  private static instance: ParallelEmailProcessorService;
  private workers: Worker[] = [];
  private jobQueue: EmailProcessingJob[] = [];
  private processingJobs = new Map<string, EmailProcessingJob>();
  private workerStats = new Map<number, any>();
  private isShuttingDown = false;

  private config: WorkerPoolConfig = {
    maxWorkers: Math.min(os.cpus().length, 8), // Max 8 workers
    minWorkers: 2,
    workerTimeout: 300000, // 5 minutes
    maxQueueSize: 1000,
    retryDelay: 5000, // 5 seconds
  };

  private stats: ProcessingStats = {
    totalProcessed: 0,
    successfulProcessed: 0,
    failedProcessed: 0,
    averageProcessingTime: 0,
    workersActive: 0,
    queueSize: 0,
    processingRate: 0,
  };

  private lastStatsUpdate = Date.now();
  private recentProcessingTimes: number[] = [];

  private constructor() {
    this.initializeWorkerPool();
    this.startStatsCollection();
    this.setupGracefulShutdown();
  }

  static getInstance(): ParallelEmailProcessorService {
    if (!ParallelEmailProcessorService.instance) {
      ParallelEmailProcessorService.instance = new ParallelEmailProcessorService();
    }
    return ParallelEmailProcessorService.instance;
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkerPool(): void {
    logger.info("Initializing email processor worker pool", {
      maxWorkers: this.config.maxWorkers,
      minWorkers: this.config.minWorkers,
    });

    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Create a new worker
   */
  private createWorker(): void {
    if (this.workers.length >= this.config.maxWorkers) {
      logger.warn("Maximum worker count reached");
      return;
    }

    const worker = new Worker(path.resolve(__dirname, "email-worker.js"));
    const workerId = this.workers.length;

    worker.on("message", (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on("error", (error) => {
      logger.error("Worker error", { workerId, error });
      this.handleWorkerError(workerId, error);
    });

    worker.on("exit", (code) => {
      logger.info("Worker exited", { workerId, code });
      this.handleWorkerExit(workerId, code);
    });

    this.workers.push(worker);
    this.workerStats.set(workerId, {
      busy: false,
      jobId: null,
      startTime: null,
      processedJobs: 0,
      errors: 0,
    });

    logger.debug("Worker created", { workerId, totalWorkers: this.workers.length });
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: number, message: any): void {
    const stats = this.workerStats.get(workerId);
    if (!stats) return;

    const { type, data } = message;

    switch (type) {
      case "job_complete":
        this.handleJobComplete(workerId, data);
        break;

      case "job_error":
        this.handleJobError(workerId, data);
        break;

      case "job_progress":
        this.handleJobProgress(workerId, data);
        break;

      case "worker_ready":
        stats.busy = false;
        this.assignNextJob(workerId);
        break;

      default:
        logger.warn("Unknown worker message type", { type, workerId });
    }
  }

  /**
   * Handle job completion
   */
  private async handleJobComplete(workerId: number, data: any): Promise<void> {
    const { jobId, result, processingTime } = data;
    const stats = this.workerStats.get(workerId);

    if (stats) {
      stats.busy = false;
      stats.processedJobs++;
      stats.jobId = null;
      stats.startTime = null;
    }

    const job = this.processingJobs.get(jobId);
    if (job) {
      this.processingJobs.delete(jobId);

      // Update statistics
      this.stats.totalProcessed++;
      this.stats.successfulProcessed++;
      this.recentProcessingTimes.push(processingTime);
      if (this.recentProcessingTimes.length > 100) {
        this.recentProcessingTimes.shift();
      }

      // Update database
      await this.updateEmailStatus(job.id, "completed", result);

      // Invalidate relevant caches
      await this.invalidateEmailCache(job.userId);

      logger.info("Email processing job completed", {
        jobId,
        messageId: job.messageId,
        processingTime,
        workerId,
      });

      // Record performance metrics
      performanceMonitoringService.recordDatabaseQuery(
        `UPDATE processed_emails SET status = 'completed' WHERE id = ${job.id}`,
        processingTime,
        true
      );
    }

    // Assign next job
    this.assignNextJob(workerId);
  }

  /**
   * Handle job error
   */
  private async handleJobError(workerId: number, data: any): Promise<void> {
    const { jobId, error, processingTime } = data;
    const stats = this.workerStats.get(workerId);

    if (stats) {
      stats.busy = false;
      stats.errors++;
      stats.jobId = null;
      stats.startTime = null;
    }

    const job = this.processingJobs.get(jobId);
    if (job) {
      this.processingJobs.delete(jobId);

      // Update statistics
      this.stats.totalProcessed++;
      this.stats.failedProcessed++;

      // Handle retry logic
      if (job.retryCount < job.maxRetries) {
        const retryJob = {
          ...job,
          retryCount: job.retryCount + 1,
          priority: "low" as const, // Lower priority for retries
        };

        logger.warn("Retrying email processing job", {
          jobId,
          retryCount: retryJob.retryCount,
          error: error.message,
        });

        // Add delay before retry
        setTimeout(() => {
          this.addJobToQueue(retryJob);
        }, this.config.retryDelay * Math.pow(2, retryJob.retryCount)); // Exponential backoff
      } else {
        // Max retries exceeded, mark as failed
        await this.updateEmailStatus(job.id, "failed", { error: error.message });

        logger.error("Email processing job failed permanently", {
          jobId,
          messageId: job.messageId,
          retryCount: job.retryCount,
          error: error.message,
        });
      }

      // Record performance metrics
      performanceMonitoringService.recordDatabaseQuery(
        `UPDATE processed_emails SET status = 'failed' WHERE id = ${job.id}`,
        processingTime,
        false
      );
    }

    // Assign next job
    this.assignNextJob(workerId);
  }

  /**
   * Handle job progress update
   */
  private handleJobProgress(workerId: number, data: any): void {
    const { jobId, progress, message } = data;

    logger.debug("Job progress update", {
      jobId,
      workerId,
      progress,
      message,
    });

    // Could emit real-time progress updates via WebSocket here
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: number, error: Error): void {
    const stats = this.workerStats.get(workerId);
    if (stats && stats.jobId) {
      // Re-queue the job if worker fails
      const job = this.processingJobs.get(stats.jobId);
      if (job) {
        this.processingJobs.delete(stats.jobId);
        this.addJobToQueue(job);
      }
    }

    logger.error("Worker encountered error", { workerId, error });
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: number, code: number): void {
    // Remove worker from pool
    this.workers = this.workers.filter(w => w.threadId !== workerId);
    this.workerStats.delete(workerId);

    // Re-queue any in-progress jobs
    const stats = this.workerStats.get(workerId);
    if (stats && stats.jobId) {
      const job = this.processingJobs.get(stats.jobId);
      if (job) {
        this.processingJobs.delete(stats.jobId);
        this.addJobToQueue(job);
      }
    }

    // Create replacement worker if not shutting down
    if (!this.isShuttingDown) {
      logger.info("Creating replacement worker", { exitedWorkerId: workerId });
      setTimeout(() => this.createWorker(), 1000);
    }
  }

  /**
   * Assign next job to worker
   */
  private assignNextJob(workerId: number): void {
    if (this.jobQueue.length === 0) {
      return; // No jobs in queue
    }

    const stats = this.workerStats.get(workerId);
    if (!stats || stats.busy) {
      return; // Worker not available
    }

    // Get next job from queue (highest priority first)
    const jobIndex = this.jobQueue.findIndex(job => job.priority === "high") ||
                    this.jobQueue.findIndex(job => job.priority === "medium") ||
                    0;

    const job = this.jobQueue.splice(jobIndex, 1)[0];
    if (!job) return;

    // Assign job to worker
    stats.busy = true;
    stats.jobId = job.id;
    stats.startTime = Date.now();
    this.processingJobs.set(job.id, job);

    // Send job to worker
    this.workers[workerId].postMessage({
      type: "process_email",
      data: job,
    });

    logger.debug("Job assigned to worker", {
      jobId: job.id,
      workerId,
      queueSize: this.jobQueue.length,
    });
  }

  /**
   * Add job to queue
   */
  private addJobToQueue(job: EmailProcessingJob): void {
    if (this.jobQueue.length >= this.config.maxQueueSize) {
      logger.warn("Job queue is full, dropping low priority jobs");
      // Drop low priority jobs first
      const lowPriorityIndex = this.jobQueue.findIndex(j => j.priority === "low");
      if (lowPriorityIndex !== -1) {
        this.jobQueue.splice(lowPriorityIndex, 1);
      } else {
        return; // Queue full and no low priority jobs to drop
      }
    }

    // Insert job based on priority
    let insertIndex = this.jobQueue.length;
    if (job.priority === "high") {
      insertIndex = this.jobQueue.findIndex(j => j.priority !== "high");
      if (insertIndex === -1) insertIndex = this.jobQueue.length;
    } else if (job.priority === "medium") {
      const highPriorityCount = this.jobQueue.filter(j => j.priority === "high").length;
      insertIndex = highPriorityCount;
    }

    this.jobQueue.splice(insertIndex, 0, job);

    // Try to assign to available worker
    this.assignJobsToAvailableWorkers();
  }

  /**
   * Assign jobs to available workers
   */
  private assignJobsToAvailableWorkers(): void {
    for (let i = 0; i < this.workers.length; i++) {
      const stats = this.workerStats.get(i);
      if (stats && !stats.busy) {
        this.assignNextJob(i);
      }
    }
  }

  /**
   * Update email status in database
   */
  private async updateEmailStatus(emailId: string, status: string, result?: any): Promise<void> {
    try {
      await db
        .updateTable("processed_emails")
        .set({
          processingStatus: status,
          processed: status === "completed",
          updatedAt: new Date(),
          ...(result && { result: JSON.stringify(result) }),
        })
        .where("id", "=", emailId)
        .execute();

      performanceMonitoringService.recordDatabaseQuery(
        `UPDATE processed_emails SET status = '${status}' WHERE id = ${emailId}`,
        10, // Estimated time
        true
      );
    } catch (error) {
      logger.error("Failed to update email status", { emailId, status, error });
    }
  }

  /**
   * Invalidate email-related caches
   */
  private async invalidateEmailCache(userId: string): Promise<void> {
    try {
      await cacheService.clearPrefix(`user:${userId}:emails`);
      await cacheService.clearPrefix(`dashboard:${userId}`);
    } catch (error) {
      logger.error("Failed to invalidate email cache", { userId, error });
    }
  }

  /**
   * Process email from external trigger
   */
  async processEmail(emailData: Partial<EmailProcessingJob>): Promise<void> {
    const job: EmailProcessingJob = {
      id: emailData.id || this.generateJobId(),
      messageId: emailData.messageId || "",
      userId: emailData.userId || "",
      subject: emailData.subject || "",
      sender: emailData.sender || "",
      receivedAt: emailData.receivedAt || new Date(),
      threadId: emailData.threadId,
      pdfHash: emailData.pdfHash,
      priority: this.determinePriority(emailData),
      retryCount: 0,
      maxRetries: 3,
    };

    this.addJobToQueue(job);
    logger.info("Email queued for processing", {
      jobId: job.id,
      messageId: job.messageId,
      priority: job.priority,
      queueSize: this.jobQueue.length,
    });
  }

  /**
   * Process multiple emails in batch
   */
  async processEmailBatch(emails: Partial<EmailProcessingJob>[]): Promise<void> {
    const jobs = emails.map(emailData => ({
      id: emailData.id || this.generateJobId(),
      messageId: emailData.messageId || "",
      userId: emailData.userId || "",
      subject: emailData.subject || "",
      sender: emailData.sender || "",
      receivedAt: emailData.receivedAt || new Date(),
      threadId: emailData.threadId,
      pdfHash: emailData.pdfHash,
      priority: this.determinePriority(emailData),
      retryCount: 0,
      maxRetries: 3,
    }));

    // Add all jobs to queue
    jobs.forEach(job => this.addJobToQueue(job));

    logger.info("Email batch queued for processing", {
      batchSize: jobs.length,
      queueSize: this.jobQueue.length,
    });
  }

  /**
   * Determine email processing priority
   */
  private determinePriority(emailData: Partial<EmailProcessingJob>): "low" | "medium" | "high" {
    // High priority for recent emails from known senders
    const isRecent = emailData.receivedAt &&
                    (Date.now() - emailData.receivedAt.getTime()) < 3600000; // 1 hour
    const isKnownSender = emailData.sender &&
                         (emailData.sender.includes("panavision") ||
                          emailData.sender.includes("production"));

    if (isRecent && isKnownSender) {
      return "high";
    }

    // Medium priority for emails with attachments
    if (emailData.pdfHash) {
      return "medium";
    }

    return "low";
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    const now = Date.now();
    const timeDiff = (now - this.lastStatsUpdate) / 60000; // minutes

    // Update processing rate
    if (timeDiff > 0) {
      this.stats.processingRate = (this.stats.totalProcessed / timeDiff);
    }

    // Update average processing time
    if (this.recentProcessingTimes.length > 0) {
      this.stats.averageProcessingTime =
        this.recentProcessingTimes.reduce((sum, time) => sum + time, 0) /
        this.recentProcessingTimes.length;
    }

    // Update current queue and worker stats
    this.stats.queueSize = this.jobQueue.length;
    this.stats.workersActive = Array.from(this.workerStats.values()).filter(s => s.busy).length;

    return { ...this.stats };
  }

  /**
   * Get detailed worker statistics
   */
  getWorkerStats(): any[] {
    return Array.from(this.workerStats.entries()).map(([workerId, stats]) => ({
      workerId,
      ...stats,
      uptime: stats.startTime ? Date.now() - stats.startTime : 0,
    }));
  }

  /**
   * Scale worker pool based on load
   */
  scaleWorkers(): void {
    const queueSize = this.jobQueue.length;
    const activeWorkers = this.stats.workersActive;
    const totalWorkers = this.workers.length;

    // Scale up if queue is growing and we have capacity
    if (queueSize > 10 && totalWorkers < this.config.maxWorkers && activeWorkers === totalWorkers) {
      logger.info("Scaling up worker pool", { queueSize, totalWorkers });
      this.createWorker();
    }

    // Scale down if queue is empty and we have more than minimum workers
    if (queueSize === 0 && totalWorkers > this.config.minWorkers) {
      const idleWorkerIndex = this.workers.findIndex((_, index) => {
        const stats = this.workerStats.get(index);
        return stats && !stats.busy;
      });

      if (idleWorkerIndex !== -1) {
        logger.info("Scaling down worker pool", { queueSize, totalWorkers });
        this.workers[idleWorkerIndex].terminate();
        this.workers.splice(idleWorkerIndex, 1);
        this.workerStats.delete(idleWorkerIndex);
      }
    }
  }

  /**
   * Start statistics collection
   */
  private startStatsCollection(): void {
    setInterval(() => {
      this.getStats(); // Update stats
      this.scaleWorkers(); // Check if scaling is needed
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      this.isShuttingDown = true;
      logger.info("Shutting down email processor worker pool");

      // Wait for current jobs to complete or timeout
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();

      while (this.processingJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Terminate all workers
      for (const worker of this.workers) {
        worker.terminate();
      }

      logger.info("Email processor worker pool shutdown complete");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

// Export singleton instance
export const parallelEmailProcessorService = ParallelEmailProcessorService.getInstance();