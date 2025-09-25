import {
  Summary,
  ScheduleDataWithRelations,
  RoutePlan,
  WeatherData,
  TimelineEntry,
  GeneratedSummary,
  SummaryGenerationOptions,
  CreateSummaryInput,
  ContactInfo,
} from "../types";
import { SummaryRepository } from "../repositories/summary.repository";
import { logger } from "../utils/logger";

export class SummaryService {
  private polishTemplates: PolishTemplates;
  private englishTemplates: EnglishTemplates;

  constructor(private summaryRepository: SummaryRepository) {
    this.polishTemplates = new PolishTemplates();
    this.englishTemplates = new EnglishTemplates();
  }

  /**
   * Generate comprehensive summary for a schedule
   */
  async generateSummary(
    scheduleData: ScheduleDataWithRelations,
    options: SummaryGenerationOptions = {}
  ): Promise<GeneratedSummary> {
    try {
      const {
        language = "pl",
        includeWeather = true,
        includeRoute = true,
        includeContacts = true,
        includeEquipment = true,
        includeSafetyNotes = true,
        format = "both",
      } = options;

      const templates =
        language === "pl" ? this.polishTemplates : this.englishTemplates;

      // Generate timeline
      const timeline = this.generateTimeline(scheduleData, language);

      // Generate weather summary
      const weatherSummary =
        includeWeather && scheduleData.weatherData
          ? this.generateWeatherSummary(scheduleData.weatherData, language)
          : undefined;

      // Collect warnings
      const warnings = this.collectWarnings(scheduleData, language);

      // Generate content
      const content = this.generateTextContent(
        scheduleData,
        timeline,
        weatherSummary,
        warnings,
        templates,
        {
          includeRoute,
          includeContacts,
          includeEquipment,
          includeSafetyNotes,
        }
      );

      // Generate HTML content
      const htmlContent =
        format === "text"
          ? content
          : this.generateHtmlContent(
              scheduleData,
              timeline,
              weatherSummary,
              warnings,
              templates,
              {
                includeRoute,
                includeContacts,
                includeEquipment,
                includeSafetyNotes,
              }
            );

      return {
        content,
        htmlContent,
        timeline,
        weatherSummary,
        warnings,
        metadata: {
          generatedAt: new Date(),
          language,
          scheduleDate: scheduleData.shootingDate,
          location: scheduleData.location,
          callTime: scheduleData.callTime,
        },
      };
    } catch (error) {
      logger.error("Failed to generate summary", {
        scheduleId: scheduleData.id,
        error: error instanceof Error ? error.message : String(error),
        functionName: "SummaryService.generateSummary",
      });
      throw error;
    }
  }

  /**
   * Save generated summary to database
   */
  async saveSummary(
    userId: string,
    scheduleId: string,
    generatedSummary: GeneratedSummary
  ): Promise<Summary> {
    try {
      const createData: CreateSummaryInput = {
        user: { connect: { id: userId } },
        schedule: { connect: { id: scheduleId } },
        language: generatedSummary.metadata.language,
        content: generatedSummary.content,
        htmlContent: generatedSummary.htmlContent,
        timeline: generatedSummary.timeline as any,
        weatherSummary: generatedSummary.weatherSummary,
        warnings: generatedSummary.warnings as any,
      };

      const updateData = {
        language: generatedSummary.metadata.language,
        content: generatedSummary.content,
        htmlContent: generatedSummary.htmlContent,
        timeline: generatedSummary.timeline as any,
        weatherSummary: generatedSummary.weatherSummary,
        warnings: generatedSummary.warnings as any,
        updatedAt: new Date(),
      };

      return await this.summaryRepository.upsertByScheduleId(
        scheduleId,
        createData,
        updateData
      );
    } catch (error) {
      logger.error("Failed to save summary", {
        userId,
        scheduleId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "SummaryService.saveSummary",
      });
      throw error;
    }
  }

  /**
   * Generate and save summary
   */
  async generateAndSaveSummary(
    scheduleData: ScheduleDataWithRelations,
    options: SummaryGenerationOptions = {}
  ): Promise<Summary> {
    const generatedSummary = await this.generateSummary(scheduleData, options);
    return await this.saveSummary(
      scheduleData.userId,
      scheduleData.id,
      generatedSummary
    );
  }

