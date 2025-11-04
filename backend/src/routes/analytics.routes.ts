import { Router, Request, Response } from "express";
import { authenticateToken } from "@/middleware/auth.middleware";
import { AppRequest } from "@/types/requests";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { logger } from "@/utils/logger";

const router: Router = Router();
const processedEmailRepository = new ProcessedEmailRepository();

/**
 * GET /api/analytics/processing
 * Get processing analytics
 */
router.get("/processing", authenticateToken as any, async (req: AppRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { dateFrom, dateTo } = req.query;

    // Calculate date range
    const endDate = dateTo ? new Date(dateTo as string) : new Date();
    const startDate = dateFrom ? new Date(dateFrom as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get processing statistics
    const stats = await processedEmailRepository.getProcessingStats(req.user.userId);

    // Get period-specific data
    const periodEmails = await processedEmailRepository.findMany({
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
        error: true,
      },
    });

    // Calculate metrics
    const totalProcessed = periodEmails.filter(e => e.processed).length;
    const totalFailed = periodEmails.filter(e => e.processingStatus === 'failed').length;
    const totalPending = periodEmails.filter(e => e.processingStatus === 'pending').length;
    const successRate = periodEmails.length > 0 ? (totalProcessed / periodEmails.length) * 100 : 0;

    // Group by day for chart
    const dailyData = new Map<string, { total: number; successful: number; failed: number }>();
    
    periodEmails.forEach(email => {
      const dateKey = email.receivedAt.toISOString().split('T')[0];
      const existing = dailyData.get(dateKey) || { total: 0, successful: 0, failed: 0 };
      
      existing.total++;
      if (email.processed) existing.successful++;
      if (email.processingStatus === 'failed') existing.failed++;
      
      dailyData.set(dateKey, existing);
    });

    const chartData = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        ...data,
        successRate: data.total > 0 ? (data.successful / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        overall: stats,
        period: {
          dateFrom: startDate.toISOString(),
          dateTo: endDate.toISOString(),
          totalProcessed,
          totalFailed,
          totalPending,
          successRate: Math.round(successRate * 100) / 100,
        },
        chartData,
      },
    });

  } catch (error) {
    logger.error("Failed to get processing analytics", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.userId,
    });

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to get processing analytics",
      code: "ANALYTICS_FAILED",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export { router as analyticsRoutes };

