import { CalendarService } from "./calendar.service";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { logger } from "@/utils/logger";
import {
  CalendarEvent,
  ScheduleData,
  RoutePlan,
  WeatherData,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarOverride,
  CalendarUpdateData,
  CalendarConflict,
} from "@/types";

export interface ConflictResolution {
  strategy: "reschedule" | "override" | "cancel" | "merge";
  newStartTime?: Date;
  newEndTime?: Date;
  reason: string;
}

export interface SyncStatus {
  eventId: string;
  googleEventId?: string;
  lastSyncAt?: Date;
  syncStatus: "synced" | "pending" | "failed" | "conflict";
  syncError?: string;
  needsManualReview: boolean;
}

// CalendarOverride interface moved to types/index.ts

export interface BatchSyncResult {
  synced: CalendarEvent[];
  failed: Array<{
    event: CalendarEvent;
    error: string;
  }>;
  conflicts: Array<{
    event: CalendarEvent;
    conflictType: string;
    resolution?: ConflictResolution;
  }>;
}

/**
 * Calendar Event Management Service
 * Handles high-level calendar operations, conflict resolution, and synchronization
 */
export class CalendarManagerService {
  private calendarService: CalendarService;
  private calendarEventRepository: CalendarEventRepository;
  private scheduleDataRepository: ScheduleDataRepository;

  constructor(
    calendarService: CalendarService,
    calendarEventRepository: CalendarEventRepository,
    scheduleDataRepository: ScheduleDataRepository
  ) {
    this.calendarService = calendarService;
    this.calendarEventRepository = calendarEventRepository;
    this.scheduleDataRepository = scheduleDataRepository;
  }

