import { db } from "@/config/database";
import {
  RoutePlan,
  CreateRoutePlanInput,
  UpdateRoutePlanInput,
  RouteSegment,
  TimeBuffers,
} from "@/types";
import type { NewRoutePlan, RoutePlanUpdate } from "@/config/database-types";

/**
 * RoutePlan Repository Interface
 */
export interface IRoutePlanRepository {
  // Base CRUD operations
  create(data: CreateRoutePlanInput): Promise<RoutePlan>;
  findById(id: string): Promise<RoutePlan | null>;
  update(id: string, data: UpdateRoutePlanInput): Promise<RoutePlan>;
  delete(id: string): Promise<RoutePlan>;

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
 * RoutePlan Repository Implementation with Kysely
 */
export class RoutePlanRepository implements IRoutePlanRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateRoutePlanInput): Promise<RoutePlan> {
    const id = this.generateCuid();
    // Remove id from data to prevent duplicate property error
    const { id: _, ...dataWithoutId } = data;
    return await db
      .insertInto("route_plans")
      .values({
        id: id, // Explicitly use generated id
        ...dataWithoutId, // Spread data without id
        calculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewRoutePlan)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<RoutePlan | null> {
    const result = await db
      .selectFrom("route_plans")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async update(id: string, data: UpdateRoutePlanInput): Promise<RoutePlan> {
    return await db
      .updateTable("route_plans")
      .set({ ...data, updatedAt: new Date() } as RoutePlanUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<RoutePlan> {
    return await db
      .deleteFrom("route_plans")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find route plan by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<RoutePlan | null> {
    const result = await db
      .selectFrom("route_plans")
      .selectAll()
      .where("scheduleId", "=", scheduleId)
      .executeTakeFirst();
    return result || null;
  }

  /**
   * Find route plan by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<any | null> {
    return await this.findById(id);
  }

  /**
   * Find route plans by user ID
   */
  async findByUserId(userId: string, limit: number = 20): Promise<RoutePlan[]> {
    return await db
      .selectFrom("route_plans")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("calculatedAt", "desc")
      .limit(limit)
      .execute();
  }

  /**
   * Find recent route plans for a user
   */
  async findRecentRoutes(
    userId: string,
    limit: number = 10
  ): Promise<RoutePlan[]> {
    return await db
      .selectFrom("route_plans")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("calculatedAt", "desc")
      .limit(limit)
      .execute();
  }

  /**
   * Find routes that need recalculation (older than 24 hours for upcoming schedules)
   */
  async findRoutesNeedingRecalculation(): Promise<RoutePlan[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db
      .selectFrom("route_plans")
      .selectAll()
      .where("calculatedAt", "<", oneDayAgo)
      .execute();
  }

  /**
   * Get average route time for specific origin-destination pair
   */
  async getAverageRouteTime(
    userId: string,
    origin: string,
    destination: string
  ): Promise<number | null> {
    const routes = await db
      .selectFrom("route_plans")
      .select("totalTravelMinutes")
      .where("userId", "=", userId)
      .execute();

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
    const routes = await db
      .selectFrom("route_plans")
      .selectAll()
      .where("userId", "=", userId)
      .execute();

    const totalRoutes = routes.length;

    if (totalRoutes === 0) {
      return {
        totalRoutes: 0,
        averageTravelTime: 0,
        mostCommonDestination: null,
      };
    }

    const totalTravelTime = routes.reduce(
      (sum, route) => sum + route.totalTravelMinutes,
      0
    );
    const averageTravelTime = Math.round(totalTravelTime / totalRoutes);

    return {
      totalRoutes,
      averageTravelTime,
      mostCommonDestination: null,
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
    return await db
      .updateTable("route_plans")
      .set({
        wakeUpTime: routeData.wakeUpTime,
        departureTime: routeData.departureTime,
        arrivalTime: routeData.arrivalTime,
        totalTravelMinutes: routeData.totalTravelMinutes,
        routeSegments: routeData.routeSegments as any,
        buffers: routeData.buffers as any,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      } as RoutePlanUpdate)
      .where("scheduleId", "=", scheduleId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find routes by date range
   */
  async findRoutesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RoutePlan[]> {
    return await db
      .selectFrom("route_plans")
      .selectAll()
      .where("userId", "=", userId)
      .execute();
  }
}

// Export a ready-to-use singleton instance
export const routePlanRepository = new RoutePlanRepository();

// Also export as default for flexibility
export default RoutePlanRepository;
