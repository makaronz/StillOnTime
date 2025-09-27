/**
 * Advanced fallback service for critical service failures
 * Provides intelligent fallback mechanisms and graceful degradation
 */

import { logger, structuredLogger } from "../utils/logger";
import { CacheService } from "./cache.service";
import { NotificationService } from "./notification.service";
import {
  BaseError,
  ErrorCode,
  APIError,
  SystemError,
  DatabaseError,
} from "../utils/errors";
import { FallbackData } from "../types";

export interface FallbackStrategy {
  serviceName: string;
  errorCode: ErrorCode;
  strategy: "cache" | "default" | "alternative" | "skip" | "degrade";
  priority: number;
  ttl?: number;
  fallbackData?: FallbackData;
  alternativeService?: string;
  degradationLevel?: "minimal" | "partial" | "full";
}

export interface FallbackResult<T = any> {
  success: boolean;
  data?: T;
  strategy: string;
  degraded: boolean;
  cacheHit?: boolean;
  alternativeUsed?: boolean;
  warnings?: string[];
}

export interface ServiceDegradationConfig {
  serviceName: string;
  criticalOperations: string[];
  fallbackOperations: string[];
  gracefulFailureMode: boolean;
  userNotificationRequired: boolean;
}

export class FallbackService {
  private cacheService: CacheService;
  private notificationService: NotificationService;
  private fallbackStrategies: Map<string, FallbackStrategy[]> = new Map();
  private degradationConfigs: Map<string, ServiceDegradationConfig> = new Map();
  private fallbackUsageStats: Map<string, number> = new Map();

  constructor(
    cacheService: CacheService,
    notificationService: NotificationService
  ) {
    this.cacheService = cacheService;
    this.notificationService = notificationService;
    this.initializeFallbackStrategies();
    this.initializeDegradationConfigs();
  }

  /**
   * Initialize fallback strategies for all services
   */
  private initializeFallbackStrategies(): void {
    // Gmail API fallback strategies
    this.addFallbackStrategy({
      serviceName: "gmail_api",
      errorCode: ErrorCode.GMAIL_API_ERROR,
      strategy: "cache",
      priority: 1,
      ttl: 3600, // 1 hour
    });

    this.addFallbackStrategy({
      serviceName: "gmail_api",
      errorCode: ErrorCode.API_RATE_LIMITED,
      strategy: "skip",
      priority: 2,
    });

    // Calendar API fallback strategies
    this.addFallbackStrategy({
      serviceName: "calendar_api",
      errorCode: ErrorCode.CALENDAR_API_ERROR,
      strategy: "cache",
      priority: 1,
      ttl: 1800, // 30 minutes
    });

    this.addFallbackStrategy({
      serviceName: "calendar_api",
      errorCode: ErrorCode.API_RATE_LIMITED,
      strategy: "degrade",
      priority: 2,
      degradationLevel: "partial",
    });

    // Maps API fallback strategies
    this.addFallbackStrategy({
      serviceName: "maps_api",
      errorCode: ErrorCode.MAPS_API_ERROR,
      strategy: "cache",
      priority: 1,
      ttl: 7200, // 2 hours
    });

    this.addFallbackStrategy({
      serviceName: "maps_api",
      errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      strategy: "default",
      priority: 2,
      fallbackData: {
        duration: 3600, // 1 hour default
        distance: 30000, // 30km default
        route: "Estimated route - actual conditions may vary",
        fallback: true,
      },
    });

    // Weather API fallback strategies
    this.addFallbackStrategy({
      serviceName: "weather_api",
      errorCode: ErrorCode.WEATHER_API_ERROR,
      strategy: "cache",
      priority: 1,
      ttl: 10800, // 3 hours
    });

    this.addFallbackStrategy({
      serviceName: "weather_api",
      errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      strategy: "default",
      priority: 2,
      fallbackData: {
        temperature: 15,
        description: "Mild conditions (estimated)",
        warnings: ["Weather data unavailable - check conditions manually"],
        fallback: true,
      },
    });

    // Database fallback strategies
    this.addFallbackStrategy({
      serviceName: "database",
      errorCode: ErrorCode.DATABASE_CONNECTION_ERROR,
      strategy: "cache",
      priority: 1,
      ttl: 300, // 5 minutes
    });

    this.addFallbackStrategy({
      serviceName: "database",
      errorCode: ErrorCode.DATABASE_TIMEOUT_ERROR,
      strategy: "degrade",
      priority: 2,
      degradationLevel: "minimal",
    });

    // Cache fallback strategies
    this.addFallbackStrategy({
      serviceName: "cache",
      errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      strategy: "skip",
      priority: 1,
    });

    structuredLogger.info("Fallback strategies initialized", {
      strategiesCount: Array.from(this.fallbackStrategies.values()).reduce(
        (sum, strategies) => sum + strategies.length,
        0
      ),
    });
  }

