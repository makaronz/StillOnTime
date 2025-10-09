import { Request, Response } from "express";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { logger } from "@/utils/logger";
import { services } from "@/services";

/**
 * Email Controller
 * Handles email processing and monitoring endpoints
 */
export class EmailController {
  private processedEmailRepository: ProcessedEmailRepository;

  constructor() {
    this.processedEmailRepository = new ProcessedEmailRepository();
  }

  /**
   * Trigger manual email processing
   * POST /api/email/process
   */
  async triggerProcessing(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { messageId, priority = 0 } = req.body;

      // Add email processing job to queue
      const job = await services.jobProcessor.addEmailProcessingJob(
        req.user.userId,
        messageId,
        priority
      );

      logger.info("Manual email processing triggered", {
        userId: req.user.userId,
        messageId,
        jobId: job.id,
        priority,
      });

      res.json({
        success: true,
        job: {
          id: job.id,
          status: "queued",
          messageId,
          priority,
        },
        message: messageId
          ? "Specific email processing queued"
          : "Email monitoring queued",
      });
    } catch (error) {
      logger.error("Failed to trigger email processing", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to trigger email processing",
        code: "EMAIL_PROCESSING_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get email processing status and history
   * GET /api/email/status
   */
  async getProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { limit = 20, status } = req.query;

      // Get email statistics
      const stats = await services.gmail.getEmailStats(req.user.userId);

      // Get job statistics
      const jobStats = await services.jobProcessor.getJobStats();

      // Get recent emails based on status filter
      let recentEmails;
      if (status === "pending") {
        const pendingEmails =
          await this.processedEmailRepository.findPendingEmails(
            req.user.userId
          );
        recentEmails = pendingEmails.map((email) => ({
          ...email,
          schedule: null,
        }));
      } else if (status === "failed") {
        const failedEmails =
          await this.processedEmailRepository.findFailedEmails(req.user.userId);
        recentEmails = failedEmails.map((email) => ({
          ...email,
          schedule: null,
        }));
      } else {
        recentEmails = await this.processedEmailRepository.findRecentEmails(
          req.user.userId,
          parseInt(limit as string)
        );
      }

      res.json({
        success: true,
        statistics: stats,
        jobQueue: jobStats.emailProcessing,
        recentEmails: recentEmails.map((email) => ({
          id: email.id,
          messageId: email.messageId,
          subject: email.subject,
          sender: email.sender,
          receivedAt: email.receivedAt,
          processed: email.processed,
          processingStatus: email.processingStatus,
          error: email.error,
          schedule: email.schedule
            ? {
                id: email.schedule.id,
                shootingDate: email.schedule.shootingDate,
                callTime: email.schedule.callTime,
                location: email.schedule.location,
                sceneType: email.schedule.sceneType,
              }
            : null,
        })),
      });
    } catch (error) {
      logger.error("Failed to get email processing status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get processing status",
        code: "STATUS_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get detailed email processing history
   * GET /api/email/history
   */
  async getProcessingHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const {
        page = 1,
        limit = 20,
        status,
        dateFrom,
        dateTo,
        search,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build filter conditions
      const whereConditions: any = {
        userId: req.user.userId,
      };

      if (status && status !== "all") {
        if (status === "processed") {
          whereConditions.processed = true;
        } else if (status === "pending") {
          whereConditions.processingStatus = "pending";
        } else if (status === "failed") {
          whereConditions.processingStatus = "failed";
        }
      }

      if (dateFrom || dateTo) {
        whereConditions.receivedAt = {};
        if (dateFrom) {
          whereConditions.receivedAt.gte = new Date(dateFrom as string);
        }
        if (dateTo) {
          whereConditions.receivedAt.lte = new Date(dateTo as string);
        }
      }

      if (search) {
        whereConditions.OR = [
          { subject: { contains: search as string, mode: "insensitive" } },
          { sender: { contains: search as string, mode: "insensitive" } },
        ];
      }

      // Get emails with pagination
      const [emails, totalCount] = await Promise.all([
        this.processedEmailRepository.findManyWithSchedule({
          where: whereConditions,
          orderBy: { receivedAt: "desc" },
          skip: offset,
          take: limitNum,
        }),
        this.processedEmailRepository.count({ where: whereConditions }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.json({
        success: true,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        emails: emails.map((email) => ({
          id: email.id,
          messageId: email.messageId,
          subject: email.subject,
          sender: email.sender,
          receivedAt: email.receivedAt,
          processed: email.processed,
          processingStatus: email.processingStatus,
          error: email.error,
          pdfHash: email.pdfHash,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
          schedule: email.schedule
            ? {
                id: email.schedule.id,
                shootingDate: email.schedule.shootingDate,
                callTime: email.schedule.callTime,
                location: email.schedule.location,
                sceneType: email.schedule.sceneType,
                scenes: email.schedule.scenes,
                safetyNotes: email.schedule.safetyNotes,
                hasRoutePlan: !!(email.schedule as any)?.routePlan,
                hasWeatherData: !!(email.schedule as any)?.weatherData,
                hasCalendarEvent: !!(email.schedule as any)?.calendarEvent,
              }
            : null,
        })),
      });
    } catch (error) {
      logger.error("Failed to get email processing history", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get processing history",
        code: "HISTORY_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Retry failed email processing
   * POST /api/email/:emailId/retry
   */
  async retryProcessing(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { emailId } = req.body;

      // Get email to verify ownership
      const email = await this.processedEmailRepository.findById(emailId);

      if (!email) {
        res.status(404).json({
          error: "Not Found",
          message: "Email not found",
          code: "EMAIL_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (email.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this email",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Reset email status to pending
      await this.processedEmailRepository.retryProcessing(emailId);

      // Add processing job to queue
      const job = await services.jobProcessor.addEmailProcessingJob(
        req.user.userId,
        email.messageId,
        1 // Higher priority for retries
      );

      logger.info("Email processing retry triggered", {
        userId: req.user.userId,
        emailId,
        messageId: email.messageId,
        jobId: job.id,
      });

      res.json({
        success: true,
        job: {
          id: job.id,
          status: "queued",
          messageId: email.messageId,
          priority: 1,
        },
        message: "Email processing retry queued",
      });
    } catch (error) {
      logger.error("Failed to retry email processing", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
        emailId: req.params.emailId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retry email processing",
        code: "RETRY_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get processing statistics
   * GET /api/email/statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { period = "30d" } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get overall statistics
      const overallStats =
        await this.processedEmailRepository.getProcessingStats(req.user.userId);

      // Get period-specific statistics
      const periodStats = await this.processedEmailRepository.findMany({
        where: {
          userId: req.user.userId,
          receivedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          processed: true,
          processingStatus: true,
          receivedAt: true,
        },
      });

      // Calculate success rate
      const totalInPeriod = periodStats.length;
      const successfulInPeriod = periodStats.filter(
        (email) => email.processed
      ).length;
      const successRate =
        totalInPeriod > 0 ? (successfulInPeriod / totalInPeriod) * 100 : 0;

      // Group by day for chart data
      const dailyStats = new Map<
        string,
        { total: number; successful: number }
      >();

      periodStats.forEach((email) => {
        const dateKey = email.receivedAt.toISOString().split("T")[0];
        const existing = dailyStats.get(dateKey) || { total: 0, successful: 0 };

        existing.total++;
        if (email.processed) {
          existing.successful++;
        }

        dailyStats.set(dateKey, existing);
      });

      const chartData = Array.from(dailyStats.entries())
        .map(([date, stats]) => ({
          date,
          total: stats.total,
          successful: stats.successful,
          successRate:
            stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        success: true,
        period,
        overall: overallStats,
        periodStats: {
          total: totalInPeriod,
          successful: successfulInPeriod,
          failed: totalInPeriod - successfulInPeriod,
          successRate: Math.round(successRate * 100) / 100,
        },
        chartData,
      });
    } catch (error) {
      logger.error("Failed to get email statistics", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get statistics",
        code: "STATISTICS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get email processing stats for dashboard
   * GET /api/emails/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const stats = await this.processedEmailRepository.getProcessingStats(
        req.user.userId
      );

      const lastProcessedEmail = await this.processedEmailRepository.findMany({
        where: { userId: req.user.userId, processed: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      });

      const pendingCount = await this.processedEmailRepository.count({
        where: {
          userId: req.user.userId,
          processingStatus: "pending",
        },
      });

      const successRate = stats.total > 0
        ? ((stats.processed / stats.total) * 100)
        : 0;

      res.json({
        success: true,
        data: {
          totalProcessed: stats.processed,
          successRate: successRate,
          lastProcessed:
            lastProcessedEmail.length > 0
              ? lastProcessedEmail[0].updatedAt.toISOString()
              : null,
          pendingCount,
        },
        message: "Stats retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get email stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve email statistics",
        code: "STATS_RETRIEVAL_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get recent processed emails for dashboard
   * GET /api/emails/recent?limit=10
   */
  async getRecent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

      const emails = await this.processedEmailRepository.findRecentEmails(
        req.user.userId,
        limit
      );

      res.json({
        success: true,
        data: emails.map((email) => ({
          id: email.id,
          messageId: email.messageId,
          subject: email.subject,
          sender: email.sender,
          receivedAt: email.receivedAt,
          processed: email.processed,
          processingStatus: email.processingStatus,
          error: email.error,
          schedule: email.schedule
            ? {
                id: email.schedule.id,
                shootingDate: email.schedule.shootingDate,
                callTime: email.schedule.callTime,
                location: email.schedule.location,
                sceneType: email.schedule.sceneType,
              }
            : null,
        })),
        message: "Recent emails retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get recent emails", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve recent emails",
        code: "RECENT_EMAILS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Enable/disable periodic email monitoring
   * POST /api/email/monitoring
   */
  async toggleMonitoring(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { enabled, intervalMinutes = 5 } = req.body;

      if (typeof enabled !== "boolean") {
        res.status(400).json({
          error: "Bad Request",
          message: "enabled field must be a boolean",
          code: "INVALID_ENABLED_VALUE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (enabled) {
        // Enable periodic monitoring
        await services.jobProcessor.schedulePeriodicEmailCheck(
          req.user.userId,
          intervalMinutes
        );

        logger.info("Periodic email monitoring enabled", {
          userId: req.user.userId,
          intervalMinutes,
        });

        res.json({
          success: true,
          monitoring: {
            enabled: true,
            intervalMinutes,
          },
          message: "Periodic email monitoring enabled",
        });
      } else {
        // Disable periodic monitoring
        await services.jobProcessor.cancelPeriodicEmailCheck(req.user.userId);

        logger.info("Periodic email monitoring disabled", {
          userId: req.user.userId,
        });

        res.json({
          success: true,
          monitoring: {
            enabled: false,
            intervalMinutes: null,
          },
          message: "Periodic email monitoring disabled",
        });
      }
    } catch (error) {
      logger.error("Failed to toggle email monitoring", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to toggle monitoring",
        code: "MONITORING_TOGGLE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get email details by ID
   * GET /api/email/:emailId
   */
  async getEmailDetails(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { emailId } = req.params;

      const email = await this.processedEmailRepository.findWithSchedule(
        emailId
      );

      if (!email) {
        res.status(404).json({
          error: "Not Found",
          message: "Email not found",
          code: "EMAIL_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (email.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this email",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      res.json({
        success: true,
        email: {
          id: email.id,
          messageId: email.messageId,
          subject: email.subject,
          sender: email.sender,
          receivedAt: email.receivedAt,
          threadId: email.threadId,
          processed: email.processed,
          processingStatus: email.processingStatus,
          error: email.error,
          pdfHash: email.pdfHash,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
          schedule: email.schedule
            ? {
                id: email.schedule.id,
                shootingDate: email.schedule.shootingDate,
                callTime: email.schedule.callTime,
                location: email.schedule.location,
                baseLocation: email.schedule.baseLocation,
                sceneType: email.schedule.sceneType,
                scenes: email.schedule.scenes,
                safetyNotes: email.schedule.safetyNotes,
                equipment: email.schedule.equipment,
                contacts: email.schedule.contacts,
                notes: email.schedule.notes,
                routePlan: (email.schedule as any).routePlan || null,
                weatherData: (email.schedule as any).weatherData || null,
                calendarEvent: (email.schedule as any).calendarEvent || null,
              }
            : null,
        },
      });
    } catch (error) {
      logger.error("Failed to get email details", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
        emailId: req.params.emailId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get email details",
        code: "EMAIL_DETAILS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const emailController = new EmailController();
