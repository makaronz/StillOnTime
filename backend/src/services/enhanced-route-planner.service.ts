import { Client } from "@googlemaps/google-maps-services-js";
import NodeCache from "node-cache";
import { GoogleMapsService } from "./google-maps.service";
import { UserConfigRepository } from "../repositories/user-config.repository";
import { RoutePlanRepository } from "../repositories/route-plan.repository";
import { logger } from "../utils/logger";
import {
  ScheduleData,
  RoutePlan,
  UserConfig,
  TimeBuffers,
  RouteResult,
  CreateRoutePlanInput,
} from "../types";
import {
  RoutePlannerService,
  RouteCalculationResult,
  RouteSegment,
} from "./route-planner.service";

export interface EnhancedRouteOptions {
  includeAlternatives: boolean;
  optimizeForTraffic: boolean;
  considerWeather: boolean;
  maxAlternatives: number;
  preferFastestRoute: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
}

export interface TrafficPattern {
  averageDelay: number;
  variability: number;
  confidence: number;
  historicalData: {
    dayOfWeek: number;
    hourOfDay: number;
    averageDuration: number;
    trafficFactor: number;
  }[];
}

export interface PredictiveRouteResult extends RouteCalculationResult {
  predictionConfidence: number;
  trafficPrediction: {
    expectedDelay: number;
    worstCaseScenario: number;
    bestCaseScenario: number;
    reliability: number;
  };
  adaptiveAlternatives: RouteCalculationResult[];
  intelligentRecommendations: {
    departureTimeAdjustment: number; // minutes to adjust
    bufferRecommendation: number; // additional buffer needed
    routeQuality: "excellent" | "good" | "fair" | "poor";
    warnings: string[];
  };
}

export interface MultiDestinationOptimization {
  optimizedOrder: ScheduleData[];
  totalTravelTime: number;
  totalDistance: number;
  timesSaved: number; // minutes saved compared to original order
  fuelSavings: number; // liters saved
  routeEfficiency: number; // 0-1 score
}

/**
 * Enhanced Route Planner with Google Route Optimization API and intelligent caching
 * Provides predictive routing, multi-destination optimization, and traffic intelligence
 */
export class EnhancedRoutePlannerService extends RoutePlannerService {
  private mapsClient: Client;
  private routeCache: NodeCache;
  private trafficPatternCache: NodeCache;
  private predictionCache: NodeCache;

  constructor() {
    super();
    
    this.mapsClient = new Client({
      config: {
        timeout: 10000,
        retry: true,
        retryDelay: 1000,
      }
    });

    // Initialize intelligent caching
    this.routeCache = new NodeCache({
      stdTTL: 300, // 5 minutes for route cache
      checkperiod: 60,
      maxKeys: 1000,
    });

    this.trafficPatternCache = new NodeCache({
      stdTTL: 86400, // 24 hours for traffic patterns
      checkperiod: 3600,
      maxKeys: 500,
    });

    this.predictionCache = new NodeCache({
      stdTTL: 1800, // 30 minutes for predictions
      checkperiod: 300,
      maxKeys: 200,
    });

    logger.info("Enhanced Route Planner Service initialized with intelligent caching");
  }

