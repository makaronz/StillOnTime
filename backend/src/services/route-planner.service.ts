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

export interface RouteCalculationResult {
  wakeUpTime: Date;
  departureTime: Date;
  arrivalTime: Date;
  totalTravelMinutes: number;
  routeSegments: RouteSegment[];
  buffers: TimeBuffers;
  warnings: string[];
  alternatives?: RouteCalculationResult[];
}

export interface RouteSegment {
  from: string;
  to: string;
  distance: string;
  duration: string;
  durationInTraffic?: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
  }>;
}

export class RoutePlannerService {
  private googleMapsService: GoogleMapsService;
  protected userConfigRepository: UserConfigRepository;
  private routePlanRepository: RoutePlanRepository;

  constructor() {
    this.googleMapsService = new GoogleMapsService();
    this.userConfigRepository = new UserConfigRepository();
    this.routePlanRepository = new RoutePlanRepository();
  }

  /**
   * Calculate complete route plan for a shooting schedule
   */
  async calculateRoutePlan(
    scheduleData: ScheduleData,
    userId: string
  ): Promise<RouteCalculationResult> {
    try {
      logger.info("Starting route calculation", {
        scheduleId: scheduleData.id,
        userId,
        shootingDate: scheduleData.shootingDate,
        callTime: scheduleData.callTime,
        location: scheduleData.location,
      });

      // Get user configuration for addresses and buffers
      const userConfig = await this.userConfigRepository.findByUserId(userId);
      if (!userConfig) {
        throw new Error(
          "User configuration not found. Please set up your addresses and preferences."
        );
      }

      // Parse call time and create departure time
      const { callTime, departureTime } = this.parseCallTime(
        scheduleData.shootingDate,
        scheduleData.callTime
      );

      // Calculate routes with traffic data
      const routes = await this.googleMapsService.calculateStillOnTimeRoute(
        userConfig.homeAddress,
        userConfig.panavisionAddress,
        scheduleData.location,
        departureTime
      );

      if (routes.length === 0) {
        throw new Error("No routes found for the specified addresses");
      }

      const primaryRoute = routes[0];
      const alternativeRoutes = routes.slice(1);

      // Extract time buffers from user config
      const buffers: TimeBuffers = {
        carChange: userConfig.bufferCarChange,
        parking: userConfig.bufferParking,
        entry: userConfig.bufferEntry,
        traffic: userConfig.bufferTraffic,
        morningRoutine: userConfig.bufferMorningRoutine,
      };

      // Calculate total travel time including buffers
      const travelTimeMinutes = this.extractTravelTimeMinutes(primaryRoute);
      const totalBufferMinutes = this.calculateTotalBuffers(buffers);
      const totalTravelMinutes = travelTimeMinutes + totalBufferMinutes;

      // Calculate wake-up time
      const wakeUpTime = new Date(
        callTime.getTime() - totalTravelMinutes * 60 * 1000
      );
      const actualDepartureTime = new Date(
        callTime.getTime() - travelTimeMinutes * 60 * 1000
      );

      // Create route segments
      const routeSegments = await this.createRouteSegments(
        userConfig.homeAddress,
        userConfig.panavisionAddress,
        scheduleData.location,
        primaryRoute
      );

      // Validate and generate warnings
      const warnings = this.generateWarnings(
        wakeUpTime,
        totalTravelMinutes,
        buffers
      );

      // Calculate alternatives if available
      const alternatives = await Promise.all(
        alternativeRoutes.map((route) =>
          this.calculateAlternativeRoute(
            route,
            callTime,
            buffers,
            userConfig,
            scheduleData
          )
        )
      );

      const result: RouteCalculationResult = {
        wakeUpTime,
        departureTime: actualDepartureTime,
        arrivalTime: callTime,
        totalTravelMinutes,
        routeSegments,
        buffers,
        warnings,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };

      logger.info("Route calculation completed successfully", {
        scheduleId: scheduleData.id,
        wakeUpTime: wakeUpTime.toISOString(),
        departureTime: actualDepartureTime.toISOString(),
        totalTravelMinutes,
        warningCount: warnings.length,
        alternativeCount: alternatives.length,
      });

      return result;
    } catch (error) {
      logger.error("Failed to calculate route plan", {
        error: error instanceof Error ? error.message : "Unknown error",
        scheduleId: scheduleData.id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Save calculated route plan to database
   */
  async saveRoutePlan(
    routeCalculation: RouteCalculationResult,
    scheduleId: string,
    userId: string
  ): Promise<RoutePlan> {
    const routePlanData: CreateRoutePlanInput = {
      wakeUpTime: routeCalculation.wakeUpTime,
      departureTime: routeCalculation.departureTime,
      arrivalTime: routeCalculation.arrivalTime,
      totalTravelMinutes: routeCalculation.totalTravelMinutes,
      routeSegments: routeCalculation.routeSegments as any,
      buffers: routeCalculation.buffers as any,
      user: { connect: { id: userId } },
      schedule: { connect: { id: scheduleId } },
    };

    return this.routePlanRepository.create(routePlanData);
  }

  /**
   * Recalculate existing route plan with updated traffic data
   */
  async recalculateRoutePlan(
    routePlanId: string
  ): Promise<RouteCalculationResult> {
    const existingPlan = await this.routePlanRepository.findByIdWithRelations(
      routePlanId
    );
    if (!existingPlan) {
      throw new Error("Route plan not found");
    }

    return this.calculateRoutePlan(existingPlan.schedule, existingPlan.userId);
  }

  /**
   * Get route recommendations based on historical data
   */
  async getRouteRecommendations(
    userId: string,
    location: string
  ): Promise<{
    recommendedBuffers: TimeBuffers;
    averageTravelTime: number;
    bestDepartureTime: string;
  }> {
    // This would analyze historical route data for similar locations
    // For now, return default recommendations
    const userConfig = await this.userConfigRepository.findByUserId(userId);

    return {
      recommendedBuffers: {
        carChange: userConfig?.bufferCarChange || 15,
        parking: userConfig?.bufferParking || 10,
        entry: userConfig?.bufferEntry || 10,
        traffic: userConfig?.bufferTraffic || 20,
        morningRoutine: userConfig?.bufferMorningRoutine || 45,
      },
      averageTravelTime: 60, // Default 1 hour
      bestDepartureTime: "06:00", // Default recommendation
    };
  }

  /**
   * Parse call time string and create Date objects
   */
  protected parseCallTime(
    shootingDate: Date,
    callTimeStr: string
  ): {
    callTime: Date;
    departureTime: Date;
  } {
    const [hours, minutes] = callTimeStr.split(":").map(Number);

    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new Error(
        `Invalid call time format: ${callTimeStr}. Expected HH:MM format.`
      );
    }

    const callTime = new Date(shootingDate);
    callTime.setUTCHours(hours, minutes, 0, 0);

    // Create departure time (will be adjusted after route calculation)
    const departureTime = new Date(callTime);

    return { callTime, departureTime };
  }

  /**
   * Extract travel time in minutes from route result
   */
  private extractTravelTimeMinutes(route: RouteResult): number {
    const durationStr = route.durationInTraffic || route.duration;

    // Parse duration string like "1h 30min" or "45min"
    const hourMatch = durationStr.match(/(\d+)h/);
    const minuteMatch = durationStr.match(/(\d+)min/);

    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

    return hours * 60 + minutes;
  }

  /**
   * Calculate total buffer time in minutes
   */
  private calculateTotalBuffers(buffers: TimeBuffers): number {
    return (
      buffers.carChange +
      buffers.parking +
      buffers.entry +
      buffers.traffic +
      buffers.morningRoutine
    );
  }

  /**
   * Create route segments for Dom→Panavision→Location
   */
  private async createRouteSegments(
    homeAddress: string,
    panavisionAddress: string,
    locationAddress: string,
    route: RouteResult
  ): Promise<RouteSegment[]> {
    // For now, create a simplified segment structure
    // In a full implementation, we would parse the route legs properly
    return [
      {
        from: "Dom",
        to: "Panavision",
        distance: route.distance,
        duration: route.duration,
        durationInTraffic: route.durationInTraffic,
        steps: route.steps.slice(0, Math.floor(route.steps.length / 2)),
      },
      {
        from: "Panavision",
        to: "Lokacja",
        distance: route.distance,
        duration: route.duration,
        durationInTraffic: route.durationInTraffic,
        steps: route.steps.slice(Math.floor(route.steps.length / 2)),
      },
    ];
  }

  /**
   * Generate warnings for unreasonable times or conditions
   */
  private generateWarnings(
    wakeUpTime: Date,
    totalTravelMinutes: number,
    buffers: TimeBuffers
  ): string[] {
    const warnings: string[] = [];

    // Check if wake-up time is too early
    if (wakeUpTime.getUTCHours() < 4) {
      warnings.push(
        `Wake up time (${wakeUpTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}) is very early. Consider increasing time buffers or departing the previous day.`
      );
    }

    // Check if total travel time is excessive
    if (totalTravelMinutes > 180) {
      // More than 3 hours
      warnings.push(
        `Całkowity czas podróży (${Math.floor(totalTravelMinutes / 60)}h ${
          totalTravelMinutes % 60
        }min) jest bardzo długi. Sprawdź trasę i rozważ alternatywne opcje.`
      );
    }

    // Check if traffic buffer might be insufficient
    if (buffers.traffic < 30 && totalTravelMinutes > 90) {
      warnings.push(
        "Bufor na korki może być niewystarczający dla tak długiej trasy. Rozważ zwiększenie bufora ruchu."
      );
    }

    return warnings;
  }

  /**
   * Calculate alternative route option
   */
  private async calculateAlternativeRoute(
    route: RouteResult,
    callTime: Date,
    buffers: TimeBuffers,
    userConfig: UserConfig,
    scheduleData: ScheduleData
  ): Promise<RouteCalculationResult> {
    const travelTimeMinutes = this.extractTravelTimeMinutes(route);
    const totalBufferMinutes = this.calculateTotalBuffers(buffers);
    const totalTravelMinutes = travelTimeMinutes + totalBufferMinutes;

    const wakeUpTime = new Date(
      callTime.getTime() - totalTravelMinutes * 60 * 1000
    );
    const departureTime = new Date(
      callTime.getTime() - travelTimeMinutes * 60 * 1000
    );

    const routeSegments = await this.createRouteSegments(
      userConfig.homeAddress,
      userConfig.panavisionAddress,
      scheduleData.location,
      route
    );

    const warnings = this.generateWarnings(
      wakeUpTime,
      totalTravelMinutes,
      buffers
    );

    return {
      wakeUpTime,
      departureTime,
      arrivalTime: callTime,
      totalTravelMinutes,
      routeSegments,
      buffers,
      warnings,
    };
  }
}
