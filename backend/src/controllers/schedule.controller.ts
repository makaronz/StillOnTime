import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { WhereCondition } from "@/types";
import { logger } from "@/utils/logger";
import { services } from "@/services";

/**
 * Schedule Controller
 * Handles schedule data CRUD operations and related functionality
 */
export class ScheduleController {
  private scheduleDataRepository: ScheduleDataRepository;
  private routePlanRepository: RoutePlanRepository;
  private weatherDataRepository: WeatherDataRepository;

  constructor() {
    this.scheduleDataRepository = new ScheduleDataRepository();
    this.routePlanRepository = new RoutePlanRepository();
    this.weatherDataRepository = new WeatherDataRepository();
  }

  /**
   * Get all schedules for user with filtering and pagination
   * GET /api/schedule
   */
  async getSchedules(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        type = "all", // all, upcoming, past
        location,
        dateFrom,
        dateTo,
        sceneType,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      let schedules;

      if (type === "upcoming") {
        schedules = await this.scheduleDataRepository.findUpcomingSchedules(
          req.user.userId,
          limitNum
        );
      } else if (type === "past") {
        schedules = await this.scheduleDataRepository.findPastSchedules(
          req.user.userId,
          limitNum
        );
      } else if (dateFrom && dateTo) {
        schedules = await this.scheduleDataRepository.findSchedulesByDateRange(
          req.user.userId,
          new Date(dateFrom as string),
          new Date(dateTo as string)
        );
      } else if (location) {
        schedules = await this.scheduleDataRepository.findSchedulesByLocation(
          req.user.userId,
          location as string
        );
      } else {
        // Get all schedules with pagination
        const offset = (pageNum - 1) * limitNum;
        const whereConditions: WhereCondition = { userId: req.user.userId };

        if (sceneType && sceneType !== "all") {
          whereConditions.sceneType = sceneType;
        }

        schedules = (await this.scheduleDataRepository.findMany({
          where: whereConditions,
          include: {
            email: {
              select: {
                id: true,
                subject: true,
                sender: true,
                receivedAt: true,
              },
            },
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
          orderBy: { shootingDate: "desc" },
          skip: offset,
          take: limitNum,
        })) as any[];
      }

      res.json({
        success: true,
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          shootingDate: schedule.shootingDate,
          callTime: schedule.callTime,
          location: schedule.location,
          baseLocation: schedule.baseLocation,
          sceneType: schedule.sceneType,
          scenes: schedule.scenes,
          safetyNotes: schedule.safetyNotes,
          equipment: schedule.equipment,
          contacts: schedule.contacts,
          notes: schedule.notes,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
          email: schedule.email
            ? {
                id: schedule.email.id,
                subject: schedule.email.subject,
                sender: schedule.email.sender,
                receivedAt: schedule.email.receivedAt,
              }
            : null,
          hasRoutePlan: !!schedule.routePlan,
          hasWeatherData: !!schedule.weatherData,
          hasCalendarEvent: !!schedule.calendarEvent,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          type,
        },
      });
    } catch (error) {
      logger.error("Failed to get schedules", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get schedules",
        code: "SCHEDULES_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get schedule by ID with all related data
   * GET /api/schedule/:scheduleId
   */
  async getScheduleById(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;

      const schedule = await this.scheduleDataRepository.findWithRelations(
        scheduleId
      );

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      res.json({
        success: true,
        schedule: {
          id: schedule.id,
          shootingDate: schedule.shootingDate,
          callTime: schedule.callTime,
          location: schedule.location,
          baseLocation: schedule.baseLocation,
          sceneType: schedule.sceneType,
          scenes: schedule.scenes,
          safetyNotes: schedule.safetyNotes,
          equipment: schedule.equipment,
          contacts: schedule.contacts,
          notes: schedule.notes,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
          email: schedule.email
            ? {
                id: schedule.email.id,
                messageId: schedule.email.messageId,
                subject: schedule.email.subject,
                sender: schedule.email.sender,
                receivedAt: schedule.email.receivedAt,
              }
            : null,
          routePlan: schedule.routePlan,
          weatherData: schedule.weatherData,
          calendarEvent: schedule.calendarEvent,
        },
      });
    } catch (error) {
      logger.error("Failed to get schedule by ID", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get schedule",
        code: "SCHEDULE_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update schedule data
   * PUT /api/schedule/:scheduleId
   */
  async updateSchedule(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const updateData = req.body;

      // Verify schedule exists and belongs to user
      const existingSchedule = await this.scheduleDataRepository.findById(
        scheduleId
      );

      if (!existingSchedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (existingSchedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Update schedule
      const updatedSchedule =
        await this.scheduleDataRepository.updateWithRelations(
          scheduleId,
          updateData
        );

      // If location or call time changed, trigger route recalculation
      if (updateData.location || updateData.callTime) {
        try {
          await services.jobProcessor.addRouteRecalculationJob(scheduleId);
        } catch (error) {
          logger.warn("Failed to trigger route recalculation", {
            scheduleId,
            error,
          });
        }
      }

      // If shooting date changed, trigger weather update
      if (updateData.shootingDate) {
        try {
          await services.jobProcessor.addWeatherUpdateJob(scheduleId);
        } catch (error) {
          logger.warn("Failed to trigger weather update", {
            scheduleId,
            error,
          });
        }
      }

      logger.info("Schedule updated successfully", {
        userId: req.user.userId,
        scheduleId,
        updatedFields: Object.keys(updateData),
      });

      res.json({
        success: true,
        schedule: {
          id: updatedSchedule.id,
          shootingDate: updatedSchedule.shootingDate,
          callTime: updatedSchedule.callTime,
          location: updatedSchedule.location,
          baseLocation: updatedSchedule.baseLocation,
          sceneType: updatedSchedule.sceneType,
          scenes: updatedSchedule.scenes,
          safetyNotes: updatedSchedule.safetyNotes,
          equipment: updatedSchedule.equipment,
          contacts: updatedSchedule.contacts,
          notes: updatedSchedule.notes,
          updatedAt: updatedSchedule.updatedAt,
          routePlan: updatedSchedule.routePlan,
          weatherData: updatedSchedule.weatherData,
          calendarEvent: updatedSchedule.calendarEvent,
        },
        message: "Schedule updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update schedule", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update schedule",
        code: "SCHEDULE_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Delete schedule
   * DELETE /api/schedule/:scheduleId
   */
  async deleteSchedule(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Verify schedule exists and belongs to user
      const existingSchedule = await this.scheduleDataRepository.findById(
        scheduleId
      );

      if (!existingSchedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (existingSchedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Delete schedule (cascade will handle related data)
      await this.scheduleDataRepository.delete(scheduleId);

      logger.info("Schedule deleted successfully", {
        userId: req.user.userId,
        scheduleId,
      });

      res.json({
        success: true,
        message: "Schedule deleted successfully",
      });
    } catch (error) {
      logger.error("Failed to delete schedule", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete schedule",
        code: "SCHEDULE_DELETE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
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

  /**
   * Get route plan for schedule
   * GET /api/schedule/:scheduleId/route
   */
  async getRoutePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Verify schedule belongs to user
      const schedule = await this.scheduleDataRepository.findById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const routePlan = await this.routePlanRepository.findByScheduleId(
        scheduleId
      );

      if (!routePlan) {
        res.status(404).json({
          error: "Not Found",
          message: "Route plan not found for this schedule",
          code: "ROUTE_PLAN_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      res.json({
        success: true,
        routePlan,
      });
    } catch (error) {
      logger.error("Failed to get route plan", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get route plan",
        code: "ROUTE_PLAN_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update route plan for schedule
   * PUT /api/schedule/:scheduleId/route
   */
  async updateRoutePlan(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const updateData = req.body;

      // Verify schedule belongs to user
      const schedule = await this.scheduleDataRepository.findById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Check if route plan exists
      const existingRoutePlan = await this.routePlanRepository.findByScheduleId(
        scheduleId
      );

      if (!existingRoutePlan) {
        res.status(404).json({
          error: "Not Found",
          message: "Route plan not found for this schedule",
          code: "ROUTE_PLAN_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Update route plan
      const updatedRoutePlan = await this.routePlanRepository.update(
        existingRoutePlan.id,
        updateData
      );

      logger.info("Route plan updated successfully", {
        userId: req.user.userId,
        scheduleId,
        routePlanId: existingRoutePlan.id,
        updatedFields: Object.keys(updateData),
      });

      res.json({
        success: true,
        routePlan: updatedRoutePlan,
        message: "Route plan updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update route plan", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update route plan",
        code: "ROUTE_PLAN_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Trigger route recalculation for schedule
   * POST /api/schedule/:scheduleId/route/recalculate
   */
  async recalculateRoute(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Verify schedule belongs to user
      const schedule = await this.scheduleDataRepository.findById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Add route recalculation job
      const job = await services.jobProcessor.addRouteRecalculationJob(
        scheduleId
      );

      logger.info("Route recalculation triggered", {
        userId: req.user.userId,
        scheduleId,
        jobId: job.id,
      });

      res.json({
        success: true,
        job: {
          id: job.id,
          status: "queued",
        },
        message: "Route recalculation queued",
      });
    } catch (error) {
      logger.error("Failed to trigger route recalculation", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to trigger route recalculation",
        code: "ROUTE_RECALC_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get weather data for schedule
   * GET /api/schedule/:scheduleId/weather
   */
  async getWeatherData(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Verify schedule belongs to user
      const schedule = await this.scheduleDataRepository.findById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const weatherData = await this.weatherDataRepository.findByScheduleId(
        scheduleId
      );

      if (!weatherData) {
        res.status(404).json({
          error: "Not Found",
          message: "Weather data not found for this schedule",
          code: "WEATHER_DATA_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      res.json({
        success: true,
        weatherData,
      });
    } catch (error) {
      logger.error("Failed to get weather data", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get weather data",
        code: "WEATHER_DATA_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Trigger weather update for schedule
   * POST /api/schedule/:scheduleId/weather/update
   */
  async updateWeatherData(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;

      // Verify schedule belongs to user
      const schedule = await this.scheduleDataRepository.findById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          error: "Not Found",
          message: "Schedule not found",
          code: "SCHEDULE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (schedule.userId !== req.user.userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this schedule",
          code: "ACCESS_DENIED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Add weather update job
      const job = await services.jobProcessor.addWeatherUpdateJob(scheduleId);

      logger.info("Weather update triggered", {
        userId: req.user.userId,
        scheduleId,
        jobId: job.id,
      });

      res.json({
        success: true,
        job: {
          id: job.id,
          status: "queued",
        },
        message: "Weather update queued",
      });
    } catch (error) {
      logger.error("Failed to trigger weather update", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        scheduleId: req.params.scheduleId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to trigger weather update",
        code: "WEATHER_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get weather warnings for user
   * GET /api/schedule/weather/warnings
   */
  async getWeatherWarnings(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const warnings = await this.weatherDataRepository.findWeatherWarnings(
        req.user.userId
      );

      res.json({
        success: true,
        warnings: warnings.map((weather: any) => ({
          id: weather.id,
          scheduleId: weather.scheduleId,
          forecastDate: weather.forecastDate,
          temperature: weather.temperature,
          description: weather.description,
          windSpeed: weather.windSpeed,
          precipitation: weather.precipitation,
          warnings: weather.warnings,
          schedule: weather.schedule
            ? {
                location: weather.schedule.location,
                shootingDate: weather.schedule.shootingDate,
                callTime: weather.schedule.callTime,
                sceneType: weather.schedule.sceneType,
              }
            : null,
        })),
      });
    } catch (error) {
      logger.error("Failed to get weather warnings", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get weather warnings",
        code: "WEATHER_WARNINGS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get weather forecast for location and date
   * GET /api/schedule/weather/forecast
   */
  async getWeatherForecast(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { location, date } = req.query;

      if (!location || !date) {
        res.status(400).json({
          error: "Bad Request",
          message: "Location and date are required",
          code: "MISSING_PARAMETERS",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Get weather forecast using weather service
      const weatherForecast = await services.weather.getWeatherForecast(
        location as string,
        date as string
      );

      res.json({
        success: true,
        forecast: weatherForecast,
      });
    } catch (error) {
      logger.error("Failed to get weather forecast", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        location: req.query.location,
        date: req.query.date,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get weather forecast",
        code: "WEATHER_FORECAST_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const scheduleController = new ScheduleController();