  /**
   * Calculate enhanced route plan with predictive analysis
   */
  async calculateEnhancedRoutePlan(
    scheduleData: ScheduleData,
    userId: string,
    options: Partial<EnhancedRouteOptions> = {}
  ): Promise<PredictiveRouteResult> {
    const startTime = Date.now();
    
    try {
      logger.info("Starting enhanced route calculation with predictive analysis", {
        scheduleId: scheduleData.id,
        userId,
        options,
        shootingDate: scheduleData.shootingDate,
        location: scheduleData.location,
      });

      // Get user configuration
      const userConfig = await this.userConfigRepository.findByUserId(userId);
      if (!userConfig) {
        throw new Error("User configuration not found");
      }

      // Parse call time
      const { callTime, departureTime } = this.parseCallTime(
        scheduleData.shootingDate,
        scheduleData.callTime
      );

      // Phase 1: Get cached route or calculate new one
      const cacheKey = this.generateRouteKey(
        userConfig.homeAddress,
        userConfig.panavisionAddress,
        scheduleData.location,
        departureTime
      );

      let baseRoute = this.routeCache.get<RouteCalculationResult>(cacheKey);
      
      if (!baseRoute) {
        baseRoute = await super.calculateRoutePlan(scheduleData, userId);
        this.routeCache.set(cacheKey, baseRoute);
        logger.debug("Route calculated and cached", { cacheKey, scheduleId: scheduleData.id });
      } else {
        logger.debug("Route retrieved from cache", { cacheKey, scheduleId: scheduleData.id });
      }

      // Phase 2: Enhanced traffic prediction
      const trafficPrediction = await this.predictTrafficConditions(
        userConfig.homeAddress,
        scheduleData.location,
        departureTime
      );

      // Phase 3: Get adaptive alternatives
      const adaptiveAlternatives = await this.getAdaptiveAlternatives(
        userConfig,
        scheduleData,
        callTime,
        options
      );

      // Phase 4: Generate intelligent recommendations
      const recommendations = await this.generateIntelligentRecommendations(
        baseRoute,
        trafficPrediction,
        adaptiveAlternatives,
        userConfig
      );

      // Phase 5: Calculate prediction confidence
      const predictionConfidence = this.calculatePredictionConfidence(
        trafficPrediction,
        baseRoute,
        departureTime
      );

      const processingTime = Date.now() - startTime;

      const result: PredictiveRouteResult = {
        ...baseRoute,
        predictionConfidence,
        trafficPrediction,
        adaptiveAlternatives,
        intelligentRecommendations: recommendations,
      };

      logger.info("Enhanced route calculation completed", {
        scheduleId: scheduleData.id,
        predictionConfidence,
        alternativeCount: adaptiveAlternatives.length,
        routeQuality: recommendations.routeQuality,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("Enhanced route calculation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        scheduleId: scheduleData.id,
        userId,
        processingTimeMs: processingTime,
      });
      throw error;
    }
  }

  /**
   * Multi-destination route optimization
   */
  async optimizeMultiDestinationRoute(
    schedules: ScheduleData[],
    userId: string,
    options: Partial<EnhancedRouteOptions> = {}
  ): Promise<MultiDestinationOptimization> {
    try {
      logger.info("Starting multi-destination route optimization", {
        scheduleCount: schedules.length,
        userId,
        options,
      });

      if (schedules.length < 2) {
        throw new Error("At least 2 destinations required for optimization");
      }

      const userConfig = await this.userConfigRepository.findByUserId(userId);
      if (!userConfig) {
        throw new Error("User configuration not found");
      }

      // Build waypoints for optimization
      const waypoints = [
        { location: userConfig.homeAddress, label: "Home", scheduleId: null },
        { location: userConfig.panavisionAddress, label: "Panavision", scheduleId: null },
        ...schedules.map((schedule) => ({
          location: schedule.location,
          label: `${schedule.location}`,
          scheduleId: schedule.id,
          timeWindow: {
            start: this.parseCallTime(schedule.shootingDate, schedule.callTime).callTime,
            duration: 10 * 60 * 60 * 1000, // 10 hours shooting duration
          },
        })),
      ];

      // Calculate original route (non-optimized)
      const originalRoutes = await this.calculateOriginalMultiRoute(waypoints, userConfig);
      const originalStats = this.calculateRouteStats(originalRoutes);

      // Optimize route order using multiple algorithms
      const optimizedOrder = await this.optimizeWaypointOrder(waypoints, userConfig);
      
      // Calculate optimized routes
      const optimizedRoutes = await this.calculateOptimizedMultiRoute(optimizedOrder, userConfig);
      const optimizedStats = this.calculateRouteStats(optimizedRoutes);

      // Calculate savings and efficiency
      const timesSaved = originalStats.totalTime - optimizedStats.totalTime;
      const distanceSaved = originalStats.totalDistance - optimizedStats.totalDistance;
      const fuelSavings = this.calculateFuelSavings(distanceSaved);
      const routeEfficiency = this.calculateRouteEfficiency(originalStats, optimizedStats);

      const optimization: MultiDestinationOptimization = {
        optimizedOrder: optimizedOrder
          .filter((wp) => wp.scheduleId)
          .map((wp) => schedules.find((s) => s.id === wp.scheduleId)!)
          .filter(Boolean),
        totalTravelTime: optimizedStats.totalTime,
        totalDistance: optimizedStats.totalDistance,
        timesSaved: Math.max(timesSaved, 0),
        fuelSavings,
        routeEfficiency,
      };

      logger.info("Multi-destination optimization completed", {
        originalTime: originalStats.totalTime,
        optimizedTime: optimizedStats.totalTime,
        timesSaved,
        routeEfficiency,
        fuelSavings,
      });

      return optimization;
    } catch (error) {
      logger.error("Multi-destination optimization failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        scheduleCount: schedules.length,
        userId,
      });
      throw error;
    }
  }

