import { Response } from "express";
import { services } from "@/services";
import { scheduleDataRepository } from "@/repositories/schedule-data.repository";
import { userConfigRepository } from "@/repositories";
import { logger } from "@/utils/logger";
import { requireValidOAuth } from "@/middleware/auth.middleware";
import { AppRequest } from "@/types/requests";

/**
 * Calendar Controller
 * Handles Google Calendar integration and event management
 */
export class CalendarController {
  private scheduleDataRepository: typeof scheduleDataRepository;
  private userConfigRepository: typeof userConfigRepository;

  constructor() {
    this.scheduleDataRepository = scheduleDataRepository;
    this.userConfigRepository = userConfigRepository;
  }

  /**
   * Get calendar events for user
   * GET /api/calendar/events
   */
  async getCalendarEvents(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const events = await services.calendarManager.getCalendarEvents(
        req.user.userId,
        req.query as {
          timeMin?: Date;
          timeMax?: Date;
          maxResults?: number;
        }
      );
      res.json({ success: true, events });
    } catch (error) {
      logger.error("Failed to get calendar events", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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

  /**
   * Create calendar event for schedule
   * POST /api/calendar/events
   */
  async createCalendarEvent(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { scheduleId, ...eventData } = req.body;

      // Get the schedule data first
      const schedule = await this.scheduleDataRepository.findWithRelations(scheduleId);
      
      if (!schedule || schedule.userId !== req.user.userId) {
        res.status(404).json({ 
          error: "Schedule not found or access denied",
          code: "SCHEDULE_NOT_FOUND"
        });
        return;
      }

      // Create calendar event using the correct method signature
      // Handle weatherData array vs single object
      let weatherData;
      if (schedule.weatherData && Array.isArray(schedule.weatherData)) {
        weatherData = schedule.weatherData[0] || undefined;
      } else {
        weatherData = schedule.weatherData || undefined;
      }

      const newEvent = await services.calendarManager.createCalendarEvent(
        schedule,
        schedule.routePlan || undefined,
        weatherData,
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
        userId: req.user?.userId,
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

  /**
   * Update calendar event
   * PUT /api/calendar/events/:eventId
   */
  async updateCalendarEvent(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { eventId } = req.params;
      const updatedEventData = req.body;

      // Update calendar event using the correct method signature
      const updatedEvent = await services.calendarManager.updateCalendarEvent(
        eventId,
        updatedEventData,
        req.user.userId
      );

      logger.info("Calendar event updated successfully", {
        userId: req.user.userId,
        eventId,
      });

      res.json({
        success: true,
        event: {
          id: updatedEvent.id,
          calendarEventId: updatedEvent.calendarEventId,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          startTime: updatedEvent.startTime,
          endTime: updatedEvent.endTime,
          createdAt: updatedEvent.createdAt,
        },
        message: "Calendar event updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update calendar event", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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

  /**
   * Delete calendar event
   * DELETE /api/calendar/events/:eventId
   */
  async deleteCalendarEvent(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { eventId } = req.params;

      // Delete calendar event using the correct method signature
      await services.calendarManager.deleteCalendarEvent(eventId, req.user.userId);

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
        userId: req.user?.userId,
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

  /**
   * Get calendar sync status
   * GET /api/calendar/sync/status
   */
  async getSyncStatus(req: AppRequest, res: Response): Promise<void> {
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
        userId: req.user?.userId,
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

  /**
   * Sync calendar events for schedules
   * POST /api/calendar/sync
   */
  async syncCalendarEvents(req: AppRequest, res: Response): Promise<void> {
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
          // Handle weatherData array vs single object
          let weatherDataForEvent;
          if (schedule.weatherData && Array.isArray(schedule.weatherData)) {
            weatherDataForEvent = schedule.weatherData[0] || undefined;
          } else {
            weatherDataForEvent = schedule.weatherData || undefined;
          }

          if (schedule.calendarEvent) {
            // Update existing event
            calendarEvent =
              await services.calendarManager.updateCalendarEventFromSchedule(
                schedule.calendarEvent.calendarEventId,
                schedule,
                schedule.routePlan || undefined,
                weatherDataForEvent,
                req.user.userId
              );
          } else {
            // Create new event
            calendarEvent = await services.calendarManager.createCalendarEvent(
              schedule,
              schedule.routePlan || undefined,
              weatherDataForEvent,
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
        userId: req.user?.userId,
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

  /**
   * Get calendar settings
   * GET /api/calendar/settings
   */
  async getCalendarSettings(req: AppRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      // Since getCalendarSettings method doesn't exist on CalendarManagerService,
      // we'll implement basic settings retrieval here
      const userConfig = await this.userConfigRepository.findByUserId(req.user.userId);
      
      const settings = {
        autoSync: true,
        defaultCalendar: "primary",
        syncPastEvents: false,
        eventReminders: true,
        reminderMinutes: 15,
      };

      res.json({ success: true, settings });
    } catch (error) {
      logger.error("Failed to get calendar settings", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
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
