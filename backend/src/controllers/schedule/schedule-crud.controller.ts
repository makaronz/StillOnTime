import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { BaseScheduleController } from "./base-schedule.controller";
import { services } from "@/services";
import { logger } from "@/utils/logger";

/**
 * Schedule CRUD Controller
 * Handles schedule create, update, delete operations
 */
export class ScheduleCrudController extends BaseScheduleController {
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
      const { schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status(error.status).json(error.json);
        return;
      }

      // Update schedule
      const updatedSchedule =
        await this.scheduleDataRepository.updateWithRelations(
          scheduleId,
          updateData
        );

      // Trigger background jobs if needed
      await this.triggerBackgroundJobs(scheduleId, updateData);

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
      const { schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status(error.status).json(error.json);
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
   * Trigger background jobs based on update data
   */
  private async triggerBackgroundJobs(
    scheduleId: string,
    updateData: any
  ): Promise<void> {
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
  }
}
