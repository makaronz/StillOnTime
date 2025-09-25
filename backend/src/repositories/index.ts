/**
 * Repository Layer Exports
 * Central export point for all repositories
 */

// Base repository
export * from "./base.repository";

// Repository interfaces and implementations
export * from "./user.repository";
export * from "./processed-email.repository";
export * from "./schedule-data.repository";
export * from "./route-plan.repository";
export * from "./weather-data.repository";
export * from "./calendar-event.repository";
export * from "./user-config.repository";

// Repository instances (singletons)
import { UserRepository } from "./user.repository";
import { ProcessedEmailRepository } from "./processed-email.repository";
import { ScheduleDataRepository } from "./schedule-data.repository";
import { RoutePlanRepository } from "./route-plan.repository";
import { WeatherDataRepository } from "./weather-data.repository";
import { CalendarEventRepository } from "./calendar-event.repository";
import { UserConfigRepository } from "./user-config.repository";

// Create singleton instances
export const userRepository = new UserRepository();
export const processedEmailRepository = new ProcessedEmailRepository();
export const scheduleDataRepository = new ScheduleDataRepository();
export const routePlanRepository = new RoutePlanRepository();
export const weatherDataRepository = new WeatherDataRepository();
export const calendarEventRepository = new CalendarEventRepository();
export const userConfigRepository = new UserConfigRepository();

// Repository container for dependency injection
export const repositories = {
  user: userRepository,
  processedEmail: processedEmailRepository,
  scheduleData: scheduleDataRepository,
  routePlan: routePlanRepository,
  weatherData: weatherDataRepository,
  calendarEvent: calendarEventRepository,
  userConfig: userConfigRepository,
} as const;

export type RepositoryContainer = typeof repositories;
