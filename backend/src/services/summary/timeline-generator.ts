import { ScheduleDataWithRelations, TimelineEntry } from "../../types";
import { PolishTemplates, EnglishTemplates } from "./language-templates";

/**
 * Timeline Generator
 * Handles timeline generation from schedule data
 */
export class TimelineGenerator {
  private polishTemplates: PolishTemplates;
  private englishTemplates: EnglishTemplates;

  constructor() {
    this.polishTemplates = new PolishTemplates();
    this.englishTemplates = new EnglishTemplates();
  }

  /**
   * Generate timeline from schedule data
   */
  generateTimeline(
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
}
