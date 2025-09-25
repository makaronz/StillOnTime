/**
 * Schedule Controller (Legacy)
 *
 * This file has been refactored into smaller, focused controllers.
 * The new structure is located in the ./schedule/ directory.
 *
 * This file now serves as a compatibility layer for existing imports.
 */

// Re-export the new composed controller
export { ScheduleController, scheduleController } from "./schedule";