  /**
   * Get summary by schedule ID
   */
  async getSummaryByScheduleId(scheduleId: string): Promise<Summary | null> {
    return await this.summaryRepository.findByScheduleId(scheduleId);
  }

  /**
   * Get summaries for user
   */
  async getUserSummaries(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      language?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<Array<Summary & { schedule: ScheduleDataWithRelations }>> {
    return await this.summaryRepository.findWithSchedule(userId, options);
  }

  /**
   * Generate timeline from schedule data
   */
  private generateTimeline(
    scheduleData: ScheduleDataWithRelations,
    language: "pl" | "en"
  ): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];
    const templates =
      language === "pl" ? this.polishTemplates : this.englishTemplates;

    if (scheduleData.routePlan) {
      const routePlan = scheduleData.routePlan;

      // Wake up time
      timeline.push({
        time: routePlan.wakeUpTime,
        event: templates.timeline.wakeUp,
        description: templates.timeline.wakeUpDesc,
        type: "wake_up",
      });

      // Departure time
      timeline.push({
        time: routePlan.departureTime,
        event: templates.timeline.departure,
        description: templates.timeline.departureDesc,
        type: "departure",
        location: scheduleData.baseLocation || "Dom",
      });

      // Arrival time
      timeline.push({
        time: routePlan.arrivalTime,
        event: templates.timeline.arrival,
        description: templates.timeline.arrivalDesc,
        type: "arrival",
        location: scheduleData.location,
      });
    }

    // Call time
    const callTimeDate = new Date(scheduleData.shootingDate);
    const [hours, minutes] = scheduleData.callTime.split(":");
    callTimeDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    timeline.push({
      time: callTimeDate,
      event: templates.timeline.callTime,
      description: templates.timeline.callTimeDesc,
      type: "call_time",
      location: scheduleData.location,
    });

    // Estimated wrap time (call time + 10 hours)
    const wrapTime = new Date(callTimeDate);
    wrapTime.setHours(wrapTime.getHours() + 10);

    timeline.push({
      time: wrapTime,
      event: templates.timeline.wrap,
      description: templates.timeline.wrapDesc,
      type: "wrap",
      location: scheduleData.location,
    });

    return timeline.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  /**
   * Generate weather summary
   */
  private generateWeatherSummary(
    weatherData: WeatherData,
    language: "pl" | "en"
  ): string {
    const templates =
      language === "pl" ? this.polishTemplates : this.englishTemplates;

    let summary = `${templates.weather.temperature}: ${weatherData.temperature}°C`;

    if (weatherData.description) {
      summary += `, ${weatherData.description}`;
    }

    if (weatherData.windSpeed) {
      summary += `, ${templates.weather.wind}: ${weatherData.windSpeed} m/s`;
    }

    if (weatherData.precipitation && weatherData.precipitation > 0) {
      summary += `, ${templates.weather.precipitation}: ${weatherData.precipitation}mm`;
    }

    if (weatherData.humidity) {
      summary += `, ${templates.weather.humidity}: ${weatherData.humidity}%`;
    }

    return summary;
  }

  /**
   * Collect warnings from schedule data
   */
  private collectWarnings(
    scheduleData: ScheduleDataWithRelations,
    language: "pl" | "en"
  ): string[] {
    const warnings: string[] = [];
    const templates =
      language === "pl" ? this.polishTemplates : this.englishTemplates;

    // Weather warnings
    if (scheduleData.weatherData?.warnings) {
      const weatherWarnings = Array.isArray(scheduleData.weatherData.warnings)
        ? (scheduleData.weatherData.warnings as string[])
        : [];
      warnings.push(...weatherWarnings);
    }

    // Early wake up warning
    if (scheduleData.routePlan) {
      const wakeUpHour = scheduleData.routePlan.wakeUpTime.getHours();
      if (wakeUpHour < 4) {
        warnings.push(templates.warnings.earlyWakeUp);
      }
    }

    // Long travel warning
    if (
      scheduleData.routePlan &&
      scheduleData.routePlan.totalTravelMinutes > 120
    ) {
      warnings.push(templates.warnings.longTravel);
    }

    // EXT shoot weather warning
    if (scheduleData.sceneType === "EXT" && scheduleData.weatherData) {
      const temp = scheduleData.weatherData.temperature;
      if (temp !== null && temp !== undefined) {
        if (temp < 0) {
          warnings.push(templates.warnings.coldWeather);
        } else if (temp > 30) {
          warnings.push(templates.warnings.hotWeather);
        }
      }
    }

    return warnings;
  }

