/**
 * Error Recovery Integration Service
 * Integrates error recovery mechanisms with existing services
 */

import { logger, structuredLogger } from "../utils/logger";
import {
  ErrorRecoveryService,
  RecoveryContext,
  RecoveryOptions,
} from "./error-recovery.service";
import { FallbackService } from "./fallback.service";
import { MonitoringService } from "./monitoring.service";
import { NotificationService } from "./notification.service";
import { CacheService } from "./cache.service";
import { OAuth2Service } from "./oauth2.service";
import { GmailService } from "./gmail.service";
import { CalendarService } from "./calendar.service";
import { GoogleMapsService } from "./google-maps.service";
import { WeatherService } from "./weather.service";
import { PDFParserService } from "./pdf-parser.service";
import { SMSService } from "./sms.service";
import { initializeCircuitBreakers } from "../config/circuit-breaker-config";

export interface ServiceWrapper<T> {
  service: T;
  serviceName: string;
  criticalOperations: string[];
  recoveryOptions: RecoveryOptions;
}

export class ErrorRecoveryIntegrationService {
  private errorRecoveryService: ErrorRecoveryService;
  private fallbackService: FallbackService;
  private monitoringService: MonitoringService;
  private notificationService: NotificationService;
  private cacheService: CacheService;

  // Service wrappers
  private serviceWrappers: Map<string, ServiceWrapper<any>> = new Map();

  constructor(
    notificationService: NotificationService,
    cacheService: CacheService,
    monitoringService: MonitoringService
  ) {
    this.notificationService = notificationService;
    this.cacheService = cacheService;
    this.monitoringService = monitoringService;

    // Initialize fallback service
    this.fallbackService = new FallbackService(
      this.cacheService,
      this.notificationService
    );

    // Initialize error recovery service
    this.errorRecoveryService = new ErrorRecoveryService(
      this.fallbackService,
      this.monitoringService,
      this.notificationService,
      this.cacheService
    );

    // Initialize circuit breakers
    initializeCircuitBreakers();

    structuredLogger.info("Error recovery integration service initialized");
  }

  /**
   * Register a service with error recovery capabilities
   */
  public registerService<T>(
    service: T,
    serviceName: string,
    criticalOperations: string[] = [],
    recoveryOptions: Partial<RecoveryOptions> = {}
  ): void {
    const defaultRecoveryOptions: RecoveryOptions = {
      enableRetry: true,
      enableFallback: true,
      enableCircuitBreaker: true,
      maxRecoveryAttempts: 3,
      notifyOnFailure: true,
      cacheFailureData: true,
      gracefulDegradation: true,
      userFacingOperation: false,
    };

    const wrapper: ServiceWrapper<T> = {
      service,
      serviceName,
      criticalOperations,
      recoveryOptions: { ...defaultRecoveryOptions, ...recoveryOptions },
    };

    this.serviceWrappers.set(serviceName, wrapper);

    structuredLogger.info("Service registered with error recovery", {
      serviceName,
      criticalOperations,
      recoveryOptions: wrapper.recoveryOptions,
    });
  }

  /**
   * Execute service operation with error recovery
   */
  public async executeServiceOperation<T>(
    serviceName: string,
    operation: string,
    serviceMethod: () => Promise<T>,
    context: Partial<RecoveryContext> = {},
    options: Partial<RecoveryOptions> = {}
  ): Promise<T> {
    const wrapper = this.serviceWrappers.get(serviceName);
    if (!wrapper) {
      structuredLogger.warn("Service not registered for error recovery", {
        serviceName,
        operation,
      });
      return await serviceMethod();
    }

    const recoveryContext: RecoveryContext = {
      serviceName,
      operation,
      userId: context.userId,
      requestId: context.requestId || this.generateRequestId(),
      metadata: context.metadata,
    };

    const recoveryOptions: RecoveryOptions = {
      ...wrapper.recoveryOptions,
      ...options,
      userFacingOperation: wrapper.criticalOperations.includes(operation),
    };

    const result = await this.errorRecoveryService.executeWithRecovery(
      serviceMethod,
      recoveryContext,
      recoveryOptions
    );

    if (!result.success) {
      throw new Error(`Service operation failed: ${result.errors.join(", ")}`);
    }

    if (result.degraded) {
      structuredLogger.warn("Service operation completed in degraded mode", {
        serviceName,
        operation,
        recoveryMethod: result.recoveryMethod,
        warnings: result.warnings,
      });
    }

    return result.data!;
  }

  /**
   * Create enhanced OAuth2 service with error recovery
   */
  public createEnhancedOAuth2Service(
    oauth2Service: OAuth2Service
  ): OAuth2Service {
    this.registerService(
      oauth2Service,
      "oauth2",
      [
        "getAuthUrl",
        "exchangeCodeForTokens",
        "refreshAccessToken",
        "getGoogleClient",
      ],
      {
        enableRetry: true,
        enableFallback: false, // OAuth typically doesn't have fallbacks
        maxRecoveryAttempts: 2,
        userFacingOperation: true,
      }
    );

    return this.createServiceProxy(oauth2Service, "oauth2");
  }