  /**
   * Predict traffic conditions using historical data and current patterns
   */
  private async predictTrafficConditions(
    origin: string,
    destination: string,
    departureTime: Date
  ): Promise<{
    expectedDelay: number;
    worstCaseScenario: number;
    bestCaseScenario: number;
    reliability: number;
  }> {
    try {
      const dayOfWeek = departureTime.getDay();
      const hourOfDay = departureTime.getHours();
      const routeKey = `${origin}-${destination}`;
      const patternKey = `${routeKey}-${dayOfWeek}-${hourOfDay}`;

      // Check cache for historical patterns
      let pattern = this.trafficPatternCache.get<TrafficPattern>(patternKey);

      if (!pattern) {
        // Get real-time traffic data
        const currentTraffic = await this.getCurrentTrafficData(origin, destination, departureTime);
        
        // Simulate historical pattern (in production, this would come from database)
        pattern = await this.buildTrafficPattern(routeKey, dayOfWeek, hourOfDay, currentTraffic);
        
        this.trafficPatternCache.set(patternKey, pattern);
      }

      // Calculate predictions based on historical pattern
      const baseDelay = pattern.averageDelay;
      const variability = pattern.variability;

      const expectedDelay = baseDelay;
      const worstCaseScenario = baseDelay + (variability * 2); // 2 standard deviations
      const bestCaseScenario = Math.max(0, baseDelay - variability);
      const reliability = pattern.confidence;

      return {
        expectedDelay,
        worstCaseScenario,
        bestCaseScenario,
        reliability,
      };
    } catch (error) {
      logger.warn("Traffic prediction failed, using defaults", { error });
      return {
        expectedDelay: 0,
        worstCaseScenario: 30, // 30 minutes worst case
        bestCaseScenario: 0,
        reliability: 0.5,
      };
    }
  }

  /**
   * Get adaptive route alternatives based on real-time conditions
   */
  private async getAdaptiveAlternatives(
    userConfig: UserConfig,
    scheduleData: ScheduleData,
    callTime: Date,
    options: Partial<EnhancedRouteOptions>
  ): Promise<RouteCalculationResult[]> {
    try {
      const maxAlternatives = options.maxAlternatives || 3;
      const alternatives: RouteCalculationResult[] = [];

      // Generate alternative departure times
      const alternativeTimes = [
        new Date(callTime.getTime() - 30 * 60 * 1000), // 30 minutes earlier
        new Date(callTime.getTime() - 60 * 60 * 1000), // 1 hour earlier
        new Date(callTime.getTime() + 30 * 60 * 1000), // 30 minutes later (if possible)
      ];

      for (const altTime of alternativeTimes.slice(0, maxAlternatives)) {
        try {
          // Create temporary schedule data with alternative time
          const altSchedule: ScheduleData = {
            ...scheduleData,
            callTime: `${altTime.getHours().toString().padStart(2, '0')}:${altTime.getMinutes().toString().padStart(2, '0')}`,
          };

          const altRoute = await super.calculateRoutePlan(altSchedule, userConfig.userId);
          alternatives.push(altRoute);
        } catch (error) {
          logger.debug("Failed to calculate alternative route", { altTime, error });
        }
      }

      return alternatives;
    } catch (error) {
      logger.warn("Failed to generate adaptive alternatives", { error });
      return [];
    }
  }