  /**
   * Generate text content
   */
  private generateTextContent(
    scheduleData: ScheduleDataWithRelations,
    timeline: TimelineEntry[],
    weatherSummary: string | undefined,
    warnings: string[],
    templates: PolishTemplates | EnglishTemplates,
    options: {
      includeRoute: boolean;
      includeContacts: boolean;
      includeEquipment: boolean;
      includeSafetyNotes: boolean;
    }
  ): string {
    let content = "";

    // Header
    content += `${templates.sections.header}\n`;
    content += `${templates.labels.location}: ${scheduleData.location}\n`;
    content += `${templates.labels.date}: ${this.formatDate(
      scheduleData.shootingDate,
      templates.dateFormat
    )}\n`;
    content += `${templates.labels.callTime}: ${scheduleData.callTime}\n`;
    content += `${templates.labels.sceneType}: ${scheduleData.sceneType}\n\n`;

    // Timeline
    content += `${templates.sections.timeline}\n`;
    timeline.forEach((entry) => {
      content += `${this.formatTime(entry.time)} - ${entry.event}`;
      if (entry.location) {
        content += ` (${entry.location})`;
      }
      content += "\n";
    });
    content += "\n";

    // Route information
    if (options.includeRoute && scheduleData.routePlan) {
      content += `${templates.sections.route}\n`;
      content += `${templates.labels.totalTime}: ${scheduleData.routePlan.totalTravelMinutes} ${templates.labels.minutes}\n`;
      content += `${templates.labels.wakeUp}: ${this.formatTime(
        scheduleData.routePlan.wakeUpTime
      )}\n`;
      content += `${templates.labels.departure}: ${this.formatTime(
        scheduleData.routePlan.departureTime
      )}\n`;
      content += `${templates.labels.arrival}: ${this.formatTime(
        scheduleData.routePlan.arrivalTime
      )}\n\n`;
    }

    // Weather
    if (weatherSummary) {
      content += `${templates.sections.weather}\n`;
      content += `${weatherSummary}\n\n`;
    }

    // Warnings
    if (warnings.length > 0) {
      content += `${templates.sections.warnings}\n`;
      warnings.forEach((warning) => {
        content += `⚠️ ${warning}\n`;
      });
      content += "\n";
    }

    // Scenes
    if (scheduleData.scenes && Array.isArray(scheduleData.scenes)) {
      content += `${templates.sections.scenes}\n`;
      content += scheduleData.scenes.join(", ") + "\n\n";
    }

    // Equipment
    if (
      options.includeEquipment &&
      scheduleData.equipment &&
      Array.isArray(scheduleData.equipment)
    ) {
      content += `${templates.sections.equipment}\n`;
      scheduleData.equipment.forEach((item) => {
        content += `• ${item}\n`;
      });
      content += "\n";
    }

    // Contacts
    if (
      options.includeContacts &&
      scheduleData.contacts &&
      Array.isArray(scheduleData.contacts)
    ) {
      content += `${templates.sections.contacts}\n`;
      scheduleData.contacts.forEach((contact: ContactInfo) => {
        content += `• ${contact.name}`;
        if (contact.role) content += ` (${contact.role})`;
        if (contact.phone) content += ` - ${contact.phone}`;
        content += "\n";
      });
      content += "\n";
    }

    // Safety notes
    if (options.includeSafetyNotes && scheduleData.safetyNotes) {
      content += `${templates.sections.safety}\n`;
      content += `${scheduleData.safetyNotes}\n\n`;
    }

    // Additional notes
    if (scheduleData.notes) {
      content += `${templates.sections.notes}\n`;
      content += `${scheduleData.notes}\n\n`;
    }

    return content.trim();
  }

