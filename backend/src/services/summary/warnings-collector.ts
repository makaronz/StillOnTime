import { ScheduleDataWithRelations } from "../../types";
import { PolishTemplates, EnglishTemplates } from "./language-templates";

/**
 * Warnings Collector
 * Handles collection and generation of warnings from schedule data
 */
export class WarningsCollector {
  private polishTemplates: PolishTemplates;
  private englishTemplates: EnglishTemplates;

  constructor() {
    this.polishTemplates = new PolishTemplates();
    this.englishTemplates = new EnglishTemplates();
  }

  /**
   * Collect warnings from schedule data
   */
  collectWarnings(
    scheduleData: ScheduleDataWithRelations,
    language: "pl" | "en"
  ): string[] {
    const warnings: string[] = [];
    const templates =
      language === "pl" ? this.polishTemplates : this.englishTemplates;

    // Weather warnings
    if (scheduleData.weatherData?.warnings) {
      const weatherWarnings = Array.isArray(scheduleData.weatherData.warnings)
        ? scheduleData.weatherData.warnings.filter(
            (warning: any): warning is string => typeof warning === "string"
          )
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
}
