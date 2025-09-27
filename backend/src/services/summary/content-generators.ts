import {
  ScheduleDataWithRelations,
  TimelineEntry,
  ContactInfo,
} from "../../types";
import { PolishTemplates, EnglishTemplates } from "./language-templates";

/**
 * Type guard to validate ContactInfo array
 */
function isContactInfoArray(data: unknown): data is ContactInfo[] {
  if (!Array.isArray(data)) {
    return false;
  }

  return data.every((item): item is ContactInfo => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.name === "string" &&
      (item.role === undefined || typeof item.role === "string") &&
      (item.phone === undefined || typeof item.phone === "string") &&
      (item.email === undefined || typeof item.email === "string")
    );
  });
}

/**
 * Safely extract ContactInfo array from JSON data
 */
function safeGetContactInfo(data: unknown): ContactInfo[] {
  if (isContactInfoArray(data)) {
    return data;
  }

  // Fallback: try to extract valid contacts from malformed data
  if (Array.isArray(data)) {
    return data
      .filter((item): item is ContactInfo => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof item.name === "string"
        );
      })
      .map((item) => ({
        name: item.name,
        role: typeof item.role === "string" ? item.role : undefined,
        phone: typeof item.phone === "string" ? item.phone : undefined,
        email: typeof item.email === "string" ? item.email : undefined,
      }));
  }

  // Return empty array as safe fallback
  return [];
}

/**
 * Text Content Generator
 * Handles generation of plain text content
 */
export class TextContentGenerator {
  /**
   * Generate text content
   */
  generateTextContent(
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
    if (options.includeContacts && scheduleData.contacts) {
      const contacts = safeGetContactInfo(scheduleData.contacts);
      if (contacts.length > 0) {
        content += `${templates.sections.contacts}\n`;
        contacts.forEach((contact: ContactInfo) => {
          content += `• ${contact.name}`;
          if (contact.role) content += ` (${contact.role})`;
          if (contact.phone) content += ` - ${contact.phone}`;
          content += "\n";
        });
        content += "\n";
      }
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

/**
 * HTML Content Generator
 * Handles generation of HTML content
 */
export class HtmlContentGenerator {
  /**
   * Generate HTML content
   */
  generateHtmlContent(
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
    if (options.includeContacts && scheduleData.contacts) {
      const contacts = safeGetContactInfo(scheduleData.contacts);
      if (contacts.length > 0) {
        html += `
          <div class="summary-contacts">
            <h2>${templates.sections.contacts}</h2>
            <ul class="contacts-list">
        `;
        contacts.forEach((contact: ContactInfo) => {
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
