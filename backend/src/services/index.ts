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

// Enhanced services
export * from "./enhanced-pdf-parser.service";
export * from "./enhanced-gmail.service";
export * from "./enhanced-route-planner.service";
export * from "./enhanced-calendar.service";
export * from "./enhanced-service-manager";

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

// Error handling and recovery services
export * from "./error-handler.service";
export * from "./monitoring.service";
export * from "./fallback.service";
export * from "./error-recovery.service";
export * from "./error-recovery-integration.service";

// Service instances (singletons)
import { cacheService } from "./cache.service";
import { weatherCacheService } from "./weather-cache.service";
import { routeCacheService } from "./route-cache.service";
import { cacheInvalidationService } from "./cache-invalidation.service";
import { OAuth2Service } from "./oauth2.service";
import { GmailService } from "./gmail.service";
import { PDFParserService } from "./pdf-parser.service";
import { JobProcessorService } from "./job-processor";
import { GoogleMapsService } from "./google-maps.service";
import { RoutePlannerService } from "./route-planner.service";
import { TimeCalculationService } from "./time-calculation.service";
import { WeatherService } from "./weather.service";
import { WeatherMonitoringService } from "./weather-monitoring.service";
import { CalendarService } from "./calendar.service";
import { CalendarManagerService } from "./calendar-manager.service";
import { NotificationService } from "./notification.service";
import { SummaryService } from "./summary";
import { ErrorHandlerService } from "./error-handler.service";
import { MonitoringService } from "./monitoring.service";
import { FallbackService } from "./fallback.service";
import { ErrorRecoveryService } from "./error-recovery.service";
import { ErrorRecoveryIntegrationService } from "./error-recovery-integration.service";
import { EnhancedServiceManager } from "./enhanced-service-manager";
import { userRepository } from "../repositories/user.repository";
import { processedEmailRepository } from "../repositories/processed-email.repository";
import { scheduleDataRepository } from "../repositories/schedule-data.repository";
import { routePlanRepository } from "../repositories/route-plan.repository";
import { weatherDataRepository } from "../repositories/weather-data.repository";
import { calendarEventRepository } from "../repositories/calendar-event.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { summaryRepository } from "../repositories/summary.repository";
import { config } from "../config/config";
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

// Initialize error handling and recovery services
const monitoringService = new MonitoringService(
  null as any, // Will be initialized properly in main app
  cacheService,
  notificationService
);
const fallbackService = new FallbackService(cacheService, notificationService);
const errorRecoveryService = new ErrorRecoveryService(
  fallbackService,
  monitoringService,
  notificationService,
  cacheService
);
const errorHandlerService = new ErrorHandlerService(
  oauth2Service,
  cacheService,
  notificationService
);
const errorRecoveryIntegrationService = new ErrorRecoveryIntegrationService(
  notificationService,
  cacheService,
  monitoringService
);

// Initialize enhanced service manager
const enhancedServiceManager = new EnhancedServiceManager(
  oauth2Service,
  processedEmailRepository,
  calendarEventRepository,
  config.enhancedServices
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
  errorHandler: errorHandlerService,
  monitoring: monitoringService,
  fallback: fallbackService,
  errorRecovery: errorRecoveryService,
  errorRecoveryIntegration: errorRecoveryIntegrationService,
  // Enhanced services
  enhancedServiceManager: enhancedServiceManager,
} as const;

export type ServiceContainer = typeof services;
