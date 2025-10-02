import { EnhancedPDFParserService } from "./enhanced-pdf-parser.service";
import { EnhancedGmailService } from "./enhanced-gmail.service";
import { EnhancedRoutePlannerService } from "./enhanced-route-planner.service";
import { EnhancedCalendarService } from "./enhanced-calendar.service";
import { OAuth2Service } from "./oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { AIEmailClassifierService } from "./ai-email-classifier.service";
import { logger } from "@/utils/logger";

export interface EnhancedServiceConfig {
  enableEnhancedPDF: boolean;
  enableEnhancedEmail: boolean;
  enableEnhancedRouting: boolean;
  enableEnhancedCalendar: boolean;
  enableAIClassification: boolean;
}

/**
 * Enhanced Service Manager
 * Manages the integration and lifecycle of enhanced services
 */
export class EnhancedServiceManager {
  private config: EnhancedServiceConfig;
  private enhancedPdfParser?: EnhancedPDFParserService;
  private enhancedGmailService?: EnhancedGmailService;
  private enhancedRoutePlanner?: EnhancedRoutePlannerService;
  private enhancedCalendarService?: EnhancedCalendarService;
  private aiClassifier?: AIEmailClassifierService;

  constructor(
    private oauth2Service: OAuth2Service,
    private processedEmailRepository: ProcessedEmailRepository,
    private calendarEventRepository: CalendarEventRepository,
    config: Partial<EnhancedServiceConfig> = {}
  ) {
    this.config = {
      enableEnhancedPDF: config.enableEnhancedPDF ?? true,
      enableEnhancedEmail: config.enableEnhancedEmail ?? true,
      enableEnhancedRouting: config.enableEnhancedRouting ?? true,
      enableEnhancedCalendar: config.enableEnhancedCalendar ?? true,
      enableAIClassification: config.enableAIClassification ?? false, // Optional AI service
    };

    this.initializeServices();
  }