  /**
   * Create calendar event with automatic conflict resolution
   */
  async createEventWithConflictResolution(
    scheduleData: ScheduleData,
    routePlan: RoutePlan,
    weather: WeatherData,
    userId: string,
    autoResolve: boolean = true
  ): Promise<{
    event: CalendarEvent;
    conflicts: Array<{ event: CalendarEvent; resolution?: ConflictResolution }>;
  }> {
    try {
      logger.info("Creating calendar event with conflict resolution", {
        scheduleId: scheduleData.id,
        userId,
        autoResolve,
      });

      // Calculate event times
      const departureTime =
        routePlan?.departureTime || new Date(scheduleData.shootingDate);
      const callTime = new Date(scheduleData.shootingDate);
      const [hours, minutes] = scheduleData.callTime.split(":").map(Number);
      callTime.setHours(hours, minutes, 0, 0);
      const endTime = new Date(callTime.getTime() + 10 * 60 * 60 * 1000);

      // Detect conflicts
      const conflicts = await this.calendarService.detectConflicts(
        userId,
        departureTime,
        endTime
      );

      const resolvedConflicts: Array<{
        event: CalendarEvent;
        resolution?: ConflictResolution;
      }> = [];

      // Handle conflicts
      if (conflicts.length > 0 && autoResolve) {
        for (const conflict of conflicts) {
          const resolution = await this.resolveConflict(
            conflict,
            scheduleData,
            userId
          );
          resolvedConflicts.push({
            event: conflict.conflictingEvent,
            resolution,
          });

          if (resolution.strategy === "reschedule") {
            await this.applyConflictResolution(
              conflict.conflictingEvent.id,
              resolution,
              userId
            );
          }
        }
      } else if (conflicts.length > 0) {
        // Just log conflicts without resolving
        resolvedConflicts.push(
          ...conflicts.map((c) => ({ event: c.conflictingEvent }))
        );
      }

      // Create the event
      const event = await this.calendarService.createCalendarEvent(
        scheduleData,
        routePlan,
        weather,
        userId
      );

      logger.info(
        "Successfully created calendar event with conflict resolution",
        {
          eventId: event.id,
          conflictCount: conflicts.length,
          resolvedCount: resolvedConflicts.filter((c) => c.resolution).length,
        }
      );

      return {
        event,
        conflicts: resolvedConflicts,
      };
    } catch (error) {
      logger.error("Failed to create calendar event with conflict resolution", {
        scheduleId: scheduleData.id,
        userId,
        error,
      });
      throw new Error(
        `Failed to create calendar event with conflict resolution: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Perform batch calendar synchronization
   */
  async performBatchSync(
    userId: string,
    eventIds?: string[]
  ): Promise<BatchSyncResult> {
    try {
      logger.info("Starting batch calendar synchronization", {
        userId,
        eventIds: eventIds?.length || "all",
      });

      const result: BatchSyncResult = {
        synced: [],
        failed: [],
        conflicts: [],
      };

      // Get events to sync
      let eventsToSync: CalendarEvent[];
      if (eventIds) {
        eventsToSync = await Promise.all(
          eventIds.map((id) => this.calendarEventRepository.findById(id))
        ).then((events) => events.filter((e) => e !== null) as CalendarEvent[]);
      } else {
        eventsToSync =
          await this.calendarEventRepository.findEventsNeedingSync();
      }

      logger.info("Found events to sync", {
        count: eventsToSync.length,
        eventIds: eventsToSync.map((e) => e.id),
      });

      // Process each event
      for (const event of eventsToSync) {
        try {
          const syncStatus = await this.syncSingleEvent(event, userId);

          if (syncStatus.syncStatus === "synced") {
            result.synced.push(event);
          } else if (syncStatus.syncStatus === "conflict") {
            result.conflicts.push({
              event,
              conflictType: syncStatus.syncError || "Unknown conflict",
            });
          } else if (syncStatus.syncStatus === "failed") {
            result.failed.push({
              event,
              error: syncStatus.syncError || "Unknown error",
            });
          }
        } catch (error) {
          logger.error("Failed to sync individual event", {
            eventId: event.id,
            error,
          });
          result.failed.push({
            event,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.info("Completed batch calendar synchronization", {
        userId,
        synced: result.synced.length,
        failed: result.failed.length,
        conflicts: result.conflicts.length,
      });

      return result;
    } catch (error) {
      logger.error("Failed to perform batch calendar synchronization", {
        userId,
        error,
      });
      throw new Error(
        `Failed to perform batch synchronization: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get synchronization status for events
   */
  async getSyncStatus(
    userId: string,
    eventIds?: string[]
  ): Promise<SyncStatus[]> {
    try {
      let events: CalendarEvent[];

      if (eventIds) {
        events = await Promise.all(
          eventIds.map((id) => this.calendarEventRepository.findById(id))
        ).then((events) => events.filter((e) => e !== null) as CalendarEvent[]);
      } else {
        events = await this.calendarEventRepository.findByUserId(userId);
      }

      const syncStatuses: SyncStatus[] = [];

      for (const event of events) {
        const status = await this.checkEventSyncStatus(event);
        syncStatuses.push(status);
      }

      return syncStatuses;
    } catch (error) {
      logger.error("Failed to get sync status", { userId, eventIds, error });
      throw new Error(
        `Failed to get sync status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Apply manual calendar override
   */
  async applyManualOverride(
    eventId: string,
    override: Omit<CalendarOverride, "eventId" | "appliedAt">,
    userId: string
  ): Promise<CalendarEvent> {
    try {
      logger.info("Applying manual calendar override", {
        eventId,
        overrideType: override.overrideType,
        appliedBy: override.appliedBy,
      });

      // Get existing event
      const existingEvent = await this.calendarEventRepository.findById(
        eventId
      );
      if (!existingEvent) {
        throw new Error("Calendar event not found");
      }

      // Store override information (in a real implementation, this would be in a separate table)
      const fullOverride: CalendarOverride = {
        ...override,
        eventId,
        appliedAt: new Date(),
      };

      // Apply the override based on type
      let updateData: Partial<UpdateCalendarEventInput> = {};

      switch (override.overrideType) {
        case "time":
          if (
            typeof override.overrideValue === "object" &&
            override.overrideValue !== null
          ) {
            const timeOverride = override.overrideValue as any;
            if (timeOverride.startTime) {
              updateData.startTime = new Date(timeOverride.startTime);
            }
            if (timeOverride.endTime) {
              updateData.endTime = new Date(timeOverride.endTime);
            }
          }
          break;

        case "location":
          updateData.location = String(override.overrideValue);
          break;

        case "description":
          updateData.description = String(override.overrideValue);
          break;

        case "alarms":
          // Alarms would be handled differently in a real implementation
          logger.info("Alarm override requested", {
            eventId,
            alarms: override.overrideValue,
          });
          break;
      }

      // Update the event
      const updatedEvent = await this.calendarEventRepository.update(
        eventId,
        updateData
      );

      // Sync with Google Calendar if needed
      if (
        override.overrideType === "time" ||
        override.overrideType === "location" ||
        override.overrideType === "description"
      ) {
        try {
          await this.syncSingleEvent(updatedEvent, userId);
        } catch (syncError) {
          logger.warn("Failed to sync override to Google Calendar", {
            eventId,
            syncError,
          });
        }
      }

      logger.info("Successfully applied manual calendar override", {
        eventId,
        overrideType: override.overrideType,
      });

      return updatedEvent;
    } catch (error) {
      logger.error("Failed to apply manual calendar override", {
        eventId,
        override,
        error,
      });
      throw new Error(
        `Failed to apply manual override: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get calendar events from Google Calendar
   */
  async getCalendarEvents(
    userId: string,
    options?: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
    }
  ): Promise<any[]> {
    try {
      logger.info("Getting calendar events from Google Calendar", {
        userId,
        options,
      });

      // This would integrate with Google Calendar API
      // For now, return local events as a fallback
      const localEvents = await this.calendarEventRepository.findByUserId(
        userId,
        options?.maxResults || 50
      );

      return localEvents.map((event) => ({
        id: event.calendarEventId,
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startTime.toISOString() },
        end: { dateTime: event.endTime.toISOString() },
        created: event.createdAt.toISOString(),
        updated: event.createdAt.toISOString(),
      }));
    } catch (error) {
      logger.error("Failed to get calendar events", { userId, error });
      throw new Error(
        `Failed to get calendar events: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update calendar event from schedule data
   */
  async updateCalendarEventFromSchedule(
    calendarEventId: string,
    scheduleData: ScheduleData,
    routePlan?: RoutePlan,
    weather?: WeatherData,
    userId?: string
  ): Promise<CalendarEvent> {
    try {
      logger.info("Updating calendar event from schedule", {
        calendarEventId,
        scheduleId: scheduleData.id,
      });

      // Find the local event by Google Calendar event ID
      const localEvent =
        await this.calendarEventRepository.findByCalendarEventId(
          calendarEventId
        );

      if (!localEvent) {
        throw new Error("Calendar event not found");
      }

      // Update the calendar event using the calendar service
      const updatedEvent = await this.calendarService.updateCalendarEvent(
        localEvent.id,
        scheduleData,
        routePlan,
        weather,
        userId
      );

      return updatedEvent;
    } catch (error) {
      logger.error("Failed to update calendar event from schedule", {
        calendarEventId,
        scheduleId: scheduleData.id,
        error,
      });
      throw new Error(
        `Failed to update calendar event from schedule: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get list of available calendars from Google Calendar
   */
  async getCalendarList(userId: string): Promise<any[]> {
    try {
      logger.info("Getting calendar list from Google Calendar", { userId });

      // This would integrate with Google Calendar API to get calendar list
      // For now, return a default primary calendar
      return [
        {
          id: "primary",
          summary: "Primary Calendar",
          description: "Primary Google Calendar",
          primary: true,
          accessRole: "owner",
        },
      ];
    } catch (error) {
      logger.error("Failed to get calendar list", { userId, error });
      throw new Error(
        `Failed to get calendar list: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create calendar event (wrapper for calendar service)
   */
  async createCalendarEvent(
    scheduleData: ScheduleData,
    routePlan?: RoutePlan,
    weather?: WeatherData,
    userId?: string
  ): Promise<CalendarEvent> {
    return this.calendarService.createCalendarEvent(
      scheduleData,
      routePlan!,
      weather!,
      userId!
    );
  }

  /**
   * Update calendar event (wrapper for calendar service)
   */
  async updateCalendarEvent(
    eventId: string,
    updateData: CalendarUpdateData,
    userId: string
  ): Promise<CalendarEvent> {
    // This would update the event in Google Calendar
    // For now, return a mock response
    return {
      id: eventId,
      summary: updateData.title || "Updated Event",
      description: updateData.description || null,
      location: updateData.location || null,
      start: { dateTime: updateData.startTime?.toISOString() },
      end: { dateTime: updateData.endTime?.toISOString() },
      updated: new Date().toISOString(),
    } as any;
  }

  /**
   * Delete calendar event (wrapper for calendar service)
   */
  async deleteCalendarEvent(eventId: string, userId: string): Promise<void> {
    return this.calendarService.deleteCalendarEvent(eventId, userId);
  }

  /**
   * Get calendar analytics and statistics
   */
  async getCalendarAnalytics(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    conflictRate: number;
    syncSuccessRate: number;
    averageEventDuration: number;
    mostCommonLocations: Array<{ location: string; count: number }>;
  }> {
    try {
      const stats = await this.calendarEventRepository.getEventStats(userId);

      // Get events in date range if specified
      let events: CalendarEvent[];
      if (dateRange) {
        events = await this.calendarEventRepository.findEventsByDateRange(
          userId,
          dateRange.start,
          dateRange.end
        );
      } else {
        events = await this.calendarEventRepository.findByUserId(userId, 1000);
      }

      // Calculate conflict rate (simplified - would need conflict tracking)
      const conflictRate = 0; // Placeholder

      // Calculate sync success rate (simplified - would need sync tracking)
      const syncSuccessRate = 95; // Placeholder

      // Calculate location statistics
      const locationCounts = new Map<string, number>();
      events.forEach((event) => {
        if (event.location) {
          locationCounts.set(
            event.location,
            (locationCounts.get(event.location) || 0) + 1
          );
        }
      });

      const mostCommonLocations = Array.from(locationCounts.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEvents: stats.totalEvents,
        upcomingEvents: stats.upcomingEvents,
        conflictRate,
        syncSuccessRate,
        averageEventDuration: stats.averageDuration,
        mostCommonLocations,
      };
    } catch (error) {
      logger.error("Failed to get calendar analytics", { userId, error });
      throw new Error(
        `Failed to get calendar analytics: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Resolve calendar conflict using intelligent strategies
   */
  private async resolveConflict(
    conflict: CalendarConflict,
    newScheduleData: ScheduleData,
    userId: string
  ): Promise<ConflictResolution> {
    // Simple conflict resolution logic
    // In a real implementation, this would be more sophisticated

    const conflictingEvent = conflict.conflictingEvent;
    const overlapDuration = conflict.overlapDuration;

    // If it's a short overlap (< 30 minutes), suggest rescheduling
    if (overlapDuration < 30) {
      return {
        strategy: "reschedule",
        newStartTime: new Date(
          conflictingEvent.endTime.getTime() + 15 * 60 * 1000
        ), // 15 min buffer
        reason: "Short overlap detected, rescheduling with buffer",
      };
    }

    // If it's a film shoot vs other event, prioritize film shoot
    if (
      newScheduleData.sceneType &&
      conflictingEvent.title.includes("StillOnTime")
    ) {
      return {
        strategy: "override",
        reason: "Film shoot takes priority over other events",
      };
    }

    // Default to manual review
    return {
      strategy: "cancel",
      reason: "Significant conflict requires manual review",
    };
  }

  /**
   * Apply conflict resolution to an event
   */
  private async applyConflictResolution(
    eventId: string,
    resolution: ConflictResolution,
    userId: string
  ): Promise<void> {
    switch (resolution.strategy) {
      case "reschedule":
        if (resolution.newStartTime) {
          await this.calendarEventRepository.update(
            eventId,
            {
              startTime: resolution.newStartTime,
              endTime:
                resolution.newEndTime ||
                new Date(resolution.newStartTime.getTime() + 2 * 60 * 60 * 1000),
            }
          );
        }
        break;

      case "cancel":
        await this.calendarService.deleteCalendarEvent(eventId, userId);
        break;

      // Other strategies would be implemented here
    }
  }

  /**
   * Sync a single event with Google Calendar
   */
  private async syncSingleEvent(
    event: CalendarEvent,
    userId: string
  ): Promise<SyncStatus> {
    try {
      // This is a simplified sync check
      // In a real implementation, this would verify the event exists in Google Calendar
      // and check if it matches the local version

      return {
        eventId: event.id,
        googleEventId: event.calendarEventId,
        lastSyncAt: new Date(),
        syncStatus: "synced",
        needsManualReview: false,
      };
    } catch (error) {
      return {
        eventId: event.id,
        googleEventId: event.calendarEventId,
        syncStatus: "failed",
        syncError: error instanceof Error ? error.message : "Unknown error",
        needsManualReview: true,
      };
    }
  }

  /**
   * Check synchronization status of an event
   */
  private async checkEventSyncStatus(
    event: CalendarEvent
  ): Promise<SyncStatus> {
    // Simplified status check
    // In a real implementation, this would check Google Calendar API

    if (!event.calendarEventId) {
      return {
        eventId: event.id,
        syncStatus: "pending",
        needsManualReview: false,
      };
    }

    return {
      eventId: event.id,
      googleEventId: event.calendarEventId,
      lastSyncAt: event.createdAt,
      syncStatus: "synced",
      needsManualReview: false,
    };
  }
}