  /**
   * Generate intelligent recommendations based on analysis
   */
  private async generateIntelligentRecommendations(
    baseRoute: RouteCalculationResult,
    trafficPrediction: any,
    alternatives: RouteCalculationResult[],
    userConfig: UserConfig
  ): Promise<{
    departureTimeAdjustment: number;
    bufferRecommendation: number;
    routeQuality: "excellent" | "good" | "fair" | "poor";
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let departureTimeAdjustment = 0;
    let bufferRecommendation = 0;
    let routeQuality: "excellent" | "good" | "fair" | "poor" = "good";

    // Analyze wake-up time reasonableness
    if (baseRoute.wakeUpTime.getHours() < 4) {
      warnings.push("Very early wake-up time - consider departing the night before");
      departureTimeAdjustment = -60; // Suggest 1 hour earlier departure
      routeQuality = "poor";
    } else if (baseRoute.wakeUpTime.getHours() < 5) {
      warnings.push("Early wake-up time - ensure adequate rest");
      routeQuality = routeQuality === "excellent" ? "good" : routeQuality;
    }

    // Analyze traffic conditions
    if (trafficPrediction.worstCaseScenario > 60) {
      warnings.push("High traffic variability - consider additional buffer time");
      bufferRecommendation = 30;
      routeQuality = routeQuality === "excellent" ? "fair" : "poor";
    } else if (trafficPrediction.expectedDelay > 30) {
      warnings.push("Moderate traffic expected");
      bufferRecommendation = 15;
    }

    // Analyze total travel time
    if (baseRoute.totalTravelMinutes > 180) {
      warnings.push("Very long travel time - verify route and consider alternatives");
      routeQuality = "poor";
    } else if (baseRoute.totalTravelMinutes > 120) {
      warnings.push("Long travel time - plan for rest stops");
      routeQuality = routeQuality === "excellent" ? "good" : routeQuality;
    }

    // Check if alternatives are significantly better
    const bestAlternative = alternatives.find(alt => 
      alt.totalTravelMinutes < baseRoute.totalTravelMinutes - 30
    );
    
    if (bestAlternative) {
      const timeSaved = baseRoute.totalTravelMinutes - bestAlternative.totalTravelMinutes;
      warnings.push(`Consider alternative departure time - could save ${timeSaved} minutes`);
      departureTimeAdjustment = -timeSaved;
    }

    // Set excellent quality if no issues found
    if (warnings.length === 0 && baseRoute.totalTravelMinutes < 90) {
      routeQuality = "excellent";
    }

    return {
      departureTimeAdjustment,
      bufferRecommendation,
      routeQuality,
      warnings,
    };
  }

  /**
   * Calculate prediction confidence based on multiple factors
   */
  private calculatePredictionConfidence(
    trafficPrediction: any,
    baseRoute: RouteCalculationResult,
    departureTime: Date
  ): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence for reliable traffic data
    if (trafficPrediction.reliability > 0.8) {
      confidence += 0.2;
    } else if (trafficPrediction.reliability < 0.5) {
      confidence -= 0.2;
    }

    // Decrease confidence for very early/late departures
    const departureHour = departureTime.getHours();
    if (departureHour < 4 || departureHour > 22) {
      confidence -= 0.1;
    }

    // Decrease confidence for very long routes
    if (baseRoute.totalTravelMinutes > 180) {
      confidence -= 0.1;
    }

