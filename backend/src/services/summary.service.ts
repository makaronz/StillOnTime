/**
 * Summary Service (Legacy)
 *
 * This file has been refactored into smaller, focused components.
 * The new structure is located in the ./summary/ directory.
 *
 * This file now serves as a compatibility layer for existing imports.
 */

// Re-export the new composed service and components
export { SummaryService } from "./summary";

// Re-export individual components for advanced usage
export * from "./summary";
