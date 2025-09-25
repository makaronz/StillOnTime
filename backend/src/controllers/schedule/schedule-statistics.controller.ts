import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { BaseScheduleController } from "./base-schedule.controller";
import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { logger } from "@/utils/logger";

/**
 * Schedule Statistics Controller
 * Handles statistics and analytics for schedules
 */
export class ScheduleStatisticsController extends BaseScheduleController {
  private routePlanRepository: RoutePlanRepository;
  private weatherDataRepository: WeatherDataRepository;

  constructor() {
    super();
    this.routePlanRepository = new RoutePlanRepository();
    this.weatherDataRepository = new WeatherDataRepository();
  }

  /**
   * Get schedule statistics
   * GET /api/schedule/statistics
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const scheduleStats = await this.scheduleDataRepository.getScheduleStats(
        req.user.userId
      );

      const routeStats = await this.routePlanRepository.getRouteStats(
        req.user.userId
      );

      const weatherStats = await this.weatherDataRepository.getWeatherStats(
        req.user.userId
      );

      res.json({
        success: true,
        statistics: {
          schedules: scheduleStats,
          routes: routeStats,
          weather: weatherStats,
        },
      });
    } catch (error) {
      logger.error("Failed to get schedule statistics", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
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
}