  /**
   * Initialize service degradation configurations
   */
  private initializeDegradationConfigs(): void {
    // Gmail service degradation
    this.addDegradationConfig({
      serviceName: "gmail_api",
      criticalOperations: ["email_monitoring", "attachment_download"],
      fallbackOperations: ["manual_email_processing"],
      gracefulFailureMode: true,
      userNotificationRequired: true,
    });

    // Calendar service degradation
    this.addDegradationConfig({
      serviceName: "calendar_api",
      criticalOperations: ["event_creation", "alarm_setup"],
      fallbackOperations: ["manual_calendar_entry", "email_summary"],
      gracefulFailureMode: true,
      userNotificationRequired: true,
    });

    // Maps service degradation
    this.addDegradationConfig({
      serviceName: "maps_api",
      criticalOperations: ["route_calculation", "travel_time_estimation"],
      fallbackOperations: ["distance_estimation", "manual_route_planning"],
      gracefulFailureMode: true,
      userNotificationRequired: false,
    });

    // Weather service degradation
    this.addDegradationConfig({
      serviceName: "weather_api",
      criticalOperations: ["weather_forecast", "weather_warnings"],
      fallbackOperations: ["manual_weather_check", "cached_weather"],
      gracefulFailureMode: true,
      userNotificationRequired: false,
    });

    // Database degradation
    this.addDegradationConfig({
      serviceName: "database",
      criticalOperations: ["data_persistence", "user_authentication"],
      fallbackOperations: ["cache_storage", "readonly_mode"],
      gracefulFailureMode: false,
      userNotificationRequired: true,
    });

    structuredLogger.info("Service degradation configs initialized", {
      configsCount: this.degradationConfigs.size,
    });
  }

  /**
   * Execute fallback strategy for a failed service operation
   */
  async executeFallback<T>(
    serviceName: string,
    error: BaseError,
    operation: string,
    originalData?: FallbackData
  ): Promise<FallbackResult<T>> {
    const strategies = this.getFallbackStrategies(serviceName, error.code);

    if (strategies.length === 0) {
      structuredLogger.warn("No fallback strategies available", {
        serviceName,
        errorCode: error.code,
        operation,
      });

      return {
        success: false,
        strategy: "none",
        degraded: false,
        warnings: ["No fallback strategy available for this service failure"],
      };
    }

    // Try strategies in priority order
    for (const strategy of strategies) {
      try {
        const result = await this.executeStrategy<T>(
          strategy,
          error,
          operation,
          originalData
        );

        if (result.success) {
          this.recordFallbackUsage(serviceName, strategy.strategy);

          structuredLogger.info("Fallback strategy succeeded", {
            serviceName,
            errorCode: error.code,
            strategy: strategy.strategy,
            operation,
            degraded: result.degraded,
          });

          return result;
        }
      } catch (strategyError) {
        structuredLogger.warn("Fallback strategy failed", {
          serviceName,
          strategy: strategy.strategy,
          error:
            strategyError instanceof Error
              ? strategyError.message
              : String(strategyError),
        });
      }
    }

    // All strategies failed
    return {
      success: false,
      strategy: "all_failed",
      degraded: false,
      warnings: ["All fallback strategies failed"],
    };
  }

