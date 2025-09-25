import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { logger } from "@/utils/logger";
import { services } from "@/services";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { UserConfigRepository } from "@/repositories/user-config.repository";

/**
 * Calendar Controller
 * Handles Google Calendar integration and event management
 */
export class CalendarController {
  private scheduleDataRepository: ScheduleDataRepository;
  private userConfigRepository: UserConfigRepository;

  constructor() {
    this.scheduleDataRepository = new ScheduleDataRepository();
    this.userConfigRepository = new UserConfigRepository();
  }
  /**
   * Get calendar events for user
   * GET /api/calendar/events
   */
  async getCalendarEvents(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { startDate, endDate, maxResults = 50 } = req.query;

      // Get calendar events from Google Calendar
      const events = await services.calendarManager.getCalendarEvents(
        req.user.userId,
        {
          timeMin: startDate ? new Date(startDate as string) : undefined,
          timeMax: endDate ? new Date(endDate as string) : undefined,
          maxResults: parseInt(maxResults as string),
        }
      );

      res.json({
        success: true,
        events: events.map((event) => ({
          id: event.id,
          title: event.summary,
          description: event.description,
          location: event.location,
          startTime: event.start?.dateTime || event.start?.date,
          endTime: event.end?.dateTime || event.end?.date,
          attendees: event.attendees?.map((attendee: any) => ({
            email: attendee.email,
            displayName: attendee.displayName,
            responseStatus: attendee.responseStatus,
          })),
          reminders: event.reminders,
          created: event.created,
          updated: event.updated,
        })),
      });
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

  /**
   * Create calendar event for schedule
   * POST /api/calendar/events
   */
  async createCalendarEvent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { scheduleId } = req.body;

      if (!scheduleId) {
        res.status(400).json({
          error: "Bad Request",
          message: "Schedule ID is required",
          code: "MISSING_SCHEDULE_ID",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Get schedule data
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

      // Create calendar event
      const calendarEvent = await services.calendarManager.createCalendarEvent(
        schedule,
        schedule.routePlan || undefined,
        schedule.weatherData || undefined,
        req.user.userId
      );

      logger.info("Calendar event created successfully", {
        userId: req.user.userId,
        scheduleId,
        eventId: calendarEvent.calendarEventId,
      });

      res.json({
        success: true,
        calendarEvent: {
          id: calendarEvent.id,
          calendarEventId: calendarEvent.calendarEventId,
          title: calendarEvent.title,
          startTime: calendarEvent.startTime,
          endTime: calendarEvent.endTime,
          description: calendarEvent.description,
          location: calendarEvent.location,
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

  /**
   * Update calendar event
   * PUT /api/calendar/events/:eventId
   */
  async updateCalendarEvent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const updateData = req.body;

      // Update calendar event in Google Calendar
      const updatedEvent = await services.calendarManager.updateCalendarEvent(
        eventId,
        updateData,
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
          title: updatedEvent.summary,
          description: updatedEvent.description,
          location: updatedEvent.location,
          startTime: updatedEvent.start?.dateTime || updatedEvent.start?.date,
          endTime: updatedEvent.end?.dateTime || updatedEvent.end?.date,
          updated: updatedEvent.updated,
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

  /**
   * Delete calendar event
   * DELETE /api/calendar/events/:eventId
   */
  async deleteCalendarEvent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params;

      // Delete calendar event from Google Calendar
      await services.calendarManager.deleteCalendarEvent(
        eventId,
        req.user.userId
      );

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

  /**
   * Get calendar sync status
   * GET /api/calendar/sync/status
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
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

  /**
   * Sync calendar events for schedules
   * POST /api/calendar/sync
   */
  async syncCalendarEvents(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
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

  /**
   * Get calendar settings
   * GET /api/calendar/settings
   */
  async getCalendarSettings(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      // Get user's calendar settings from user config
      const userConfig = await this.userConfigRepository.getConfigWithDefaults(
        req.user.userId
      );

      // Get available calendars from Google Calendar
      const calendars = await services.calendarManager.getCalendarList(
        req.user.userId
      );

      res.json({
        success: true,
        settings: {
          defaultCalendarId: "primary", // Default to primary calendar
          reminderSettings: {
            wakeUpReminders: [-10, 0, 5], // minutes before wake up time
            departureReminders: [-60, -15, 0], // minutes before departure
            eventReminders: [-720, -180, -60, 0], // 12h, 3h, 1h, at time
          },
          eventDefaults: {
            duration: 10 * 60, // 10 hours in minutes
            visibility: "private",
            guestsCanModify: false,
          },
        },
        availableCalendars: calendars.map((cal) => ({
          id: cal.id,
          summary: cal.summary,
          description: cal.description,
          primary: cal.primary,
          accessRole: cal.accessRole,
        })),
      });
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
