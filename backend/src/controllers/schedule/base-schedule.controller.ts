import { Request, Response } from "express";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { logger } from "@/utils/logger";

/**
 * Base Schedule Controller
 * Handles basic schedule CRUD operations
 */
export class BaseScheduleController {
  protected scheduleDataRepository: ScheduleDataRepository;

  constructor() {
    this.scheduleDataRepository = new ScheduleDataRepository();
  }

  /**
   * Get all schedules for user with filtering and pagination
   * GET /api/schedule
   */
  async getSchedules(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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
        const whereConditions: any = { userId: req.user.userId };

        if (sceneType && sceneType !== "all") {
          whereConditions.sceneType = sceneType;
        }

        schedules = await this.scheduleDataRepository.findMany({
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
        });
      }

      res.json({
        success: true,
        schedules: schedules.map((schedule: any) => ({
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
    req: Request,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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
   * Verify schedule ownership
   */
  protected async verifyScheduleOwnership(
    scheduleId: string,
    userId: string
  ): Promise<{ schedule: any; error?: Response }> {
    const schedule = await this.scheduleDataRepository.findById(scheduleId);

    if (!schedule) {
      return {
        schedule: null,
        error: {
          status: 404,
          json: {
            error: "Not Found",
            message: "Schedule not found",
            code: "SCHEDULE_NOT_FOUND",
            timestamp: new Date().toISOString(),
          },
        } as any,
      };
    }

    if (schedule.userId !== userId) {
      return {
        schedule: null,
        error: {
          status: 403,
          json: {
            error: "Forbidden",
            message: "Access denied to this schedule",
            code: "ACCESS_DENIED",
            timestamp: new Date().toISOString(),
          },
        } as any,
      };
    }

    return { schedule };
  }
}