  /**
   * Initialize enhanced services based on configuration
   */
  private async initializeServices(): Promise<void> {
    try {
      logger.info("Initializing enhanced services", { config: this.config });

      // Initialize AI classifier if enabled
      if (this.config.enableAIClassification) {
        try {
          this.aiClassifier = new AIEmailClassifierService();
          logger.info("AI Email Classifier initialized");
        } catch (error) {
          logger.warn("AI Email Classifier initialization failed, continuing without AI", { error });
        }
      }

      // Initialize Enhanced PDF Parser
      if (this.config.enableEnhancedPDF) {
        this.enhancedPdfParser = new EnhancedPDFParserService(this.aiClassifier);
        logger.info("Enhanced PDF Parser Service initialized");
      }

      // Initialize Enhanced Gmail Service
      if (this.config.enableEnhancedEmail) {
        this.enhancedGmailService = new EnhancedGmailService(
          this.oauth2Service,
          this.processedEmailRepository,
          this.aiClassifier,
          this.enhancedPdfParser
        );
        logger.info("Enhanced Gmail Service initialized");
      }

      // Initialize Enhanced Route Planner
      if (this.config.enableEnhancedRouting) {
        this.enhancedRoutePlanner = new EnhancedRoutePlannerService();
        logger.info("Enhanced Route Planner Service initialized");
      }

      // Initialize Enhanced Calendar Service
      if (this.config.enableEnhancedCalendar) {
        this.enhancedCalendarService = new EnhancedCalendarService(
          this.oauth2Service,
          this.calendarEventRepository
        );
        logger.info("Enhanced Calendar Service initialized");
      }

      logger.info("Enhanced services initialization completed", {
        servicesEnabled: this.getEnabledServices(),
      });
    } catch (error) {
      logger.error("Enhanced services initialization failed", { error });
      throw new Error(`Enhanced services initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Get Enhanced PDF Parser Service
   */
  getEnhancedPDFParser(): EnhancedPDFParserService | undefined {
    return this.enhancedPdfParser;
  }

  /**
   * Get Enhanced Gmail Service
   */
  getEnhancedGmailService(): EnhancedGmailService | undefined {
    return this.enhancedGmailService;
  }

  /**
   * Get Enhanced Route Planner Service
   */
  getEnhancedRoutePlanner(): EnhancedRoutePlannerService | undefined {
    return this.enhancedRoutePlanner;
  }

  /**
   * Get Enhanced Calendar Service
   */
  getEnhancedCalendarService(): EnhancedCalendarService | undefined {
    return this.enhancedCalendarService;
  }

  /**
   * Get AI Classifier Service
   */
  getAIClassifier(): AIEmailClassifierService | undefined {
    return this.aiClassifier;
  }

  /**
   * Check if service is enabled and available
   */
  isServiceEnabled(service: keyof EnhancedServiceConfig): boolean {
    return this.config[service];
  }

  /**
   * Get list of enabled services
   */
  getEnabledServices(): string[] {
    const enabled: string[] = [];
    
    if (this.config.enableEnhancedPDF) enabled.push("Enhanced PDF Parser");
    if (this.config.enableEnhancedEmail) enabled.push("Enhanced Gmail");
    if (this.config.enableEnhancedRouting) enabled.push("Enhanced Route Planner");
    if (this.config.enableEnhancedCalendar) enabled.push("Enhanced Calendar");
    if (this.config.enableAIClassification) enabled.push("AI Email Classifier");

    return enabled;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    overall: "healthy" | "degraded" | "unhealthy";
    services: Record<string, { status: "healthy" | "unhealthy"; error?: string }>;
  }> {
    const services: Record<string, { status: "healthy" | "unhealthy"; error?: string }> = {};
    let healthyCount = 0;
    let totalCount = 0;

    // Check Enhanced PDF Parser
    if (this.config.enableEnhancedPDF) {
      totalCount++;
      try {
        if (this.enhancedPdfParser) {
          services["Enhanced PDF Parser"] = { status: "healthy" };
          healthyCount++;
        } else {
          services["Enhanced PDF Parser"] = { status: "unhealthy", error: "Service not initialized" };
        }
      } catch (error) {
        services["Enhanced PDF Parser"] = { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // Check Enhanced Gmail Service
    if (this.config.enableEnhancedEmail) {
      totalCount++;
      try {
        if (this.enhancedGmailService) {
          services["Enhanced Gmail"] = { status: "healthy" };
          healthyCount++;
        } else {
          services["Enhanced Gmail"] = { status: "unhealthy", error: "Service not initialized" };
        }
      } catch (error) {
        services["Enhanced Gmail"] = { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // Check Enhanced Route Planner
    if (this.config.enableEnhancedRouting) {
      totalCount++;
      try {
        if (this.enhancedRoutePlanner) {
          services["Enhanced Route Planner"] = { status: "healthy" };
          healthyCount++;
        } else {
          services["Enhanced Route Planner"] = { status: "unhealthy", error: "Service not initialized" };
        }
      } catch (error) {
        services["Enhanced Route Planner"] = { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // Check Enhanced Calendar Service
    if (this.config.enableEnhancedCalendar) {
      totalCount++;
      try {
        if (this.enhancedCalendarService) {
          services["Enhanced Calendar"] = { status: "healthy" };
          healthyCount++;
        } else {
          services["Enhanced Calendar"] = { status: "unhealthy", error: "Service not initialized" };
        }
      } catch (error) {
        services["Enhanced Calendar"] = { status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // Determine overall health
    let overall: "healthy" | "degraded" | "unhealthy";
    if (healthyCount === totalCount) {
      overall = "healthy";
    } else if (healthyCount > 0) {
      overall = "degraded";
    } else {
      overall = "unhealthy";
    }

    return { overall, services };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<EnhancedServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("Enhanced service configuration updated", { newConfig: this.config });
    
    // Re-initialize services with new configuration
    this.initializeServices();
  }

  /**
   * Shutdown all enhanced services
   */
  async shutdown(): Promise<void> {
    try {
      logger.info("Shutting down enhanced services");
      
      // Cleanup services if they have cleanup methods
      // Note: Current services don't have explicit cleanup, but this is where it would go
      
      this.enhancedPdfParser = undefined;
      this.enhancedGmailService = undefined;
      this.enhancedRoutePlanner = undefined;
      this.enhancedCalendarService = undefined;
      this.aiClassifier = undefined;

      logger.info("Enhanced services shutdown completed");
    } catch (error) {
      logger.error("Enhanced services shutdown failed", { error });
      throw error;
    }
  }
}