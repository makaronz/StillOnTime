import { google, calendar_v3 } from "googleapis";
import { OAuth2Service } from "./oauth2.service";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { logger } from "@/utils/logger";
import {
  CalendarEvent,
  ScheduleData,
  RoutePlan,
  WeatherData,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarConflict,
} from "@/types";

export interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  alarms: CalendarAlarm[];
  reminders: CalendarReminder[];
}

export interface CalendarAlarm {
  method: "popup" | "email" | "sms";
  minutes: number;
}

export interface CalendarReminder {
  method: "popup" | "email";
  minutes: number;
}

export interface BatchCalendarOperation {
  operation: "create" | "update" | "delete";
  eventData?: CalendarEventData;
  eventId?: string;
  localEventId?: string;
}

export interface BatchCalendarResult {
  successful: Array<{
    operation: BatchCalendarOperation;
    result: calendar_v3.Schema$Event;
    localEvent?: CalendarEvent;
  }>;
  failed: Array<{
    operation: BatchCalendarOperation;
    error: string;
  }>;
}

/**
 * Google Calendar API Service
 * Handles calendar event creation, management, and synchronization
 */
export class CalendarService {
  private oauth2Service: OAuth2Service;
  private calendarEventRepository: CalendarEventRepository;

  constructor(
    oauth2Service: OAuth2Service,
    calendarEventRepository: CalendarEventRepository
  ) {
    this.oauth2Service = oauth2Service;
    this.calendarEventRepository = calendarEventRepository;
  }

