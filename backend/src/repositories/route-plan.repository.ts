import { prisma } from "@/prisma";
import {
  RoutePlan,
  CreateRoutePlanInput,
  UpdateRoutePlanInput,
  RouteSegment,
  TimeBuffers,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";
import { Prisma } from "@prisma/client";

/**
 * RoutePlan Repository Interface
 */
export interface IRoutePlanRepository {
  // Base CRUD operations using Prisma Args
  create(args: Prisma.RoutePlanCreateArgs): Promise<RoutePlan>;
  findById(id: string): Promise<RoutePlan | null>;
  update(args: Prisma.RoutePlanUpdateArgs): Promise<RoutePlan>;
  delete(args: Prisma.RoutePlanDeleteArgs): Promise<RoutePlan>;

  // RoutePlan-specific operations
  findByScheduleId(scheduleId: string): Promise<RoutePlan | null>;
  findByIdWithRelations(id: string): Promise<any | null>;
  findByUserId(userId: string, limit?: number): Promise<RoutePlan[]>;
  findRecentRoutes(userId: string, limit?: number): Promise<RoutePlan[]>;
  findRoutesNeedingRecalculation(): Promise<RoutePlan[]>;

  // Analytics operations
  getAverageRouteTime(
    userId: string,
    origin: string,
    destination: string
  ): Promise<number | null>;
  getRouteStats(userId: string): Promise<{
    totalRoutes: number;
    averageTravelTime: number;
    mostCommonDestination: string | null;
  }>;

  // Custom update method
  updateRouteCalculation(
    scheduleId: string,
    routeData: {
      wakeUpTime: Date;
      departureTime: Date;
      arrivalTime: Date;
      totalTravelMinutes: number;
      routeSegments: RouteSegment[];
      buffers: TimeBuffers;
    }
  ): Promise<RoutePlan>;
}

/**
 * RoutePlan Repository Implementation
 */
export class RoutePlanRepository
  extends AbstractBaseRepository<Prisma.RoutePlanDelegate<Prisma.DefaultArgs>>
  implements IRoutePlanRepository
{
  protected model = prisma.routePlan;

  // Explicit method types for better IDE support
  create(args: Prisma.RoutePlanCreateArgs) {
    return this.model.create(args);
  }

  createMany(args: Prisma.RoutePlanCreateManyArgs) {
    return this.model.createMany(args);
  }

  update(args: Prisma.RoutePlanUpdateArgs) {
    return this.model.update(args);
  }

  findUnique(args: Prisma.RoutePlanFindUniqueArgs) {
    return this.model.findUnique(args);
  }

  findMany(args?: Prisma.RoutePlanFindManyArgs) {
    return this.model.findMany(args);
  }

  delete(args: Prisma.RoutePlanDeleteArgs) {
    return this.model.delete(args);
  }

  deleteMany(args: Prisma.RoutePlanDeleteManyArgs) {
    return this.model.deleteMany(args);
  }

  /**
   * Find route plan by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<RoutePlan | null> {
    return await this.model.findUnique({
      where: { scheduleId },
    });
  }

  /**
   * Find route plan by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<any | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        schedule: true,
        user: true,
      },
    });
  }

  /**
   * Find route plans by user ID
   */
  async findByUserId(userId: string, limit: number = 20): Promise<RoutePlan[]> {
    return await this.model.findMany({
      where: { userId },
      orderBy: { calculatedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Find recent route plans for a user
   */
  async findRecentRoutes(
    userId: string,
    limit: number = 10
  ): Promise<RoutePlan[]> {
    return await this.model.findMany({
      where: { userId },
      orderBy: { calculatedAt: "desc" },
      take: limit,
      include: {
        schedule: {
          select: {
            location: true,
            shootingDate: true,
            callTime: true,
          },
        },
      },
    });
  }

  /**
   * Find routes that need recalculation (older than 24 hours for upcoming schedules)
   */
  async findRoutesNeedingRecalculation(): Promise<RoutePlan[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    return await this.model.findMany({
      where: {
        calculatedAt: {
          lt: oneDayAgo,
        },
        schedule: {
          shootingDate: {
            gte: now,
          },
        },
      },
      include: {
        schedule: true,
        user: true,
      },
    });
  }

  /**
   * Get average route time for specific origin-destination pair
   */
  async getAverageRouteTime(
    userId: string,
    origin: string,
    destination: string
  ): Promise<number | null> {
    const routes = await this.model.findMany({
      where: {
        userId,
        schedule: {
          location: {
            contains: destination,
            mode: "insensitive",
          },
        },
      },
      select: {
        totalTravelMinutes: true,
      },
    });

    if (routes.length === 0) {
      return null;
    }

    const totalMinutes = routes.reduce(
      (sum, route) => sum + route.totalTravelMinutes,
      0
    );

    return Math.round(totalMinutes / routes.length);
  }

  /**
   * Get route statistics for a user
   */
  async getRouteStats(userId: string): Promise<{
    totalRoutes: number;
    averageTravelTime: number;
    mostCommonDestination: string | null;
  }> {
    const routes = await this.model.findMany({
      where: { userId },
      include: {
        schedule: {
          select: {
            location: true,
          },
        },
      },
    });

    const totalRoutes = routes.length;

    if (totalRoutes === 0) {
      return {
        totalRoutes: 0,
        averageTravelTime: 0,
        mostCommonDestination: null,
      };
    }

    // Calculate average travel time
    const totalTravelTime = routes.reduce(
      (sum, route) => sum + route.totalTravelMinutes,
      0
    );
    const averageTravelTime = Math.round(totalTravelTime / totalRoutes);

    // Find most common destination
    const locationCounts = routes.reduce((acc, route) => {
      const location = route.schedule.location;
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const locationKeys = Object.keys(locationCounts);
    const mostCommonDestination =
      locationKeys.length > 0
        ? locationKeys.reduce((a, b) =>
            locationCounts[a] > locationCounts[b] ? a : b
          )
        : null;

    return {
      totalRoutes,
      averageTravelTime,
      mostCommonDestination,
    };
  }

  /**
   * Update route plan with new calculation
   */
  async updateRouteCalculation(
    scheduleId: string,
    routeData: {
      wakeUpTime: Date;
      departureTime: Date;
      arrivalTime: Date;
      totalTravelMinutes: number;
      routeSegments: RouteSegment[];
      buffers: TimeBuffers;
    }
  ): Promise<RoutePlan> {
    return await this.model.update({
      where: { scheduleId },
      data: {
        wakeUpTime: routeData.wakeUpTime,
        departureTime: routeData.departureTime,
        arrivalTime: routeData.arrivalTime,
        totalTravelMinutes: routeData.totalTravelMinutes,
        routeSegments:
          routeData.routeSegments as unknown as Prisma.InputJsonValue,
        buffers: routeData.buffers as unknown as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * Find routes by date range
   */
  async findRoutesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RoutePlan[]> {
    return await this.model.findMany({
      where: {
        userId,
        schedule: {
          shootingDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        schedule: {
          select: {
            location: true,
            shootingDate: true,
            callTime: true,
            sceneType: true,
          },
        },
      },
      orderBy: {
        schedule: {
          shootingDate: "asc",
        },
      },
    });
  }
}

// Export a ready-to-use singleton instance
export const routePlanRepository = new RoutePlanRepository();

// Also export as default for flexibility
export default RoutePlanRepository;