  /**
   * Create enhanced Gmail service with error recovery
   */
  public createEnhancedGmailService(gmailService: GmailService): GmailService {
    this.registerService(
      gmailService,
      "gmail_api",
      ["getScheduleEmails", "downloadAttachment", "markAsProcessed"],
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 4,
        userFacingOperation: true,
      }
    );

    return this.createServiceProxy(gmailService, "gmail_api");
  }

  /**
   * Create enhanced Calendar service with error recovery
   */
  public createEnhancedCalendarService(
    calendarService: CalendarService
  ): CalendarService {
    this.registerService(
      calendarService,
      "calendar_api",
      ["createEvent", "updateEvent", "deleteEvent", "listEvents"],
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 3,
        userFacingOperation: true,
      }
    );

    return this.createServiceProxy(calendarService, "calendar_api");
  }

  /**
   * Create enhanced Google Maps service with error recovery
   */
  public createEnhancedGoogleMapsService(
    mapsService: GoogleMapsService
  ): GoogleMapsService {
    this.registerService(
      mapsService,
      "maps_api",
      ["calculateRoute", "geocodeAddress", "getDistanceMatrix"],
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 3,
        userFacingOperation: false,
      }
    );

    return this.createServiceProxy(mapsService, "maps_api");
  }

  /**
   * Create enhanced Weather service with error recovery
   */
  public createEnhancedWeatherService(
    weatherService: WeatherService
  ): WeatherService {
    this.registerService(
      weatherService,
      "weather_api",
      ["getWeatherForecast", "getWeatherWarnings", "updateWeatherData"],
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 4,
        userFacingOperation: false,
      }
    );

    return this.createServiceProxy(weatherService, "weather_api");
  }

  /**
   * Create enhanced PDF Parser service with error recovery
   */
  public createEnhancedPDFParserService(
    pdfService: PDFParserService
  ): PDFParserService {
    this.registerService(
      pdfService,
      "pdf_processor",
      ["parsePDFAttachment", "extractTextFromPDF", "parseScheduleData"],
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 2,
        userFacingOperation: true,
      }
    );

    return this.createServiceProxy(pdfService, "pdf_processor");
  }

  /**
   * Create enhanced SMS service with error recovery
   */
  public createEnhancedSMSService(smsService: SMSService): SMSService {
    this.registerService(
      smsService,
      "sms_service",
      ["sendSMS", "verifySMS", "validatePhoneNumber"],
      {
        enableRetry: true,
        enableFallback: false, // SMS typically doesn't have fallbacks
        maxRecoveryAttempts: 3,
        userFacingOperation: true,
      }
    );

    return this.createServiceProxy(smsService, "sms_service");
  }

  /**
   * Create a proxy for a service that adds error recovery to all methods
   */
  private createServiceProxy<T extends object>(
    service: T,
    serviceName: string
  ): T {
    return new Proxy(service, {
      get: (target, prop, receiver) => {
        const originalMethod = Reflect.get(target, prop, receiver);

        if (typeof originalMethod === "function") {
          return async (...args: any[]) => {
            const operation = String(prop);

            return await this.executeServiceOperation(
              serviceName,
              operation,
              () => originalMethod.apply(target, args),
              {
                metadata: { methodArgs: args },
              }
            );
          };
        }

        return originalMethod;
      },
    });
  }

  /**
   * Get comprehensive error recovery status
   */
  public getErrorRecoveryStatus(): {
    circuitBreakers: Record<string, any>;
    recoveryStats: Record<string, any>;
    fallbackStats: Record<string, number>;
    registeredServices: string[];
  } {
    return {
      circuitBreakers: this.errorRecoveryService.getCircuitBreakerStatus(),
      recoveryStats: this.errorRecoveryService.getRecoveryStats(),
      fallbackStats: this.fallbackService.getFallbackUsageStats(),
      registeredServices: Array.from(this.serviceWrappers.keys()),
    };
  }

  /**
   * Reset all error recovery statistics
   */
  public resetErrorRecoveryStats(): void {
    this.errorRecoveryService.resetRecoveryStats();
    this.fallbackService.resetFallbackUsageStats();

    structuredLogger.info("Error recovery statistics reset");
  }

  /**
   * Reset circuit breakers for all services
   */
  public resetAllCircuitBreakers(): void {
    this.errorRecoveryService.resetAllCircuitBreakers();

    structuredLogger.info("All circuit breakers reset");
  }

  /**
   * Reset circuit breaker for specific service
   */
  public resetServiceCircuitBreaker(serviceName: string): boolean {
    const result = this.errorRecoveryService.resetCircuitBreaker(serviceName);

    if (result) {
      structuredLogger.info("Circuit breaker reset", { serviceName });
    } else {
      structuredLogger.warn("Circuit breaker not found", { serviceName });
    }

    return result;
  }

  /**
   * Get service health status
   */
  public async getServiceHealthStatus(): Promise<Record<string, any>> {
    const dashboard = await this.monitoringService.getMonitoringDashboard();

    return {
      systemOverview: dashboard.systemOverview,
      services: dashboard.services,
      alerts: dashboard.alerts,
      circuitBreakers: dashboard.circuitBreakers,
      criticalFailures: dashboard.criticalFailures,
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown error recovery integration
   */
  public shutdown(): void {
    this.monitoringService.stopMonitoring();
    this.serviceWrappers.clear();

    structuredLogger.info("Error recovery integration service shutdown");
  }
}
