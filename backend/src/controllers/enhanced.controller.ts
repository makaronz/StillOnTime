import { Request, Response } from "express";
import multer from "multer";
import { services } from "@/services";
import { logger } from "@/utils/logger";
import { ScheduleData, RoutePlan, WeatherData } from "@/types";

// Extend Request type to include file property
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

/**
 * Enhanced API Controller
 * Provides endpoints for enhanced service functionality
 */
export class EnhancedController {
  /**
   * Process PDF with enhanced parser
   */
  static async processPDFEnhanced(req: RequestWithFile, res: Response): Promise<void> {
    try {
      const { filename, userId } = req.body;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: "No PDF file provided",
        });
        return;
      }

      const enhancedPDFParser = services.enhancedServiceManager.getEnhancedPDFParser();
      
      if (!enhancedPDFParser) {
        logger.warn("Enhanced PDF parser not available, falling back to basic parser");
        res.status(503).json({
          success: false,
          error: "Enhanced PDF processing not available",
          fallbackAvailable: true,
        });
        return;
      }

      const result = await enhancedPDFParser.parsePDFAttachmentEnhanced(
        req.file.buffer,
        filename || req.file.originalname
      );

      res.json({
        success: true,
        data: {
          scheduleData: result.scheduleData,
          metadata: result.metadata,
          qualityScore: result.qualityScore,
          extractionDetails: result.extractionDetails,
          aiEnhanced: result.aiEnhanced,
        },
      });
    } catch (error) {
      logger.error("Enhanced PDF processing failed", { error, userId: req.body.userId });
      res.status(500).json({
        success: false,
        error: "Enhanced PDF processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Monitor emails with enhanced service
   */
  static async monitorEmailsEnhanced(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const enhancedGmailService = services.enhancedServiceManager.getEnhancedGmailService();
      
      if (!enhancedGmailService) {
        logger.warn("Enhanced Gmail service not available, falling back to basic service");
        res.status(503).json({
          success: false,
          error: "Enhanced email monitoring not available",
          fallbackAvailable: true,
        });
        return;
      }

      const results = await enhancedGmailService.monitorEmailsEnhanced(userId);

      res.json({
        success: true,
        data: {
          results,
          summary: {
            totalProcessed: results.length,
            successful: results.filter(r => r.processed).length,
            failed: results.filter(r => !r.processed).length,
            averageProcessingTime: results.length > 0 
              ? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length 
              : 0,
          },
        },
      });
    } catch (error) {
      logger.error("Enhanced email monitoring failed", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "Enhanced email monitoring failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Calculate route with enhanced features
   */
  static async calculateRouteEnhanced(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleData, userId, options } = req.body;

      const enhancedRoutePlanner = services.enhancedServiceManager.getEnhancedRoutePlanner();
      
      if (!enhancedRoutePlanner) {
        logger.warn("Enhanced route planner not available, falling back to basic planner");
        res.status(503).json({
          success: false,
          error: "Enhanced route planning not available",
          fallbackAvailable: true,
        });
        return;
      }

      const result = await enhancedRoutePlanner.calculateEnhancedRoutePlan(
        scheduleData,
        userId,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Enhanced route calculation failed", { error, userId: req.body.userId });
      res.status(500).json({
        success: false,
        error: "Enhanced route calculation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Optimize multi-destination route
   */
  static async optimizeMultiDestinationRoute(req: Request, res: Response): Promise<void> {
    try {
      const { schedules, userId, options } = req.body;

      const enhancedRoutePlanner = services.enhancedServiceManager.getEnhancedRoutePlanner();
      
      if (!enhancedRoutePlanner) {
        res.status(503).json({
          success: false,
          error: "Enhanced route optimization not available",
        });
        return;
      }

      const result = await enhancedRoutePlanner.optimizeMultiDestinationRoute(
        schedules,
        userId,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Multi-destination route optimization failed", { error, userId: req.body.userId });
      res.status(500).json({
        success: false,
        error: "Multi-destination route optimization failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create enhanced calendar event
   */
  static async createCalendarEventEnhanced(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleData, routePlan, weather, userId, options } = req.body;

      const enhancedCalendarService = services.enhancedServiceManager.getEnhancedCalendarService();
      
      if (!enhancedCalendarService) {
        logger.warn("Enhanced calendar service not available, falling back to basic service");
        res.status(503).json({
          success: false,
          error: "Enhanced calendar creation not available",
          fallbackAvailable: true,
        });
        return;
      }

      const result = await enhancedCalendarService.createEnhancedCalendarEvent(
        scheduleData,
        routePlan,
        weather,
        userId,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Enhanced calendar event creation failed", { error, userId: req.body.userId });
      res.status(500).json({
        success: false,
        error: "Enhanced calendar event creation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get enhanced services health status
   */
  static async getEnhancedServicesHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await services.enhancedServiceManager.getHealthStatus();
      const enabledServices = services.enhancedServiceManager.getEnabledServices();

      res.json({
        success: true,
        data: {
          health: healthStatus,
          enabledServices,
          totalServices: enabledServices.length,
        },
      });
    } catch (error) {
      logger.error("Enhanced services health check failed", { error });
      res.status(500).json({
        success: false,
        error: "Enhanced services health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get enhanced services configuration
   */
  static async getEnhancedServicesConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = {
        enabledServices: services.enhancedServiceManager.getEnabledServices(),
        features: {
          enhancedPDF: services.enhancedServiceManager.isServiceEnabled("enableEnhancedPDF"),
          enhancedEmail: services.enhancedServiceManager.isServiceEnabled("enableEnhancedEmail"),
          enhancedRouting: services.enhancedServiceManager.isServiceEnabled("enableEnhancedRouting"),
          enhancedCalendar: services.enhancedServiceManager.isServiceEnabled("enableEnhancedCalendar"),
          aiClassification: services.enhancedServiceManager.isServiceEnabled("enableAIClassification"),
        },
      };

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Enhanced services config retrieval failed", { error });
      res.status(500).json({
        success: false,
        error: "Enhanced services config retrieval failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Validate enhanced PDF extraction
   */
  static async validatePDFExtraction(req: Request, res: Response): Promise<void> {
    try {
      const { extractedData } = req.body;

      const enhancedPDFParser = services.enhancedServiceManager.getEnhancedPDFParser();
      
      if (!enhancedPDFParser) {
        res.status(503).json({
          success: false,
          error: "Enhanced PDF validation not available",
        });
        return;
      }

      const validation = enhancedPDFParser.validateExtractedData(extractedData);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error("Enhanced PDF validation failed", { error });
      res.status(500).json({
        success: false,
        error: "Enhanced PDF validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}