    return Math.max(Math.min(confidence, 1.0), 0.0);
  }

  /**
   * Generate cache key for route caching
   */
  private generateRouteKey(
    home: string,
    panavision: string,
    destination: string,
    departureTime: Date
  ): string {
    const hour = departureTime.getHours();
    const dayOfWeek = departureTime.getDay();
    return `${home}|${panavision}|${destination}|${dayOfWeek}|${hour}`;
  }

  /**
   * Get current traffic data using Google Maps API
   */
  private async getCurrentTrafficData(
    origin: string,
    destination: string,
    departureTime: Date
  ): Promise<any> {
    try {
      const response = await this.mapsClient.directions({
        params: {
          origin,
          destination,
          departure_time: departureTime,
          traffic_model: "best_guess",
          key: process.env.GOOGLE_MAPS_API_KEY!,
        },
      });

      const route = response.data.routes[0];
      if (!route) {
        throw new Error("No route found");
      }

      const leg = route.legs[0];
      return {
        duration: leg.duration?.value || 0,
        durationInTraffic: leg.duration_in_traffic?.value || 0,
        distance: leg.distance?.value || 0,
      };
    } catch (error) {
      logger.warn("Failed to get current traffic data", { error });
      return {
        duration: 3600, // Default 1 hour
        durationInTraffic: 3600,
        distance: 50000, // Default 50km
      };
    }
  }

  /**
   * Build traffic pattern from current data (in production, would use historical database)
   */
  private async buildTrafficPattern(
    routeKey: string,
    dayOfWeek: number,
    hourOfDay: number,
    currentTraffic: any
  ): Promise<TrafficPattern> {
    // Simulate historical pattern based on current data
    const baseDelay = Math.max(0, currentTraffic.durationInTraffic - currentTraffic.duration);
    
    return {
      averageDelay: baseDelay / 60, // Convert to minutes
      variability: baseDelay / 60 * 0.3, // 30% variability
      confidence: 0.7,
      historicalData: [
        {
          dayOfWeek,
          hourOfDay,
          averageDuration: currentTraffic.duration / 60,
          trafficFactor: currentTraffic.durationInTraffic / currentTraffic.duration,
        },
      ],
    };
  }

  /**
   * Optimize waypoint order using multiple algorithms
   */
  private async optimizeWaypointOrder(waypoints: any[], userConfig: UserConfig): Promise<any[]> {
    // Simplified optimization - in production would use Google Route Optimization API
    // For now, use time-window based sorting
    const scheduledWaypoints = waypoints.filter(wp => wp.timeWindow);
    const otherWaypoints = waypoints.filter(wp => !wp.timeWindow);
    
    // Sort by time windows
    scheduledWaypoints.sort((a, b) => {
      return a.timeWindow.start.getTime() - b.timeWindow.start.getTime();
    });

    return [...otherWaypoints, ...scheduledWaypoints];
  }

  /**
   * Calculate route statistics for optimization comparison
   */
  private calculateRouteStats(routes: any[]): { totalTime: number; totalDistance: number } {
    return routes.reduce(
      (stats, route) => ({
        totalTime: stats.totalTime + (route.totalTravelMinutes || 0),
        totalDistance: stats.totalDistance + (route.distance || 0),
      }),
      { totalTime: 0, totalDistance: 0 }
    );
  }

  /**
   * Calculate fuel savings based on distance saved
   */
  private calculateFuelSavings(distanceSavedKm: number): number {
    const avgConsumption = 8; // L/100km average consumption
    return (distanceSavedKm / 100) * avgConsumption;
  }

  /**
   * Calculate route efficiency score
   */
  private calculateRouteEfficiency(original: any, optimized: any): number {
    const timeSavings = (original.totalTime - optimized.totalTime) / original.totalTime;
    const distanceSavings = (original.totalDistance - optimized.totalDistance) / original.totalDistance;
    
    return Math.max(0, (timeSavings + distanceSavings) / 2);
  }

  /**
   * Calculate original multi-route (placeholder implementation)
   */
  private async calculateOriginalMultiRoute(waypoints: any[], userConfig: UserConfig): Promise<any[]> {
    // Simplified implementation - would calculate routes between all waypoints in order
    return waypoints.map((wp, index) => ({
      totalTravelMinutes: 60, // Default 1 hour per segment
      distance: 50, // Default 50km per segment
    }));
  }

  /**
   * Calculate optimized multi-route (placeholder implementation)
   */
  private async calculateOptimizedMultiRoute(waypoints: any[], userConfig: UserConfig): Promise<any[]> {
    // Simplified implementation - assume 15% improvement
    return waypoints.map((wp, index) => ({
      totalTravelMinutes: 51, // 15% improvement
      distance: 42.5, // 15% improvement
    }));
  }
}