  /**
   * Generate HTML content
   */
  private generateHtmlContent(
    scheduleData: ScheduleDataWithRelations,
    timeline: TimelineEntry[],
    weatherSummary: string | undefined,
    warnings: string[],
    templates: PolishTemplates | EnglishTemplates,
    options: {
      includeRoute: boolean;
      includeContacts: boolean;
      includeEquipment: boolean;
      includeSafetyNotes: boolean;
    }
  ): string {
    let html = `
      <div class="summary-container">
        <h1 class="summary-header">${templates.sections.header}</h1>
        
        <div class="summary-basic-info">
          <p><strong>${templates.labels.location}:</strong> ${
      scheduleData.location
    }</p>
          <p><strong>${templates.labels.date}:</strong> ${this.formatDate(
      scheduleData.shootingDate,
      templates.dateFormat
    )}</p>
          <p><strong>${templates.labels.callTime}:</strong> ${
      scheduleData.callTime
    }</p>
          <p><strong>${templates.labels.sceneType}:</strong> ${
      scheduleData.sceneType
    }</p>
        </div>
    `;

    // Timeline
    html += `
      <div class="summary-timeline">
        <h2>${templates.sections.timeline}</h2>
        <ul class="timeline-list">
    `;
    timeline.forEach((entry) => {
      html += `
        <li class="timeline-entry timeline-${entry.type}">
          <span class="timeline-time">${this.formatTime(entry.time)}</span>
          <span class="timeline-event">${entry.event}</span>
          ${
            entry.location
              ? `<span class="timeline-location">(${entry.location})</span>`
              : ""
          }
        </li>
      `;
    });
    html += `
        </ul>
      </div>
    `;

    // Route information
    if (options.includeRoute && scheduleData.routePlan) {
      html += `
        <div class="summary-route">
          <h2>${templates.sections.route}</h2>
          <p><strong>${templates.labels.totalTime}:</strong> ${
        scheduleData.routePlan.totalTravelMinutes
      } ${templates.labels.minutes}</p>
          <p><strong>${templates.labels.wakeUp}:</strong> ${this.formatTime(
        scheduleData.routePlan.wakeUpTime
      )}</p>
          <p><strong>${templates.labels.departure}:</strong> ${this.formatTime(
        scheduleData.routePlan.departureTime
      )}</p>
          <p><strong>${templates.labels.arrival}:</strong> ${this.formatTime(
        scheduleData.routePlan.arrivalTime
      )}</p>
        </div>
      `;
    }

    // Weather
    if (weatherSummary) {
      html += `
        <div class="summary-weather">
          <h2>${templates.sections.weather}</h2>
          <p>${weatherSummary}</p>
        </div>
      `;
    }

    // Warnings
    if (warnings.length > 0) {
      html += `
        <div class="summary-warnings">
          <h2>${templates.sections.warnings}</h2>
          <ul class="warnings-list">
      `;
      warnings.forEach((warning) => {
        html += `<li class="warning-item">⚠️ ${warning}</li>`;
      });
      html += `
          </ul>
        </div>
      `;
    }

    // Scenes
    if (scheduleData.scenes && Array.isArray(scheduleData.scenes)) {
      html += `
        <div class="summary-scenes">
          <h2>${templates.sections.scenes}</h2>
          <p>${scheduleData.scenes.join(", ")}</p>
        </div>
      `;
    }

    // Equipment
    if (
      options.includeEquipment &&
      scheduleData.equipment &&
      Array.isArray(scheduleData.equipment)
    ) {
      html += `
        <div class="summary-equipment">
          <h2>${templates.sections.equipment}</h2>
          <ul class="equipment-list">
      `;
      scheduleData.equipment.forEach((item) => {
        html += `<li>${item}</li>`;
      });
      html += `
          </ul>
        </div>
      `;
    }

    // Contacts
    if (
      options.includeContacts &&
      scheduleData.contacts &&
      Array.isArray(scheduleData.contacts)
    ) {
      html += `
        <div class="summary-contacts">
          <h2>${templates.sections.contacts}</h2>
          <ul class="contacts-list">
      `;
      scheduleData.contacts.forEach((contact: ContactInfo) => {
        html += `
          <li class="contact-item">
            <strong>${contact.name}</strong>
            ${
              contact.role
                ? `<span class="contact-role">(${contact.role})</span>`
                : ""
            }
            ${
              contact.phone
                ? `<span class="contact-phone"> - ${contact.phone}</span>`
                : ""
            }
          </li>
        `;
      });
      html += `
          </ul>
        </div>
      `;
    }

    // Safety notes
    if (options.includeSafetyNotes && scheduleData.safetyNotes) {
      html += `
        <div class="summary-safety">
          <h2>${templates.sections.safety}</h2>
          <p>${scheduleData.safetyNotes}</p>
        </div>
      `;
    }

    // Additional notes
    if (scheduleData.notes) {
      html += `
        <div class="summary-notes">
          <h2>${templates.sections.notes}</h2>
          <p>${scheduleData.notes}</p>
        </div>
      `;
    }

    html += `</div>`;

    return html;
  }

