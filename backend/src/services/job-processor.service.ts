/**
 * Job Processor Service (Legacy)
 *
 * This file has been refactored into smaller, focused job processors.
 * The new structure is located in the ./job-processor/ directory.
 *
 * This file now serves as a compatibility layer for existing imports.
 */

// Re-export the new composed service and types
export {
  JobProcessorService,
  JobProcessorOptions,
  EmailProcessingJobData,
  WeatherUpdateJobData,
  PeriodicEmailCheckJobData,
} from "./job-processor";

// Re-export individual processors for advanced usage
export * from "./job-processor";
