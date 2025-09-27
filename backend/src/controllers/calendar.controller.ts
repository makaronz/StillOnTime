import { Request, Response } from "express";
import { services } from "@/services";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { UserConfigRepository } from "@/repositories/user-config.repository";
import { logger } from "@/utils/logger";
import { Controller, Get, Post, Put, Delete, Middleware } from "@/utils/inject";
import { requireValidOAuth } from "@/middleware/oauth.middleware";

/**
 * Calendar Controller
 * Handles Google Calendar integration and event management
 */
@Controller("/calendar")
export class CalendarController {
  private scheduleDataRepository: ScheduleDataRepository;
  private userConfigRepository: UserConfigRepository;

  constructor() {
    this.scheduleDataRepository = new ScheduleDataRepository();
    this.userConfigRepository = new UserConfigRepository();
  }
  @Get("/events")
  @Middleware(requireValidOAuth)
  /**
   * Get calendar events for user
   * GET /api/calendar/events
   */
  async getCalendarEvents(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const events = await services.calendarManager.getEvents(
        req.user.userId,
        req.query
      );
      res.json({ success: true, events });
    } catch (error) {
      logger.error("Failed to get calendar events", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get calendar events",
        code: "CALENDAR_EVENTS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Post("/events")
  @Middleware(requireValidOAuth)
  /**
   * Create calendar event for schedule
   * POST /api/calendar/events
   */
  async createCalendarEvent(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { scheduleId, ...eventData } = req.body;
      const newEvent = await services.calendarManager.createEvent(
        scheduleId,
        eventData,
        req.user.userId
      );

      logger.info("Calendar event created successfully", {
        userId: req.user.userId,
        scheduleId,
        eventId: newEvent.calendarEventId,
      });

      res.json({
        success: true,
        calendarEvent: {
          id: newEvent.id,
          calendarEventId: newEvent.calendarEventId,
          title: newEvent.title,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
          description: newEvent.description,
          location: newEvent.location,
        },
        message: "Calendar event created successfully",
      });
    } catch (error) {
      logger.error("Failed to create calendar event", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create calendar event",
        code: "CALENDAR_EVENT_CREATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Put("/events/:eventId")
  @Middleware(requireValidOAuth)
  /**
   * Update calendar event
   * PUT /api/calendar/events/:eventId
   */
  async updateCalendarEvent(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { eventId } = req.params;
      const updatedEventData = req.body;

      // Update calendar event in Google Calendar
      const updatedEvent = await services.calendarManager.updateEvent(
        eventId,
        updatedEventData
      );

      logger.info("Calendar event updated successfully", {
        userId: req.user.userId,
        eventId,
      });

      res.json({
        success: true,
        event: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          startTime: updatedEvent.startTime,
          endTime: updatedEvent.endTime,
          updated: new Date().toISOString(),
        },
        message: "Calendar event updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update calendar event", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        eventId: req.params.eventId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update calendar event",
        code: "CALENDAR_EVENT_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Delete("/events/:eventId")
  @Middleware(requireValidOAuth)
  /**
   * Delete calendar event
   * DELETE /api/calendar/events/:eventId
   */
  async deleteCalendarEvent(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { eventId } = req.params;

      // Delete calendar event from Google Calendar
      await services.calendarManager.deleteEvent(eventId, req.user.userId);

      logger.info("Calendar event deleted successfully", {
        userId: req.user.userId,
        eventId,
      });

      res.json({
        success: true,
        message: "Calendar event deleted successfully",
      });
    } catch (error) {
      logger.error("Failed to delete calendar event", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
        eventId: req.params.eventId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete calendar event",
        code: "CALENDAR_EVENT_DELETE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Get("/sync/status")
  @Middleware(requireValidOAuth)
  /**
   * Get calendar sync status
   * GET /api/calendar/sync/status
   */
  async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // Get OAuth status to check calendar access
      const oauthStatus = await services.oauth2.getOAuthStatus(req.user.userId);

      // Check if calendar scope is available
      const hasCalendarAccess = oauthStatus.scopes.includes(
        "https://www.googleapis.com/auth/calendar"
      );

      // Get recent calendar events count
      let recentEventsCount = 0;
      if (hasCalendarAccess) {
        try {
          const events = await services.calendarManager.getCalendarEvents(
            req.user.userId,
            { maxResults: 10 }
          );
          recentEventsCount = events.length;
        } catch (error) {
          logger.warn("Failed to get recent events count", { error });
        }
      }

      res.json({
        success: true,
        syncStatus: {
          isConnected: hasCalendarAccess,
          hasCalendarAccess,
          lastSync: new Date().toISOString(),
          recentEventsCount,
          scopes: oauthStatus.scopes,
        },
      });
    } catch (error) {
      logger.error("Failed to get calendar sync status", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get sync status",
        code: "SYNC_STATUS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Post("/sync")
  @Middleware(requireValidOAuth)
  /**
   * Sync calendar events for schedules
   * POST /api/calendar/sync
   */
  async syncCalendarEvents(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { scheduleIds } = req.body;

      if (!scheduleIds || !Array.isArray(scheduleIds)) {
        res.status(400).json({
          error: "Bad Request",
          message: "Schedule IDs array is required",
          code: "MISSING_SCHEDULE_IDS",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const results = [];

      for (const scheduleId of scheduleIds) {
        try {
          // Get schedule data
          const schedule = await this.scheduleDataRepository.findWithRelations(
            scheduleId
          );

          if (!schedule || schedule.userId !== req.user.userId) {
            results.push({
              scheduleId,
              success: false,
              error: "Schedule not found or access denied",
            });
            continue;
          }

          // Create or update calendar event
          let calendarEvent;
          if (schedule.calendarEvent) {
            // Update existing event
            calendarEvent =
              await services.calendarManager.updateCalendarEventFromSchedule(
                schedule.calendarEvent.calendarEventId,
                schedule,
                schedule.routePlan || undefined,
                schedule.weatherData || undefined,
                req.user.userId
              );
          } else {
            // Create new event
            calendarEvent = await services.calendarManager.createCalendarEvent(
              schedule,
              schedule.routePlan || undefined,
              schedule.weatherData || undefined,
              req.user.userId
            );
          }

          results.push({
            scheduleId,
            success: true,
            eventId: calendarEvent.calendarEventId,
          });
        } catch (error) {
          logger.error("Failed to sync calendar event for schedule", {
            scheduleId,
            error,
          });

          results.push({
            scheduleId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;

      logger.info("Calendar sync completed", {
        userId: req.user.userId,
        totalSchedules: scheduleIds.length,
        successCount,
        failureCount: scheduleIds.length - successCount,
      });

      res.json({
        success: true,
        results,
        summary: {
          total: scheduleIds.length,
          successful: successCount,
          failed: scheduleIds.length - successCount,
        },
        message: `Calendar sync completed: ${successCount}/${scheduleIds.length} events synced`,
      });
    } catch (error) {
      logger.error("Failed to sync calendar events", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to sync calendar events",
        code: "CALENDAR_SYNC_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  @Get("/settings")
  @Middleware(requireValidOAuth)
  /**
   * Get calendar settings
   * GET /api/calendar/settings
   */
  async getCalendarSettings(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const settings = await services.calendarManager.getCalendarSettings(
        req.user.userId
      );
      res.json({ success: true, settings });
    } catch (error) {
      logger.error("Failed to get calendar settings", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user.userId,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get calendar settings",
        code: "CALENDAR_SETTINGS_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const calendarController = new CalendarController();