  /**
   * Format date according to locale
   */
  private formatDate(date: Date, format: string): string {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    };

    if (format === "pl") {
      return date.toLocaleDateString("pl-PL", options);
    } else {
      return date.toLocaleDateString("en-US", options);
    }
  }

  /**
   * Format time
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

// Polish language templates
class PolishTemplates {
  sections = {
    header: "Plan Dnia Zdjęciowego",
    timeline: "Harmonogram",
    route: "Trasa i Czasy",
    weather: "Pogoda",
    warnings: "Ostrzeżenia",
    scenes: "Sceny",
    equipment: "Sprzęt",
    contacts: "Kontakty",
    safety: "Uwagi BHP",
    notes: "Dodatkowe Uwagi",
  };

  labels = {
    location: "Lokacja",
    date: "Data",
    callTime: "Call Time",
    sceneType: "Typ Sceny",
    totalTime: "Całkowity czas podróży",
    minutes: "minut",
    wakeUp: "Pobudka",
    departure: "Wyjazd",
    arrival: "Przyjazd",
  };

  timeline = {
    wakeUp: "Pobudka",
    wakeUpDesc: "Czas wstawać!",
    departure: "Wyjazd z domu",
    departureDesc: "Rozpoczęcie podróży",
    arrival: "Przyjazd na plan",
    arrivalDesc: "Dotarcie na lokację",
    callTime: "Call Time",
    callTimeDesc: "Rozpoczęcie pracy",
    wrap: "Przewidywany koniec",
    wrapDesc: "Zakończenie dnia zdjęciowego",
  };

  weather = {
    temperature: "Temperatura",
    wind: "Wiatr",
    precipitation: "Opady",
    humidity: "Wilgotność",
  };

  warnings = {
    earlyWakeUp:
      "Bardzo wczesna pobudka - przygotuj się na wcześniejsze położenie spać",
    longTravel: "Długa podróż - sprawdź trasę i warunki drogowe",
    coldWeather: "Zimna pogoda - ubierz się ciepło",
    hotWeather: "Gorąca pogoda - zabierz wodę i ochronę przeciwsłoneczną",
  };

  dateFormat = "pl";
}

// English language templates
class EnglishTemplates {
  sections = {
    header: "Shooting Day Plan",
    timeline: "Timeline",
    route: "Route and Times",
    weather: "Weather",
    warnings: "Warnings",
    scenes: "Scenes",
    equipment: "Equipment",
    contacts: "Contacts",
    safety: "Safety Notes",
    notes: "Additional Notes",
  };

  labels = {
    location: "Location",
    date: "Date",
    callTime: "Call Time",
    sceneType: "Scene Type",
    totalTime: "Total travel time",
    minutes: "minutes",
    wakeUp: "Wake Up",
    departure: "Departure",
    arrival: "Arrival",
  };

  timeline = {
    wakeUp: "Wake Up",
    wakeUpDesc: "Time to get up!",
    departure: "Leave home",
    departureDesc: "Start journey",
    arrival: "Arrive on set",
    arrivalDesc: "Reach location",
    callTime: "Call Time",
    callTimeDesc: "Start work",
    wrap: "Estimated wrap",
    wrapDesc: "End of shooting day",
  };

  weather = {
    temperature: "Temperature",
    wind: "Wind",
    precipitation: "Precipitation",
    humidity: "Humidity",
  };

  warnings = {
    earlyWakeUp: "Very early wake up - prepare to go to bed earlier",
    longTravel: "Long journey - check route and road conditions",
    coldWeather: "Cold weather - dress warmly",
    hotWeather: "Hot weather - bring water and sun protection",
  };

  dateFormat = "en";
}
