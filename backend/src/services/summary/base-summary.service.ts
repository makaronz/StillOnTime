import {
  Summary,
  ScheduleDataWithRelations,
  GeneratedSummary,
  SummaryGenerationOptions,
  CreateSummaryInput,
} from "../../types";
import { SummaryRepository } from "../../repositories/summary.repository";
import { logger } from "../../utils/logger";

/**
 * Base Summary Service
 * Provides core summary management functionality
 */
export class BaseSummaryService {
  constructor(protected summaryRepository: SummaryRepository) {}

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
        functionName: "BaseSummaryService.saveSummary",
      });
      throw error;
    }
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
   * Generate and save summary
   */
  async generateAndSaveSummary(
    scheduleData: ScheduleDataWithRelations,
    options: SummaryGenerationOptions = {}
  ): Promise<Summary> {
    // This will be implemented by the composed service
    throw new Error(
      "generateAndSaveSummary must be implemented by composed service"
    );
  }
}
