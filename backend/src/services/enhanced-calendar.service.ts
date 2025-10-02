import { google, calendar_v3 } from "googleapis";
import ical from "ical-generator";
import moment from "moment-timezone";
import { OAuth2Service } from "./oauth2.service";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { logger } from "@/utils/logger";
import {
  CalendarEvent,
  ScheduleData,
  RoutePlan,
  WeatherData,
  CreateCalendarEventInput,
  CalendarConflict,
} from "@/types";
import {
  CalendarService,
  CalendarEventData,
  CalendarAlarm,
  CalendarReminder,
  BatchCalendarOperation,
  BatchCalendarResult,
} from "./calendar.service";
import fs from "fs/promises";
import path from "path";

export interface EnhancedCalendarOptions {
  generateICSFile: boolean;
  includeCrewInvites: boolean;
  enableTimezoneIntelligence: boolean;
  optimizeScheduleTiming: boolean;
  addWeatherAlerts: boolean;
  includeRouteInstructions: boolean;
}

export interface TimezoneAnalysis {
  userTimezone: string;
  locationTimezone: string;
  timezoneOffset: number; // hours difference
  daylightSavingChanges: {
    upcoming: boolean;
    date?: Date;
    timeChange: number; // hours
  };
  recommendations: string[];
}

export interface ScheduleOptimization {
  suggestedCallTime: string;
  originalCallTime: string;
  optimizationReasons: string[];
  efficiencyGain: number; // percentage
  lightingAnalysis: {
    sunrise: Date;
    sunset: Date;
    goldenHour: { start: Date; end: Date };
    blueHour: { start: Date; end: Date };
    recommendations: string[];
  };
  trafficAnalysis: {
    peakHours: string[];
    recommendedDeparture: Date;
    trafficScore: number; // 0-1, 1 being best
  };
}

export interface CrewDistribution {
  totalInvitesSent: number;
  deliveryMethods: {
    email: number;
    ics: number;
    mobile: number;
  };
  responses: {
    accepted: number;
    declined: number;
    pending: number;
  };
  conflictingMembers: Array<{
    name: string;
    email: string;
    conflict: string;
  }>;
}

/**
 * Enhanced Calendar Service with modern capabilities
 * Provides cross-platform calendar files, timezone intelligence, and crew distribution
 */
export class EnhancedCalendarService extends CalendarService {
  private icsDirectory: string;

  constructor(
    oauth2Service: OAuth2Service,
    calendarEventRepository: CalendarEventRepository
  ) {
    super(oauth2Service, calendarEventRepository);
    this.icsDirectory = path.join(process.cwd(), "storage", "calendar");
    this.ensureICSDirectory();
  }

