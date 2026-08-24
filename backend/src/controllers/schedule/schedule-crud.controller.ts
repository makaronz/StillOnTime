import { Response } from "express"
import { AppRequest } from "@/types/requests";
import { BaseScheduleController } from "./base-schedule.controller";
import { services } from "@/services";
import { processedEmailRepository } from "@/repositories/processed-email.repository";
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
  /**
   * POST /api/schedules — tworzy nowy harmonogram.
   *
   * UWAGA dot. kontraktu: schedule_data.emailId jest NOT NULL z kluczem obcym do
   * processed_emails, wiec harmonogram musi wskazywac na maila zrodlowego.
   * Typ CreateScheduleRequest we frontendzie (frontend/src/types/schedule.ts)
   * nie zawiera emailId — dopoki to sie nie zmieni albo dopoki emailId nie stanie
   * sie nullowalny, tworzenie harmonogramu "od zera" z UI nie jest mozliwe.
   * Swiadomie nie tworzymy tu fikcyjnego rekordu maila: zasmiecalby historie
   * uzytkownika widoczna na stronie History.
   */
  async createSchedule(req: AppRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { emailId, shootingDate, callTime, location } = req.body;

      if (!emailId) {
        res.status(400).json({
          error: "Bad Request",
          message:
            "emailId is required: a schedule must reference the processed email it came from",
          code: "EMAIL_ID_REQUIRED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const email = await processedEmailRepository.findById(emailId);
      if (!email || email.userId !== req.user.userId) {
        res.status(404).json({
          error: "Not Found",
          message: "Referenced email not found",
          code: "EMAIL_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const created = await this.scheduleDataRepository.create({
        userId: req.user.userId,
        emailId,
        shootingDate: new Date(shootingDate),
        callTime,
        location,
        baseLocation: req.body.baseLocation ?? null,
        sceneType: req.body.sceneType ?? "INT",
        scenes: req.body.scenes ?? null,
        safetyNotes: req.body.safetyNotes ?? null,
        equipment: req.body.equipment ?? null,
        contacts: req.body.contacts ?? null,
        notes: req.body.notes ?? null,
      } as never);

      logger.info("Schedule created", {
        userId: req.user.userId,
        scheduleId: (created as { id?: string }).id,
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error("Failed to create schedule", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create schedule",
        code: "SCHEDULE_CREATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  async updateSchedule(
    req: AppRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { scheduleId } = req.params;
      const updateData = req.body;

      // Verify schedule exists and belongs to user
      const { schedule: _schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status((error as any).status).json((error as any).json);
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
    req: AppRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { scheduleId } = req.params;

      // Verify schedule exists and belongs to user
      const { schedule: _schedule, error } = await this.verifyScheduleOwnership(
        scheduleId,
        req.user.userId
      );

      if (error) {
        res.status((error as any).status).json((error as any).json);
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
