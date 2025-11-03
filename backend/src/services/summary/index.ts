/**
 * Summary Services Index
 * Exports all summary-related components and creates a composed service
 */

export * from "./base-summary.service";
export * from "./timeline-generator";
export * from "./weather-summary-generator";
export * from "./warnings-collector";
export * from "./content-generators";
export * from "./language-templates";

import { BaseSummaryService } from "./base-summary.service";
import { TimelineGenerator } from "./timeline-generator";
import { WeatherSummaryGenerator } from "./weather-summary-generator";
import { WarningsCollector } from "./warnings-collector";
import {
  TextContentGenerator,
  HtmlContentGenerator,
} from "./content-generators";
import { PolishTemplates, EnglishTemplates } from "./language-templates";
import {
  ScheduleDataWithRelations,
  GeneratedSummary,
  SummaryGenerationOptions,
  Summary,
} from "../../types";
import { SummaryRepository } from "../../repositories/summary.repository";
import { logger } from "../../utils/logger";

/**
 * Composed Summary Service
 * Combines all summary functionality using service composition pattern
 */
export class SummaryService extends BaseSummaryService {
  private timelineGenerator: TimelineGenerator;
  private weatherSummaryGenerator: WeatherSummaryGenerator;
  private warningsCollector: WarningsCollector;
  private textContentGenerator: TextContentGenerator;
  private htmlContentGenerator: HtmlContentGenerator;
  private polishTemplates: PolishTemplates;
  private englishTemplates: EnglishTemplates;

  constructor(summaryRepository: SummaryRepository) {
    super(summaryRepository);

    // Initialize generators
    this.timelineGenerator = new TimelineGenerator();
    this.weatherSummaryGenerator = new WeatherSummaryGenerator();
    this.warningsCollector = new WarningsCollector();
    this.textContentGenerator = new TextContentGenerator();
    this.htmlContentGenerator = new HtmlContentGenerator();

    // Initialize templates
    this.polishTemplates = new PolishTemplates();
    this.englishTemplates = new EnglishTemplates();

    logger.info("Composed summary service initialized");
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
        language = "en", // Default to English
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
      const timeline = this.timelineGenerator.generateTimeline(
        scheduleData,
        language
      );

      // Generate weather summary
      const weatherSummary =
        includeWeather && scheduleData.weatherData && scheduleData.weatherData.length > 0
          ? this.weatherSummaryGenerator.generateWeatherSummary(
              scheduleData.weatherData[0],
              language
            )
          : undefined;

      // Collect warnings
      const warnings = this.warningsCollector.collectWarnings(
        scheduleData,
        language
      );

      // Generate content
      const content = this.textContentGenerator.generateTextContent(
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
          : this.htmlContentGenerator.generateHtmlContent(
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
}
