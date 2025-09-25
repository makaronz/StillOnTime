import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { BaseScheduleController } from "./base-schedule.controller";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { services } from "@/services";
import { logger } from "@/utils/logger";

/**
 * Schedule Weather Controller
 * Handles weather-related operations for schedules
 */
export class ScheduleWeatherController extends BaseScheduleController {
  private weatherDataRepository: WeatherDataRepository;

  constructor() {
    super();
    this.weatherDataRepository = new WeatherDataRepository();
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
      const { schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status(error.status).json(error.json);
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
      const { schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status(error.status).json(error.json);
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
