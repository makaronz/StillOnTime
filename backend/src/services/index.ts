/**
 * Services Layer Exports
 * Central export point for all services
 */

// Authentication services
export * from "./oauth2.service";

// Email processing services
export * from "./gmail.service";
export * from "./pdf-parser.service";
export * from "./job-processor.service";

// Route planning services
export * from "./google-maps.service";
export * from "./route-planner.service";
export * from "./time-calculation.service";

// Cache services
export * from "./cache.service";
export * from "./weather-cache.service";
export * from "./route-cache.service";
export * from "./cache-invalidation.service";

// Weather services
export * from "./weather.service";
export * from "./weather-monitoring.service";

// Calendar services
export * from "./calendar.service";
export * from "./calendar-manager.service";

// Notification services
export * from "./notification.service";
export * from "./summary.service";

// Service instances (singletons)
import { cacheService } from "./cache.service";
import { weatherCacheService } from "./weather-cache.service";
import { routeCacheService } from "./route-cache.service";
import { cacheInvalidationService } from "./cache-invalidation.service";
import { OAuth2Service } from "./oauth2.service";
import { GmailService } from "./gmail.service";
import { PDFParserService } from "./pdf-parser.service";
import { JobProcessorService } from "./job-processor.service";
import { GoogleMapsService } from "./google-maps.service";
import { RoutePlannerService } from "./route-planner.service";
import { TimeCalculationService } from "./time-calculation.service";
import { WeatherService } from "./weather.service";
import { WeatherMonitoringService } from "./weather-monitoring.service";
import { CalendarService } from "./calendar.service";
import { CalendarManagerService } from "./calendar-manager.service";
import { NotificationService } from "./notification.service";
import { SummaryService } from "./summary.service";
import { UserRepository } from "../repositories/user.repository";
import { ProcessedEmailRepository } from "../repositories/processed-email.repository";
import { ScheduleDataRepository } from "../repositories/schedule-data.repository";
import { WeatherDataRepository } from "../repositories/weather-data.repository";
import { CalendarEventRepository } from "../repositories/calendar-event.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { SummaryRepository } from "../repositories/summary.repository";

// Initialize services with dependencies
const userRepository = new UserRepository();
const processedEmailRepository = new ProcessedEmailRepository();
const scheduleDataRepository = new ScheduleDataRepository();
const weatherDataRepository = new WeatherDataRepository();
const calendarEventRepository = new CalendarEventRepository();
const notificationRepository = new NotificationRepository();
const summaryRepository = new SummaryRepository();
const oauth2Service = new OAuth2Service(userRepository);
const gmailService = new GmailService(oauth2Service, processedEmailRepository);
const pdfParserService = new PDFParserService();
const googleMapsService = new GoogleMapsService();
const routePlannerService = new RoutePlannerService();
const timeCalculationService = new TimeCalculationService();
const weatherService = new WeatherService(weatherDataRepository);
const weatherMonitoringService = new WeatherMonitoringService(
  weatherService,
  weatherDataRepository,
  scheduleDataRepository
);
const calendarService = new CalendarService(
  oauth2Service,
  calendarEventRepository
);
const calendarManagerService = new CalendarManagerService(
  calendarService,
  calendarEventRepository,
  scheduleDataRepository
);
const notificationService = new NotificationService(
  notificationRepository,
  userRepository
);
const summaryService = new SummaryService(summaryRepository);
const jobProcessorService = new JobProcessorService(
  gmailService,
  pdfParserService,
  oauth2Service,
  processedEmailRepository,
  scheduleDataRepository
);

// Service container for dependency injection
export const services = {
  cache: cacheService,
  weatherCache: weatherCacheService,
  routeCache: routeCacheService,
  cacheInvalidation: cacheInvalidationService,
  oauth2: oauth2Service,
  gmail: gmailService,
  pdfParser: pdfParserService,
  googleMaps: googleMapsService,
  routePlanner: routePlannerService,
  timeCalculation: timeCalculationService,
  weather: weatherService,
  weatherMonitoring: weatherMonitoringService,
  calendar: calendarService,
  calendarManager: calendarManagerService,
  notification: notificationService,
  summary: summaryService,
  jobProcessor: jobProcessorService,
} as const;

export type ServiceContainer = typeof services;