  /**
   * Execute a specific fallback strategy
   */
  private async executeStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string,
    originalData?: FallbackData
  ): Promise<FallbackResult<T>> {
    switch (strategy.strategy) {
      case "cache":
        return await this.executeCacheStrategy<T>(
          strategy,
          error,
          operation,
          originalData
        );

      case "default":
        return this.executeDefaultStrategy<T>(strategy, error, operation);

      case "alternative":
        return await this.executeAlternativeStrategy<T>(
          strategy,
          error,
          operation,
          originalData
        );

      case "skip":
        return this.executeSkipStrategy<T>(strategy, error, operation);

      case "degrade":
        return await this.executeDegradeStrategy<T>(
          strategy,
          error,
          operation,
          originalData
        );

      default:
        throw new SystemError(
          `Unknown fallback strategy: ${strategy.strategy}`,
          ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
          strategy.serviceName
        );
    }
  }

  /**
   * Execute cache-based fallback strategy
   */
  private async executeCacheStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string,
    originalData?: FallbackData
  ): Promise<FallbackResult<T>> {
    const cacheKey = `fallback:${strategy.serviceName}:${operation}`;
    const backupKeys = [
      `${cacheKey}:backup`,
      `${cacheKey}:last_known_good`,
      `${strategy.serviceName}:${operation}:fallback`,
    ];

    // Try primary cache key
    let cachedData = await this.cacheService.get<T>(cacheKey);
    let cacheKeyUsed = cacheKey;

    // Try backup keys if primary fails
    if (!cachedData) {
      for (const backupKey of backupKeys) {
        cachedData = await this.cacheService.get<T>(backupKey);
        if (cachedData) {
          cacheKeyUsed = backupKey;
          break;
        }
      }
    }

    if (cachedData) {
      return {
        success: true,
        data: cachedData,
        strategy: "cache",
        degraded: true,
        cacheHit: true,
        warnings: [
          `Using cached data due to ${strategy.serviceName} failure`,
          `Cache key: ${cacheKeyUsed}`,
        ],
      };
    }

    return {
      success: false,
      strategy: "cache",
      degraded: false,
      warnings: ["No cached data available for fallback"],
    };
  }

  /**
   * Execute default value fallback strategy
   */
  private executeDefaultStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string
  ): Promise<FallbackResult<T>> {
    if (!strategy.fallbackData) {
      return Promise.resolve({
        success: false,
        strategy: "default",
        degraded: false,
        warnings: ["No default fallback data configured"],
      });
    }

    return Promise.resolve({
      success: true,
      data: strategy.fallbackData as T,
      strategy: "default",
      degraded: true,
      warnings: [
        `Using default values due to ${strategy.serviceName} failure`,
        "Data may not reflect current conditions",
      ],
    });
  }

  /**
   * Execute alternative service fallback strategy
   */
  private async executeAlternativeStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string,
    originalData?: FallbackData
  ): Promise<FallbackResult<T>> {
    if (!strategy.alternativeService) {
      return {
        success: false,
        strategy: "alternative",
        degraded: false,
        warnings: ["No alternative service configured"],
      };
    }

    // This would typically call an alternative service
    // For now, we'll simulate with cached data or defaults
    const alternativeData = await this.getAlternativeServiceData<T>(
      strategy.alternativeService,
      operation,
      originalData
    );

    if (alternativeData) {
      return {
        success: true,
        data: alternativeData,
        strategy: "alternative",
        degraded: true,
        alternativeUsed: true,
        warnings: [
          `Using alternative service: ${strategy.alternativeService}`,
          "Data source may differ from primary service",
        ],
      };
    }

    return {
      success: false,
      strategy: "alternative",
      degraded: false,
      warnings: ["Alternative service also unavailable"],
    };
  }

  /**
   * Execute skip operation fallback strategy
   */
  private executeSkipStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string
  ): Promise<FallbackResult<T>> {
    return Promise.resolve({
      success: true,
      data: null as T,
      strategy: "skip",
      degraded: true,
      warnings: [
        `Operation ${operation} skipped due to ${strategy.serviceName} failure`,
        "Some functionality may be limited",
      ],
    });
  }

  /**
   * Execute service degradation fallback strategy
   */
  private async executeDegradeStrategy<T>(
    strategy: FallbackStrategy,
    error: BaseError,
    operation: string,
    originalData?: FallbackData
  ): Promise<FallbackResult<T>> {
    const degradationConfig = this.degradationConfigs.get(strategy.serviceName);

    if (!degradationConfig) {
      return {
        success: false,
        strategy: "degrade",
        degraded: false,
        warnings: ["No degradation configuration available"],
      };
    }

    // Apply degradation based on level
    const degradedData = await this.applyServiceDegradation<T>(
      strategy,
      degradationConfig,
      operation,
      originalData
    );

    if (degradedData) {
      // Notify user if required
      if (degradationConfig.userNotificationRequired) {
        await this.notifyServiceDegradation(
          strategy.serviceName,
          strategy.degradationLevel || "partial",
          operation
        );
      }

      return {
        success: true,
        data: degradedData,
        strategy: "degrade",
        degraded: true,
        warnings: [
          `Service ${strategy.serviceName} running in degraded mode`,
          `Degradation level: ${strategy.degradationLevel || "partial"}`,
        ],
      };
    }

    return {
      success: false,
      strategy: "degrade",
      degraded: false,
      warnings: ["Service degradation failed"],
    };
  }

  /**
   * Apply service degradation based on configuration
   */
  private async applyServiceDegradation<T>(
    strategy: FallbackStrategy,
    config: ServiceDegradationConfig,
    operation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    const degradationLevel = strategy.degradationLevel || "partial";

    switch (degradationLevel) {
      case "minimal":
        // Minimal degradation - reduce functionality slightly
        return await this.applyMinimalDegradation<T>(
          config,
          operation,
          originalData
        );

      case "partial":
        // Partial degradation - significant functionality reduction
        return await this.applyPartialDegradation<T>(
          config,
          operation,
          originalData
        );

      case "full":
        // Full degradation - basic functionality only
        return await this.applyFullDegradation<T>(
          config,
          operation,
          originalData
        );

      default:
        return null;
    }
  }

  /**
   * Apply minimal service degradation
   */
  private async applyMinimalDegradation<T>(
    config: ServiceDegradationConfig,
    operation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    // Try to maintain most functionality with reduced features
    const cacheKey = `degraded:${config.serviceName}:${operation}:minimal`;
    const cachedData = await this.cacheService.get<T>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Return simplified version of expected data
    return this.getSimplifiedData<T>(config.serviceName, operation);
  }

  /**
   * Apply partial service degradation
   */
  private async applyPartialDegradation<T>(
    config: ServiceDegradationConfig,
    operation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    // Significant functionality reduction
    if (config.fallbackOperations.length > 0) {
      // Use fallback operations
      return this.executeFallbackOperation<T>(
        config.fallbackOperations[0],
        operation,
        originalData
      );
    }

    return this.getBasicData<T>(config.serviceName, operation);
  }

  /**
   * Apply full service degradation
   */
  private async applyFullDegradation<T>(
    config: ServiceDegradationConfig,
    operation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    // Basic functionality only
    return this.getBasicData<T>(config.serviceName, operation);
  }

  /**
   * Get alternative service data
   */
  private async getAlternativeServiceData<T>(
    alternativeService: string,
    operation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    // This would typically integrate with actual alternative services
    // For now, return cached or default data
    const cacheKey = `alternative:${alternativeService}:${operation}`;
    return await this.cacheService.get<T>(cacheKey);
  }

  /**
   * Get simplified data for minimal degradation
   */
  private getSimplifiedData<T>(
    serviceName: string,
    operation: string
  ): T | null {
    const simplifiedDataMap: Record<string, Record<string, any>> = {
      weather_api: {
        forecast: {
          temperature: null,
          description: "Weather data temporarily unavailable",
          simplified: true,
        },
      },
      maps_api: {
        route_calculation: {
          duration: 3600,
          distance: 30000,
          route: "Estimated route",
          simplified: true,
        },
      },
    };

    return simplifiedDataMap[serviceName]?.[operation] || null;
  }

  /**
   * Get basic data for degraded operations
   */
  private getBasicData<T>(serviceName: string, operation: string): T | null {
    const basicDataMap: Record<string, Record<string, any>> = {
      weather_api: {
        forecast: {
          temperature: 15,
          description: "Mild conditions (estimated)",
          basic: true,
        },
      },
      maps_api: {
        route_calculation: {
          duration: 3600,
          distance: 30000,
          route: "Standard route estimate",
          basic: true,
        },
      },
    };

    return basicDataMap[serviceName]?.[operation] || null;
  }

  /**
   * Execute fallback operation
   */
  private async executeFallbackOperation<T>(
    fallbackOperation: string,
    originalOperation: string,
    originalData?: FallbackData
  ): Promise<T | null> {
    // This would typically execute alternative operations
    // For now, return cached data or null
    const cacheKey = `fallback_op:${fallbackOperation}:${originalOperation}`;
    return await this.cacheService.get<T>(cacheKey);
  }

  /**
   * Notify user of service degradation
   */
  private async notifyServiceDegradation(
    serviceName: string,
    degradationLevel: string,
    operation: string
  ): Promise<void> {
    try {
      await this.notificationService.sendSystemAlert({
        type: "service_degradation",
        serviceName,
        errorCode: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        impact: degradationLevel === "full" ? "high" : "medium",
        affectedOperations: [operation],
        estimatedRecoveryTime: degradationLevel === "full" ? 1800 : 600, // 30 min or 10 min
        timestamp: new Date(),
      });
    } catch (error) {
      structuredLogger.error("Failed to send degradation notification", {
        serviceName,
        degradationLevel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add fallback strategy
   */
  private addFallbackStrategy(strategy: FallbackStrategy): void {
    const key = `${strategy.serviceName}:${strategy.errorCode}`;
    const existing = this.fallbackStrategies.get(key) || [];
    existing.push(strategy);
    existing.sort((a, b) => a.priority - b.priority);
    this.fallbackStrategies.set(key, existing);
  }

  /**
   * Add degradation configuration
   */
  private addDegradationConfig(config: ServiceDegradationConfig): void {
    this.degradationConfigs.set(config.serviceName, config);
  }

  /**
   * Get fallback strategies for service and error
   */
  private getFallbackStrategies(
    serviceName: string,
    errorCode: ErrorCode
  ): FallbackStrategy[] {
    const key = `${serviceName}:${errorCode}`;
    return this.fallbackStrategies.get(key) || [];
  }

  /**
   * Record fallback usage for monitoring
   */
  private recordFallbackUsage(serviceName: string, strategy: string): void {
    const key = `${serviceName}:${strategy}`;
    const current = this.fallbackUsageStats.get(key) || 0;
    this.fallbackUsageStats.set(key, current + 1);
  }

  /**
   * Get fallback usage statistics
   */
  public getFallbackUsageStats(): Record<string, number> {
    return Object.fromEntries(this.fallbackUsageStats.entries());
  }

  /**
   * Reset fallback usage statistics
   */
  public resetFallbackUsageStats(): void {
    this.fallbackUsageStats.clear();
  }
}
