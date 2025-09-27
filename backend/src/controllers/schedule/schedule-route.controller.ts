import { Request, Response } from "express";
import { BaseScheduleController } from "./base-schedule.controller";
import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { services } from "@/services";
import { logger } from "@/utils/logger";

/**
 * Schedule Route Controller
 * Handles route planning operations for schedules
 */
export class ScheduleRouteController extends BaseScheduleController {
  private routePlanRepository: RoutePlanRepository;

  constructor() {
    super();
    this.routePlanRepository = new RoutePlanRepository();
  }

  /**
   * Get route plan for schedule
   * GET /api/schedule/:scheduleId/route
   */
  async getRoutePlan(req: Request, res: Response): Promise<void> {
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
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const updateData = req.body;

      // Verify schedule belongs to user
      const { schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status(error.status).json(error.json);
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
    req: Request,
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
}