  /**
   * Create a comprehensive calendar event for a shooting schedule
   */
  async createCalendarEvent(
    scheduleData: ScheduleData,
    routePlan: RoutePlan,
    weather: WeatherData,
    userId: string
  ): Promise<CalendarEvent> {
    try {
      logger.info("Creating calendar event for schedule", {
        scheduleId: scheduleData.id,
        userId,
        shootingDate: scheduleData.shootingDate,
        location: scheduleData.location,
      });

      // Get authenticated Google Calendar client
      const auth = await this.oauth2Service.getGoogleClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      // Prepare event data
      const eventData = this.prepareEventData(scheduleData, routePlan, weather);

      // Check for conflicts
      const conflicts = await this.detectConflicts(
        userId,
        eventData.startTime,
        eventData.endTime
      );

      if (conflicts.length > 0) {
        logger.warn("Calendar conflicts detected", {
          scheduleId: scheduleData.id,
          conflictCount: conflicts.length,
          conflicts: conflicts.map((c) => ({
            eventId: c.conflictingEvent.id,
            title: c.conflictingEvent.title,
            overlapType: c.overlapType,
          })),
        });
      }

      // Create Google Calendar event
      const googleEvent = await this.createGoogleCalendarEvent(
        calendar,
        eventData
      );

      if (!googleEvent.id) {
        throw new Error("Google Calendar event created but no ID returned");
      }

      // Store in local database
      const localEvent = await this.calendarEventRepository.create({
        calendarEventId: googleEvent.id,
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        description: eventData.description,
        location: eventData.location,
        user: { connect: { id: userId } },
        schedule: { connect: { id: scheduleData.id } },
      });

      logger.info("Successfully created calendar event", {
        localEventId: localEvent.id,
        googleEventId: googleEvent.id,
        scheduleId: scheduleData.id,
        userId,
      });

      return localEvent;
    } catch (error) {
      logger.error("Failed to create calendar event", {
        scheduleId: scheduleData.id,
        userId,
        error,
      });
      throw new Error(
        `Failed to create calendar event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Set multiple alarms for wake-up time
   */
  async setMultipleAlarms(
    wakeUpTime: Date,
    userId: string,
    eventId?: string
  ): Promise<CalendarAlarm[]> {
    try {
      const alarms: CalendarAlarm[] = [
        { method: "popup", minutes: 10 }, // 10 minutes before wake-up
        { method: "popup", minutes: 0 }, // At wake-up time
        { method: "popup", minutes: -5 }, // 5 minutes after wake-up (snooze protection)
      ];

      logger.info("Setting multiple wake-up alarms", {
        wakeUpTime,
        userId,
        eventId,
        alarmCount: alarms.length,
      });

      return alarms;
    } catch (error) {
      logger.error("Failed to set multiple alarms", {
        wakeUpTime,
        userId,
        eventId,
        error,
      });
      throw new Error(
        `Failed to set wake-up alarms: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update existing calendar event
   */
  async updateCalendarEvent(
    eventId: string,
    scheduleData: Partial<ScheduleData>,
    routePlan?: RoutePlan,
    weather?: WeatherData,
    userId?: string
  ): Promise<CalendarEvent> {
    try {
      logger.info("Updating calendar event", { eventId, userId });

      // Get existing event
      const existingEvent = await this.calendarEventRepository.findById(
        eventId
      );
      if (!existingEvent) {
        throw new Error("Calendar event not found");
      }

      const actualUserId = userId || existingEvent.userId;

      // Get authenticated Google Calendar client
      const auth = await this.oauth2Service.getGoogleClient(actualUserId);
      const calendar = google.calendar({ version: "v3", auth });

      // Get full schedule data if partial update
      let fullScheduleData: ScheduleData;
      if (scheduleData.id) {
        // If we have the full schedule data
        fullScheduleData = scheduleData as ScheduleData;
      } else {
        // Need to fetch the full schedule data and merge
        const schedule = await this.getScheduleFromEvent(existingEvent);
        fullScheduleData = { ...schedule, ...scheduleData };
      }

      // Prepare updated event data
      const eventData = this.prepareEventData(
        fullScheduleData,
        routePlan,
        weather
      );

      // Update Google Calendar event
      const updatedGoogleEvent = await calendar.events.update({
        calendarId: "primary",
        eventId: existingEvent.calendarEventId,
        requestBody: this.buildGoogleEventRequest(eventData),
      });

      // Update local database
      const updatedLocalEvent = await this.calendarEventRepository.update(
        eventId,
        {
          title: eventData.title,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          description: eventData.description,
          location: eventData.location,
        }
      );

      logger.info("Successfully updated calendar event", {
        eventId,
        googleEventId: existingEvent.calendarEventId,
        userId: actualUserId,
      });

      return updatedLocalEvent;
    } catch (error) {
      logger.error("Failed to update calendar event", {
        eventId,
        userId,
        error,
      });
      throw new Error(
        `Failed to update calendar event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(eventId: string, userId: string): Promise<void> {
    try {
      logger.info("Deleting calendar event", { eventId, userId });

      // Get existing event
      const existingEvent = await this.calendarEventRepository.findById(
        eventId
      );
      if (!existingEvent) {
        throw new Error("Calendar event not found");
      }

      // Get authenticated Google Calendar client
      const auth = await this.oauth2Service.getGoogleClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      // Delete from Google Calendar
      await calendar.events.delete({
        calendarId: "primary",
        eventId: existingEvent.calendarEventId,
      });

      // Delete from local database
      await this.calendarEventRepository.delete(eventId);

      logger.info("Successfully deleted calendar event", {
        eventId,
        googleEventId: existingEvent.calendarEventId,
        userId,
      });
    } catch (error) {
      logger.error("Failed to delete calendar event", {
        eventId,
        userId,
        error,
      });
      throw new Error(
        `Failed to delete calendar event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Detect calendar conflicts for a given time range
   */
  async detectConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarConflict[]> {
    try {
      const conflictingEvents =
        await this.calendarEventRepository.findConflictingEvents(
          userId,
          startTime,
          endTime,
          excludeEventId
        );

      return conflictingEvents.map((event) => {
        const overlapStart = new Date(
          Math.max(startTime.getTime(), event.startTime.getTime())
        );
        const overlapEnd = new Date(
          Math.min(endTime.getTime(), event.endTime.getTime())
        );
        const overlapDuration =
          Math.max(0, overlapEnd.getTime() - overlapStart.getTime()) /
          (1000 * 60);

        let overlapType: "partial" | "complete" | "encompasses";
        if (event.startTime <= startTime && event.endTime >= endTime) {
          overlapType = "encompasses";
        } else if (event.startTime >= startTime && event.endTime <= endTime) {
          overlapType = "complete";
        } else {
          overlapType = "partial";
        }

        return {
          conflictingEvent: event,
          overlapType,
          overlapDuration,
          type: "time_overlap",
          conflictingData: {
            originalStartTime: startTime,
            originalEndTime: endTime,
            conflictStartTime: event.startTime,
            conflictEndTime: event.endTime,
          },
          severity:
            overlapDuration > 60
              ? "high"
              : overlapDuration > 30
              ? "medium"
              : "low",
          suggestedResolution:
            overlapType === "encompasses"
              ? "Consider rescheduling the new event to avoid complete overlap"
              : overlapType === "complete"
              ? "The conflicting event is completely within the new event timeframe"
              : "Partial overlap detected - consider adjusting start or end times",
        };
      });
    } catch (error) {
      logger.error("Failed to detect calendar conflicts", {
        userId,
        startTime,
        endTime,
        error,
      });
      throw new Error(
        `Failed to detect calendar conflicts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Perform batch calendar operations
   */
  async performBatchOperations(
    operations: BatchCalendarOperation[],
    userId: string
  ): Promise<BatchCalendarResult> {
    const result: BatchCalendarResult = {
      successful: [],
      failed: [],
    };

    logger.info("Performing batch calendar operations", {
      userId,
      operationCount: operations.length,
    });

    // Get authenticated Google Calendar client
    const auth = await this.oauth2Service.getGoogleClient(userId);
    const calendar = google.calendar({ version: "v3", auth });

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case "create":
            if (!operation.eventData) {
              throw new Error("Event data required for create operation");
            }
            const createdEvent = await this.createGoogleCalendarEvent(
              calendar,
              operation.eventData
            );
            result.successful.push({
              operation,
              result: createdEvent,
            });
            break;

          case "update":
            if (!operation.eventId || !operation.eventData) {
              throw new Error(
                "Event ID and data required for update operation"
              );
            }
            const updatedEvent = await calendar.events.update({
              calendarId: "primary",
              eventId: operation.eventId,
              requestBody: this.buildGoogleEventRequest(operation.eventData),
            });
            result.successful.push({
              operation,
              result: updatedEvent.data,
            });
            break;

          case "delete":
            if (!operation.eventId) {
              throw new Error("Event ID required for delete operation");
            }
            await calendar.events.delete({
              calendarId: "primary",
              eventId: operation.eventId,
            });
            result.successful.push({
              operation,
              result: { id: operation.eventId } as calendar_v3.Schema$Event,
            });
            break;
        }
      } catch (error) {
        logger.error("Batch operation failed", {
          operation: operation.operation,
          eventId: operation.eventId,
          error,
        });
        result.failed.push({
          operation,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info("Completed batch calendar operations", {
      userId,
      successful: result.successful.length,
      failed: result.failed.length,
    });

    return result;
  }

  /**
   * Prepare event data from schedule, route, and weather information
   */
  private prepareEventData(
    scheduleData: ScheduleData,
    routePlan?: RoutePlan,
    weather?: WeatherData
  ): CalendarEventData {
    const title = `StillOnTime — Shooting Day (${scheduleData.location})`;

    // Calculate event times
    const departureTime =
      routePlan?.departureTime || new Date(scheduleData.shootingDate);
    const callTime = new Date(scheduleData.shootingDate);
    const [hours, minutes] = scheduleData.callTime.split(":").map(Number);
    callTime.setHours(hours, minutes, 0, 0);

    // Event duration: departure time to call_time + 10 hours
    const endTime = new Date(callTime.getTime() + 10 * 60 * 60 * 1000);

    const description = this.createEventDescription(
      scheduleData,
      routePlan,
      weather
    );

    // Set up alarms and reminders
    const alarms: CalendarAlarm[] = [];
    const reminders: CalendarReminder[] = [];

    if (routePlan?.wakeUpTime) {
      // Wake-up alarms
      alarms.push(
        {
          method: "popup",
          minutes:
            this.getMinutesBefore(routePlan.wakeUpTime, departureTime) + 10,
        },
        {
          method: "popup",
          minutes: this.getMinutesBefore(routePlan.wakeUpTime, departureTime),
        },
        {
          method: "popup",
          minutes:
            this.getMinutesBefore(routePlan.wakeUpTime, departureTime) - 5,
        }
      );
    }

    // Standard reminders
    reminders.push(
      { method: "popup", minutes: 12 * 60 }, // 12 hours before
      { method: "popup", minutes: 3 * 60 }, // 3 hours before
      { method: "popup", minutes: 60 }, // 1 hour before
      {
        method: "popup",
        minutes: this.getMinutesBefore(departureTime, departureTime),
      } // At departure time
    );

    return {
      title,
      description,
      location: scheduleData.location,
      startTime: departureTime,
      endTime,
      alarms,
      reminders,
    };
  }

  /**
   * Create comprehensive event description
   */
  private createEventDescription(
    scheduleData: ScheduleData,
    routePlan?: RoutePlan,
    weather?: WeatherData
  ): string {
    const sections: string[] = [];

    // Basic information
    sections.push("🎬 SHOOTING DAY");
    sections.push(
      `📅 Date: ${scheduleData.shootingDate.toLocaleDateString("en-US")}`
    );
    sections.push(`⏰ Call Time: ${scheduleData.callTime}`);
    sections.push(`📍 Lokacja: ${scheduleData.location}`);
    sections.push(`🎭 Typ sceny: ${scheduleData.sceneType}`);

    if (scheduleData.scenes && Array.isArray(scheduleData.scenes)) {
      sections.push(`🎞️ Sceny: ${scheduleData.scenes.join(", ")}`);
    }

    // Route information
    if (routePlan) {
      sections.push("");
      sections.push("🚗 TRAVEL PLAN");
      sections.push(
        `⏰ Wake up: ${routePlan.wakeUpTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
      sections.push(
        `🚪 Departure: ${routePlan.departureTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
      sections.push(
        `🎯 Arrival: ${routePlan.arrivalTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
      sections.push(`⏱️ Czas podróży: ${routePlan.totalTravelMinutes} minut`);
    }

    // Weather information
    if (weather) {
      sections.push("");
      sections.push("🌤️ PROGNOZA POGODY");
      if (weather.temperature !== null) {
        sections.push(`🌡️ Temperatura: ${weather.temperature}°C`);
      }
      if (weather.description) {
        sections.push(`☁️ Warunki: ${weather.description}`);
      }
      if (weather.windSpeed !== null) {
        sections.push(`💨 Wiatr: ${weather.windSpeed} m/s`);
      }
      if (weather.precipitation !== null && weather.precipitation > 0) {
        sections.push(`🌧️ Opady: ${weather.precipitation} mm`);
      }
      if (
        weather.warnings &&
        Array.isArray(weather.warnings) &&
        weather.warnings.length > 0
      ) {
        sections.push("⚠️ OSTRZEŻENIA:");
        weather.warnings.forEach((warning) => sections.push(`• ${warning}`));
      }
    }

    // Safety and additional notes
    if (scheduleData.safetyNotes) {
      sections.push("");
      sections.push("⚠️ UWAGI BEZPIECZEŃSTWA");
      sections.push(scheduleData.safetyNotes);
    }

    // Contact information
    if (scheduleData.contacts && Array.isArray(scheduleData.contacts)) {
      sections.push("");
      sections.push("📞 KONTAKTY");
      scheduleData.contacts.forEach((contact) => {
        if (
          typeof contact === "object" &&
          contact !== null &&
          !Array.isArray(contact)
        ) {
          const contactObj = contact as {
            name?: string;
            role?: string;
            phone?: string;
          };
          if (contactObj.name) {
            let contactLine = `• ${contactObj.name}`;
            if (contactObj.role) contactLine += ` (${contactObj.role})`;
            if (contactObj.phone) contactLine += ` - ${contactObj.phone}`;
            sections.push(contactLine);
          }
        }
      });
    }

    // Equipment list
    if (scheduleData.equipment && Array.isArray(scheduleData.equipment)) {
      sections.push("");
      sections.push("🎥 SPRZĘT");
      scheduleData.equipment.forEach((item) => sections.push(`• ${item}`));
    }

    // Additional notes
    if (scheduleData.notes) {
      sections.push("");
      sections.push("📝 DODATKOWE UWAGI");
      sections.push(scheduleData.notes);
    }

    sections.push("");
    sections.push("🤖 Automatycznie wygenerowane przez StillOnTime");

    return sections.join("\n");
  }

  /**
   * Create Google Calendar event
   */
  private async createGoogleCalendarEvent(
    calendar: calendar_v3.Calendar,
    eventData: CalendarEventData
  ): Promise<calendar_v3.Schema$Event> {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: this.buildGoogleEventRequest(eventData),
    });

    if (!response.data) {
      throw new Error("No data returned from Google Calendar API");
    }

    return response.data;
  }

  /**
   * Build Google Calendar event request
   */
  private buildGoogleEventRequest(
    eventData: CalendarEventData
  ): calendar_v3.Schema$Event {
    const reminders = {
      useDefault: false,
      overrides: [
        ...eventData.alarms.map((alarm) => ({
          method: alarm.method as "popup" | "email",
          minutes: alarm.minutes,
        })),
        ...eventData.reminders.map((reminder) => ({
          method: reminder.method as "popup" | "email",
          minutes: reminder.minutes,
        })),
      ],
    };

    return {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: "Europe/Warsaw",
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: "Europe/Warsaw",
      },
      reminders,
      colorId: "9", // Blue color for film shoots
    };
  }

  /**
   * Get minutes between two dates
   */
  private getMinutesBefore(fromTime: Date, toTime: Date): number {
    return Math.floor((toTime.getTime() - fromTime.getTime()) / (1000 * 60));
  }

  /**
   * Get schedule data from existing calendar event
   */
  private async getScheduleFromEvent(
    event: CalendarEvent
  ): Promise<ScheduleData> {
    // This would typically fetch the related schedule data
    // For now, we'll throw an error if we can't get the full schedule
    throw new Error("Cannot update event without full schedule data");
  }
}