  /**
   * Create enhanced calendar event with all modern features
   */
  async createEnhancedCalendarEvent(
    scheduleData: ScheduleData,
    routePlan: RoutePlan,
    weather: WeatherData,
    userId: string,
    options: Partial<EnhancedCalendarOptions> = {}
  ): Promise<{
    calendarEvent: CalendarEvent;
    icsFile?: string;
    timezoneAnalysis?: TimezoneAnalysis;
    scheduleOptimization?: ScheduleOptimization;
    crewDistribution?: CrewDistribution;
  }> {
    try {
      logger.info("Creating enhanced calendar event", {
        scheduleId: scheduleData.id,
        userId,
        options,
      });

      // Phase 1: Timezone Analysis
      let timezoneAnalysis: TimezoneAnalysis | undefined;
      if (options.enableTimezoneIntelligence) {
        timezoneAnalysis = await this.analyzeTimezone(scheduleData, userId);
      }

      // Phase 2: Schedule Optimization
      let scheduleOptimization: ScheduleOptimization | undefined;
      if (options.optimizeScheduleTiming) {
        scheduleOptimization = await this.optimizeScheduleTiming(scheduleData, routePlan);
      }

      // Phase 3: Create base calendar event
      const calendarEvent = await super.createCalendarEvent(
        scheduleData,
        routePlan,
        weather,
        userId
      );

      // Phase 4: Generate ICS file for cross-platform compatibility
      let icsFile: string | undefined;
      if (options.generateICSFile) {
        icsFile = await this.generateEnhancedICSFile(
          scheduleData,
          routePlan,
          weather,
          timezoneAnalysis,
          options
        );
      }

      // Phase 5: Crew distribution and invites
      let crewDistribution: CrewDistribution | undefined;
      if (options.includeCrewInvites && scheduleData.contacts) {
        crewDistribution = await this.distributeToCrewMembers(
          scheduleData,
          icsFile,
          calendarEvent
        );
      }

      logger.info("Enhanced calendar event created successfully", {
        eventId: calendarEvent.id,
        icsGenerated: !!icsFile,
        timezoneAnalyzed: !!timezoneAnalysis,
        optimized: !!scheduleOptimization,
        crewInvited: !!crewDistribution,
      });

      return {
        calendarEvent,
        icsFile,
        timezoneAnalysis,
        scheduleOptimization,
        crewDistribution,
      };
    } catch (error) {
      logger.error("Enhanced calendar event creation failed", {
        scheduleId: scheduleData.id,
        userId,
        error,
      });
      throw new Error(
        `Enhanced calendar event creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Analyze timezone implications for the schedule
   */
  private async analyzeTimezone(
    scheduleData: ScheduleData,
    userId: string
  ): Promise<TimezoneAnalysis> {
    try {
      // For Poland-based production, assume user timezone
      const userTimezone = "Europe/Warsaw";
      const locationTimezone = this.detectLocationTimezone(scheduleData.location);
      
      const scheduleDate = moment.tz(scheduleData.shootingDate, userTimezone);
      const timezoneOffset = moment.tz(locationTimezone).utcOffset() - moment.tz(userTimezone).utcOffset();

      // Check for upcoming daylight saving changes
      const daylightSavingChanges = this.checkDaylightSavingChanges(scheduleDate, userTimezone);

      const recommendations: string[] = [];

      if (timezoneOffset !== 0) {
        recommendations.push(
          `Location timezone differs by ${Math.abs(timezoneOffset / 60)} hours - verify all times`
        );
      }

      if (daylightSavingChanges.upcoming) {
        recommendations.push(
          `Daylight saving time change on ${daylightSavingChanges.date?.toLocaleDateString()} - verify schedule times`
        );
      }

      // Add general timezone recommendations
      if (scheduleDate.hour() < 6) {
        recommendations.push("Very early start time - consider crew timezone preferences");
      }

      return {
        userTimezone,
        locationTimezone,
        timezoneOffset,
        daylightSavingChanges,
        recommendations,
      };
    } catch (error) {
      logger.warn("Timezone analysis failed", { error });
      return {
        userTimezone: "Europe/Warsaw",
        locationTimezone: "Europe/Warsaw",
        timezoneOffset: 0,
        daylightSavingChanges: { upcoming: false, timeChange: 0 },
        recommendations: [],
      };
    }
  }

  /**
   * Optimize schedule timing based on multiple factors
   */
  private async optimizeScheduleTiming(
    scheduleData: ScheduleData,
    routePlan: RoutePlan
  ): Promise<ScheduleOptimization> {
    try {
      const scheduleDate = moment(scheduleData.shootingDate);
      const originalCallTime = scheduleData.callTime;

      // Lighting analysis
      const lightingAnalysis = await this.analyzeLightingConditions(scheduleDate, scheduleData);

      // Traffic analysis
      const trafficAnalysis = await this.analyzeTrafficPatterns(scheduleDate, routePlan);

      // Generate optimization recommendations
      const optimizationReasons: string[] = [];
      let suggestedCallTime = originalCallTime;
      let efficiencyGain = 0;

      // Optimize for lighting (if exterior scene)
      if (scheduleData.sceneType === "EXT") {
        const goldenHourStart = lightingAnalysis.goldenHour.start;
        const recommendedTime = moment(goldenHourStart).format("HH:mm");
        
        if (recommendedTime !== originalCallTime) {
          optimizationReasons.push("Adjusted for optimal golden hour lighting");
          suggestedCallTime = recommendedTime;
          efficiencyGain += 0.15; // 15% improvement for better lighting
        }
      }

      // Optimize for traffic
      if (trafficAnalysis.trafficScore < 0.7) {
        const betterTime = moment(trafficAnalysis.recommendedDeparture)
          .add(routePlan.totalTravelMinutes, "minutes")
          .format("HH:mm");
        
        if (betterTime !== suggestedCallTime) {
          optimizationReasons.push("Adjusted to avoid peak traffic");
          suggestedCallTime = betterTime;
          efficiencyGain += 0.10; // 10% improvement for traffic avoidance
        }
      }

      // Crew efficiency optimization
      const callHour = parseInt(originalCallTime.split(":")[0]);
      if (callHour < 6 || callHour > 20) {
        optimizationReasons.push("Consider crew productivity during standard hours");
        if (callHour < 6) {
          suggestedCallTime = "06:00";
          efficiencyGain += 0.05; // 5% improvement for crew alertness
        }
      }

      return {
        suggestedCallTime,
        originalCallTime,
        optimizationReasons,
        efficiencyGain: Math.min(efficiencyGain, 0.3), // Cap at 30%
        lightingAnalysis,
        trafficAnalysis,
      };
    } catch (error) {
      logger.warn("Schedule optimization failed", { error });
      return {
        suggestedCallTime: scheduleData.callTime,
        originalCallTime: scheduleData.callTime,
        optimizationReasons: [],
        efficiencyGain: 0,
        lightingAnalysis: {
          sunrise: new Date(),
          sunset: new Date(),
          goldenHour: { start: new Date(), end: new Date() },
          blueHour: { start: new Date(), end: new Date() },
          recommendations: [],
        },
        trafficAnalysis: {
          peakHours: [],
          recommendedDeparture: new Date(),
          trafficScore: 0.7,
        },
      };
    }
  }

  /**
   * Generate enhanced ICS file with comprehensive event data
   */
  private async generateEnhancedICSFile(
    scheduleData: ScheduleData,
    routePlan: RoutePlan,
    weather: WeatherData,
    timezoneAnalysis?: TimezoneAnalysis,
    options: Partial<EnhancedCalendarOptions> = {}
  ): Promise<string> {
    try {
      const timezone = timezoneAnalysis?.userTimezone || "Europe/Warsaw";
      
      // Create calendar instance
      const calendar = ical({
        name: "StillOnTime Production Schedule",
        timezone: timezone,
        description: "Film production schedule generated by StillOnTime",
        url: "https://stillontime.com",
        prodId: "//StillOnTime//StillOnTime Calendar//EN",
      });

      // Calculate event times
      const startTime = moment.tz(routePlan.departureTime, timezone);
      const endTime = moment.tz(routePlan.arrivalTime, timezone).add(10, "hours");

      // Create main shooting event
      const event = calendar.createEvent({
        start: startTime.toDate(),
        end: endTime.toDate(),
        summary: `🎬 StillOnTime — ${scheduleData.location}`,
        description: this.createEnhancedEventDescription(
          scheduleData,
          routePlan,
          weather,
          timezoneAnalysis,
          options
        ),
        location: scheduleData.location,
        url: `https://stillontime.com/schedule/${scheduleData.id}`,
        organizer: {
          name: "StillOnTime",
          email: "noreply@stillontime.com",
        },
        categories: [
          { name: "Film Production" },
          { name: "StillOnTime" },
          { name: scheduleData.sceneType || "Production" },
        ],
        status: "confirmed" as any,
        transparency: "opaque" as any,
        priority: 5, // Normal priority
      });

      // Add wake-up alarm
      if (routePlan.wakeUpTime) {
        event.createAlarm({
          type: "display" as any,
          trigger: moment.tz(routePlan.wakeUpTime, timezone).toDate(),
          description: "🌅 Wake up for shooting day!",
        });
      }

      // Add departure alarm
      event.createAlarm({
        type: "display" as any,
        trigger: startTime.toDate(),
        description: "🚗 Time to leave for location!",
      });

      // Add arrival reminder
      event.createAlarm({
        type: "display" as any,
        trigger: moment.tz(routePlan.arrivalTime, timezone).subtract(15, "minutes").toDate(),
        description: "📍 Arriving at location in 15 minutes",
      });

      // Add weather alerts if severe conditions
      if (options.addWeatherAlerts && weather.warnings && Array.isArray(weather.warnings) && weather.warnings.length > 0) {
        event.createAlarm({
          type: "display" as any,
          trigger: startTime.subtract(2, "hours").toDate(),
          description: `⚠️ Weather Alert: ${weather.warnings.join(", ")}`,
        });
      }

      // Create separate prep event
      const prepEvent = calendar.createEvent({
        start: moment.tz(routePlan.wakeUpTime, timezone).toDate(),
        end: startTime.toDate(),
        summary: "🛠️ StillOnTime — Morning Preparation",
        description: this.createPrepEventDescription(routePlan, scheduleData),
        categories: [{ name: "Preparation" }, { name: "StillOnTime" }],
        status: "confirmed" as any,
      });

      // Add equipment pickup reminder (if using Panavision)
      if (scheduleData.equipment && Array.isArray(scheduleData.equipment) && scheduleData.equipment.length > 0) {
        const equipmentEvent = calendar.createEvent({
          start: startTime.add(30, "minutes").toDate(),
          end: startTime.add(45, "minutes").toDate(),
          summary: "📦 Equipment Pickup - Panavision",
          description: `Equipment needed:\n${scheduleData.equipment.join("\n")}`,
          location: "Panavision", // Would be from user config
          categories: [{ name: "Equipment" }, { name: "StillOnTime" }],
        });
      }

      // Generate ICS content
      const icsContent = calendar.toString();
      
      // Save to file
      const filename = `stillontime-${scheduleData.id}-${Date.now()}.ics`;
      const filepath = path.join(this.icsDirectory, filename);
      
      await fs.writeFile(filepath, icsContent, "utf8");

      logger.info("Enhanced ICS file generated", {
        filename,
        scheduleId: scheduleData.id,
        eventsCreated: calendar.events().length,
        timezone,
      });

      return filepath;
    } catch (error) {
      logger.error("ICS file generation failed", { error });
      throw new Error(`ICS file generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Distribute calendar to crew members
   */
  private async distributeToCrewMembers(
    scheduleData: ScheduleData,
    icsFilePath?: string,
    calendarEvent?: CalendarEvent
  ): Promise<CrewDistribution> {
    try {
      const crew = Array.isArray(scheduleData.contacts) ? scheduleData.contacts : [];
      
      if (crew.length === 0) {
        return {
          totalInvitesSent: 0,
          deliveryMethods: { email: 0, ics: 0, mobile: 0 },
          responses: { accepted: 0, declined: 0, pending: 0 },
          conflictingMembers: [],
        };
      }

      let emailInvites = 0;
      let icsDeliveries = 0;
      let mobileInvites = 0;
      const conflictingMembers: any[] = [];

      // Process each crew member
      for (const member of crew) {
        try {
          if (typeof member === "object" && member !== null && !Array.isArray(member)) {
            const contact = member as { name?: string; email?: string; phone?: string; role?: string };
            
            if (contact.email) {
              await this.sendEmailInvite(contact, scheduleData, icsFilePath);
              emailInvites++;
              
              if (icsFilePath) {
                icsDeliveries++;
              }
            }

            if (contact.phone) {
              await this.sendMobileNotification(contact, scheduleData);
              mobileInvites++;
            }
          }
        } catch (error) {
          logger.warn("Failed to invite crew member", { member, error });
          if (typeof member === "object" && member !== null) {
            const contact = member as { name?: string; email?: string };
            conflictingMembers.push({
              name: contact.name || "Unknown",
              email: contact.email || "No email",
              conflict: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      return {
        totalInvitesSent: emailInvites + mobileInvites,
        deliveryMethods: {
          email: emailInvites,
          ics: icsDeliveries,
          mobile: mobileInvites,
        },
        responses: {
          accepted: 0, // Would be updated from actual responses
          declined: 0,
          pending: emailInvites + mobileInvites,
        },
        conflictingMembers,
      };
    } catch (error) {
      logger.error("Crew distribution failed", { error });
      throw new Error(`Crew distribution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Create enhanced event description with all details
   */
  private createEnhancedEventDescription(
    scheduleData: ScheduleData,
    routePlan: RoutePlan,
    weather: WeatherData,
    timezoneAnalysis?: TimezoneAnalysis,
    options: Partial<EnhancedCalendarOptions> = {}
  ): string {
    const sections: string[] = [];

    // Header
    sections.push("🎬 STILLONTIME SHOOTING SCHEDULE");
    sections.push("=".repeat(40));

    // Basic information
    sections.push("📅 SCHEDULE DETAILS");
    sections.push(`Date: ${scheduleData.shootingDate.toLocaleDateString("en-US", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    })}`);
    sections.push(`📍 Location: ${scheduleData.location}`);
    sections.push(`🎭 Scene Type: ${scheduleData.sceneType}`);
    sections.push(`⏰ Call Time: ${scheduleData.callTime}`);
    
    if (scheduleData.scenes && Array.isArray(scheduleData.scenes)) {
      sections.push(`🎞️ Scenes: ${scheduleData.scenes.join(", ")}`);
    }

    // Enhanced timing information
    sections.push("");
    sections.push("⏰ ENHANCED TIMING");
    sections.push(`🌅 Wake Up: ${routePlan.wakeUpTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
    sections.push(`🚪 Departure: ${routePlan.departureTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
    sections.push(`🎯 Arrival: ${routePlan.arrivalTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
    sections.push(`⏱️ Total Travel Time: ${routePlan.totalTravelMinutes} minutes`);

    // Timezone information
    if (timezoneAnalysis) {
      sections.push("");
      sections.push("🌍 TIMEZONE INFORMATION");
      sections.push(`User Timezone: ${timezoneAnalysis.userTimezone}`);
      sections.push(`Location Timezone: ${timezoneAnalysis.locationTimezone}`);
      
      if (timezoneAnalysis.recommendations.length > 0) {
        sections.push("⚠️ Timezone Warnings:");
        timezoneAnalysis.recommendations.forEach(rec => sections.push(`• ${rec}`));
      }
    }

    // Route instructions (if enabled)
    if (options.includeRouteInstructions) {
      sections.push("");
      sections.push("🗺️ ROUTE INSTRUCTIONS");
      sections.push("1. Home → Panavision (Equipment Pickup)");
      sections.push("2. Panavision → Shooting Location");
      sections.push("📱 Full directions: https://stillontime.com/route/" + scheduleData.id);
    }

    // Weather information (enhanced)
    sections.push("");
    sections.push("🌤️ WEATHER FORECAST");
    if (weather.temperature !== null) {
      sections.push(`🌡️ Temperature: ${weather.temperature}°C`);
    }
    if (weather.description) {
      sections.push(`☁️ Conditions: ${weather.description}`);
    }
    if (weather.windSpeed !== null) {
      sections.push(`💨 Wind: ${weather.windSpeed} m/s`);
    }
    if (weather.precipitation !== null && weather.precipitation > 0) {
      sections.push(`🌧️ Precipitation: ${weather.precipitation} mm`);
    }
    
    // Weather warnings
    if (weather.warnings && Array.isArray(weather.warnings) && weather.warnings.length > 0) {
      sections.push("⚠️ WEATHER ALERTS:");
      weather.warnings.forEach((warning) => sections.push(`• ${warning}`));
    }

    // Equipment list
    if (scheduleData.equipment && Array.isArray(scheduleData.equipment)) {
      sections.push("");
      sections.push("🎥 EQUIPMENT CHECKLIST");
      scheduleData.equipment.forEach((item) => sections.push(`• ${item}`));
    }

    // Contact information
    if (scheduleData.contacts && Array.isArray(scheduleData.contacts)) {
      sections.push("");
      sections.push("📞 KEY CONTACTS");
      scheduleData.contacts.forEach((contact) => {
        if (typeof contact === "object" && contact !== null && !Array.isArray(contact)) {
          const contactObj = contact as { name?: string; role?: string; phone?: string };
          if (contactObj.name) {
            let contactLine = `• ${contactObj.name}`;
            if (contactObj.role) contactLine += ` (${contactObj.role})`;
            if (contactObj.phone) contactLine += ` - ${contactObj.phone}`;
            sections.push(contactLine);
          }
        }
      });
    }

    // Safety notes
    if (scheduleData.safetyNotes) {
      sections.push("");
      sections.push("⚠️ SAFETY NOTES");
      sections.push(scheduleData.safetyNotes);
    }

    // Additional notes
    if (scheduleData.notes) {
      sections.push("");
      sections.push("📝 ADDITIONAL NOTES");
      sections.push(scheduleData.notes);
    }

    // Footer
    sections.push("");
    sections.push("🤖 Generated by StillOnTime");
    sections.push("📱 App: https://stillontime.com");
    sections.push(`🆔 Schedule ID: ${scheduleData.id}`);

    return sections.join("\n");
  }

  /**
   * Create preparation event description
   */
  private createPrepEventDescription(routePlan: RoutePlan, scheduleData: ScheduleData): string {
    const sections: string[] = [];

    sections.push("🛠️ MORNING PREPARATION CHECKLIST");
    sections.push("");
    sections.push("⏰ Timeline:");
    sections.push(`🌅 Wake up: ${routePlan.wakeUpTime.toLocaleTimeString()}`);
    sections.push(`🚿 Personal prep: 30 minutes`);
    sections.push(`☕ Breakfast: 15 minutes`);
    sections.push(`📋 Equipment check: 15 minutes`);
    sections.push(`🚗 Departure: ${routePlan.departureTime.toLocaleTimeString()}`);
    sections.push("");
    sections.push("📋 Pre-departure checklist:");
    sections.push("• Personal items (ID, wallet, phone)");
    sections.push("• Weather-appropriate clothing");
    sections.push("• Shooting schedule and call sheet");
    sections.push("• Equipment list verification");
    sections.push("• Vehicle fuel and condition check");
    sections.push("• Emergency contact information");

    return sections.join("\n");
  }

  /**
   * Detect timezone for location (simplified implementation)
   */
  private detectLocationTimezone(location: string): string {
    // Simplified - in production would use geocoding + timezone API
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes("warsaw") || locationLower.includes("warszawa")) {
      return "Europe/Warsaw";
    }
    if (locationLower.includes("krakow") || locationLower.includes("kraków")) {
      return "Europe/Warsaw";
    }
    if (locationLower.includes("gdansk") || locationLower.includes("gdańsk")) {
      return "Europe/Warsaw";
    }
    
    // Default to Poland timezone
    return "Europe/Warsaw";
  }

  /**
   * Check for upcoming daylight saving changes
   */
  private checkDaylightSavingChanges(
    scheduleDate: moment.Moment,
    timezone: string
  ): { upcoming: boolean; date?: Date; timeChange: number } {
    // Check if there's a DST change within 7 days
    const weekLater = scheduleDate.clone().add(7, "days");
    const currentOffset = scheduleDate.utcOffset();
    const weekLaterOffset = weekLater.utcOffset();
    
    if (currentOffset !== weekLaterOffset) {
      // Find the exact date of change
      for (let i = 1; i <= 7; i++) {
        const checkDate = scheduleDate.clone().add(i, "days");
        if (checkDate.utcOffset() !== currentOffset) {
          return {
            upcoming: true,
            date: checkDate.toDate(),
            timeChange: (weekLaterOffset - currentOffset) / 60, // Convert to hours
          };
        }
      }
    }

    return { upcoming: false, timeChange: 0 };
  }

  /**
   * Analyze lighting conditions for the shoot
   */
  private async analyzeLightingConditions(
    scheduleDate: moment.Moment,
    scheduleData: ScheduleData
  ): Promise<{
    sunrise: Date;
    sunset: Date;
    goldenHour: { start: Date; end: Date };
    blueHour: { start: Date; end: Date };
    recommendations: string[];
  }> {
    // Simplified calculation - in production would use astronomical calculations
    const sunrise = scheduleDate.clone().hour(6).minute(30).toDate();
    const sunset = scheduleDate.clone().hour(19).minute(30).toDate();
    
    // Golden hour: 1 hour after sunrise, 1 hour before sunset
    const goldenHourMorning = { 
      start: moment(sunrise).toDate(), 
      end: moment(sunrise).add(1, "hour").toDate() 
    };
    const goldenHourEvening = { 
      start: moment(sunset).subtract(1, "hour").toDate(), 
      end: moment(sunset).toDate() 
    };
    
    // Blue hour: 30 minutes before sunrise, 30 minutes after sunset
    const blueHour = { 
      start: moment(sunrise).subtract(30, "minutes").toDate(), 
      end: moment(sunset).add(30, "minutes").toDate() 
    };

    const recommendations: string[] = [];
    
    if (scheduleData.sceneType === "EXT") {
      recommendations.push("Exterior scene - consider golden hour timing for best lighting");
      recommendations.push(`Golden hour: ${moment(goldenHourMorning.start).format("HH:mm")}-${moment(goldenHourMorning.end).format("HH:mm")} and ${moment(goldenHourEvening.start).format("HH:mm")}-${moment(goldenHourEvening.end).format("HH:mm")}`);
    }

    return {
      sunrise,
      sunset,
      goldenHour: goldenHourMorning, // Return morning golden hour
      blueHour,
      recommendations,
    };
  }

  /**
   * Analyze traffic patterns for optimal timing
   */
  private async analyzeTrafficPatterns(
    scheduleDate: moment.Moment,
    routePlan: RoutePlan
  ): Promise<{
    peakHours: string[];
    recommendedDeparture: Date;
    trafficScore: number;
  }> {
    // Simplified traffic analysis
    const dayOfWeek = scheduleDate.day();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    const peakHours = isWeekday 
      ? ["07:00-09:00", "16:00-19:00"]
      : ["10:00-12:00", "15:00-17:00"];

    const departureHour = moment(routePlan.departureTime).hour();
    let trafficScore = 1.0;

    // Reduce score for peak hours
    if (isWeekday && ((departureHour >= 7 && departureHour <= 9) || (departureHour >= 16 && departureHour <= 19))) {
      trafficScore = 0.4;
    } else if (!isWeekday && ((departureHour >= 10 && departureHour <= 12) || (departureHour >= 15 && departureHour <= 17))) {
      trafficScore = 0.6;
    }

    // Recommend departure 30 minutes earlier if in peak hours
    const recommendedDeparture = trafficScore < 0.7 
      ? moment(routePlan.departureTime).subtract(30, "minutes").toDate()
      : routePlan.departureTime;

    return {
      peakHours,
      recommendedDeparture,
      trafficScore,
    };
  }

  /**
   * Send email invite to crew member
   */
  private async sendEmailInvite(
    contact: { name?: string; email?: string; role?: string },
    scheduleData: ScheduleData,
    icsFilePath?: string
  ): Promise<void> {
    // Placeholder - in production would integrate with email service
    logger.info("Sending email invite", {
      recipient: contact.email,
      name: contact.name,
      role: contact.role,
      hasICS: !!icsFilePath,
    });
  }

  /**
   * Send mobile notification to crew member
   */
  private async sendMobileNotification(
    contact: { name?: string; phone?: string; role?: string },
    scheduleData: ScheduleData
  ): Promise<void> {
    // Placeholder - in production would integrate with SMS service
    logger.info("Sending mobile notification", {
      recipient: contact.phone,
      name: contact.name,
      role: contact.role,
    });
  }

  /**
   * Ensure ICS directory exists
   */
  private async ensureICSDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.icsDirectory, { recursive: true });
    } catch (error) {
      logger.warn("Failed to create ICS directory", { error, directory: this.icsDirectory });
    }
  }
}