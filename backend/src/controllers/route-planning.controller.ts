import { Request, Response } from "express";
import { RoutePlannerService } from "../services/route-planner.service";
import { TimeCalculationService } from "../services/time-calculation.service";
import { GoogleMapsService } from "../services/google-maps.service";
import { UserConfigRepository } from "../repositories/user-config.repository";
import { ScheduleDataRepository } from "../repositories/schedule-data.repository";
import { logger } from "../utils/logger";
import { TimeBuffers } from "../types";

export class RoutePlanningController {
  private routePlannerService: RoutePlannerService;
  private timeCalculationService: TimeCalculationService;
  private googleMapsService: GoogleMapsService;
  private userConfigRepository: UserConfigRepository;
  private scheduleDataRepository: ScheduleDataRepository;

  constructor() {
    this.routePlannerService = new RoutePlannerService();
    this.timeCalculationService = new TimeCalculationService();
    this.googleMapsService = new GoogleMapsService();
    this.userConfigRepository = new UserConfigRepository();
    this.scheduleDataRepository = new ScheduleDataRepository();
  }

  /**
   * Calculate route plan for a specific schedule
   */
  async calculateRoutePlan(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const schedule = await this.scheduleDataRepository.findById(scheduleId);
      if (!schedule) {
        res.status(404).json({ error: "Schedule not found" });
        return;
      }

      if (schedule.userId !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const routePlan = await this.routePlannerService.calculateRoutePlan(
        schedule,
        userId
      );
      const savedPlan = await this.routePlannerService.saveRoutePlan(
        routePlan,
        scheduleId,
        userId
      );

      logger.info("Route plan calculated and saved", {
        scheduleId,
        userId,
        routePlanId: savedPlan.id,
      });

      res.json({
        success: true,
        data: {
          routePlan: savedPlan,
          calculation: routePlan,
        },
      });
    } catch (error) {
      logger.error("Failed to calculate route plan", {
        error: error instanceof Error ? error.message : "Unknown error",
        scheduleId: req.params.scheduleId,
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Failed to calculate route plan",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get optimized buffer recommendations
   */
  async getBufferRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const {
        travelTimeMinutes,
        sceneType,
        weatherConditions,
        timeOfDay,
        location,
      } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userConfig = await this.userConfigRepository.findByUserId(userId);
      if (!userConfig) {
        res.status(404).json({ error: "User configuration not found" });
        return;
      }

      const baseBuffers: TimeBuffers = {
        carChange: userConfig.bufferCarChange,
        parking: userConfig.bufferParking,
        entry: userConfig.bufferEntry,
        traffic: userConfig.bufferTraffic,
        morningRoutine: userConfig.bufferMorningRoutine,
      };

      const optimizedBuffers =
        this.timeCalculationService.generateOptimizedBuffers(baseBuffers, {
          travelTimeMinutes,
          sceneType,
          weatherConditions,
          timeOfDay,
          location,
        });

      res.json({
        success: true,
        data: {
          currentBuffers: baseBuffers,
          optimizedBuffers,
          reasoning: optimizedBuffers.reasoning,
        },
      });
    } catch (error) {
      logger.error("Failed to get buffer recommendations", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
      });

      res.status(500).json({
        error: "Failed to get buffer recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Validate address using Google Maps
   */
  async validateAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.body;

      if (!address) {
        res.status(400).json({ error: "Address is required" });
        return;
      }

      const validation = await this.googleMapsService.validateAddress(address);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error("Failed to validate address", {
        error: error instanceof Error ? error.message : "Unknown error",
        address: req.body.address,
      });

      res.status(500).json({
        error: "Failed to validate address",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Calculate time schedule with recommendations
   */
  async calculateTimeSchedule(req: Request, res: Response): Promise<void> {
    try {
      const {
        callTime,
        travelTimeMinutes,
        buffers,
        location,
        sceneType,
        weatherConditions,
      } = req.body;

      if (!callTime || !travelTimeMinutes || !buffers) {
        res.status(400).json({
          error: "callTime, travelTimeMinutes, and buffers are required",
        });
        return;
      }

      const callTimeDate = new Date(callTime);
      const timeSchedule = this.timeCalculationService.calculateTimeSchedule(
        callTimeDate,
        travelTimeMinutes,
        buffers,
        {
          location,
          sceneType,
          weatherConditions,
        }
      );

      const validation = this.timeCalculationService.validateTimeSchedule(
        timeSchedule.wakeUpTime,
        callTimeDate,
        buffers,
        travelTimeMinutes
      );

      res.json({
        success: true,
        data: {
          timeSchedule,
          validation,
        },
      });
    } catch (error) {
      logger.error("Failed to calculate time schedule", {
        error: error instanceof Error ? error.message : "Unknown error",
        callTime: req.body.callTime,
      });

      res.status(500).json({
        error: "Failed to calculate time schedule",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get alternative routes
   */
  async getAlternativeRoutes(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, departureTime } = req.body;

      if (!origin || !destination) {
        res.status(400).json({ error: "Origin and destination are required" });
        return;
      }

      const departureDate = departureTime ? new Date(departureTime) : undefined;
      const routes = await this.googleMapsService.getAlternativeRoutes(
        origin,
        destination,
        departureDate
      );

      res.json({
        success: true,
        data: {
          routes,
          count: routes.length,
        },
      });
    } catch (error) {
      logger.error("Failed to get alternative routes", {
        error: error instanceof Error ? error.message : "Unknown error",
        origin: req.body.origin,
        destination: req.body.destination,
      });

      res.status(500).json({
        error: "Failed to get alternative routes",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get route recommendations for a location
   */
  async getRouteRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { location } = req.params;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const recommendations =
        await this.routePlannerService.getRouteRecommendations(
          userId,
          location
        );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      logger.error("Failed to get route recommendations", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
        location: req.params.location,
      });

      res.status(500).json({
        error: "Failed to get route recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
