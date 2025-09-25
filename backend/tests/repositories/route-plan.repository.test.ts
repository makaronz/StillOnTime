import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { prisma } from "@/config/database";
import { RoutePlan } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("RoutePlanRepository", () => {
  let routePlanRepository: RoutePlanRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    routePlanRepository = new RoutePlanRepository();
    jest.clearAllMocks();
  });

  describe("findByScheduleId", () => {
    it("should find route plan by schedule ID", async () => {
      const mockRoutePlan: RoutePlan = {
        id: "route-1",
        wakeUpTime: new Date("2024-12-01T06:00:00Z"),
        departureTime: new Date("2024-12-01T07:30:00Z"),
        arrivalTime: new Date("2024-12-01T08:00:00Z"),
        totalTravelMinutes: 90,
        routeSegments: [{ from: "Home", to: "Panavision", duration: 30 }],
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        calculatedAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.routePlan.findUnique.mockResolvedValue(mockRoutePlan);

      const result = await routePlanRepository.findByScheduleId("schedule-1");

      expect(mockPrisma.routePlan.findUnique).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
      });
      expect(result).toEqual(mockRoutePlan);
    });

    it("should return null if route plan not found", async () => {
      mockPrisma.routePlan.findUnique.mockResolvedValue(null);

      const result = await routePlanRepository.findByScheduleId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find route plans by user ID with default limit", async () => {
      const mockRoutePlans: RoutePlan[] = [
        {
          id: "route-1",
          wakeUpTime: new Date("2024-12-01T06:00:00Z"),
          departureTime: new Date("2024-12-01T07:30:00Z"),
          arrivalTime: new Date("2024-12-01T08:00:00Z"),
          totalTravelMinutes: 90,
          routeSegments: [],
          buffers: {},
          calculatedAt: new Date(),
          userId: "user-1",
          scheduleId: "schedule-1",
        },
      ];

      mockPrisma.routePlan.findMany.mockResolvedValue(mockRoutePlans);

      const result = await routePlanRepository.findByUserId("user-1");

      expect(mockPrisma.routePlan.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { calculatedAt: "desc" },
        take: 20,
      });
      expect(result).toEqual(mockRoutePlans);
    });

    it("should find route plans by user ID with custom limit", async () => {
      const mockRoutePlans: RoutePlan[] = [];

      mockPrisma.routePlan.findMany.mockResolvedValue(mockRoutePlans);

      const result = await routePlanRepository.findByUserId("user-1", 5);

      expect(mockPrisma.routePlan.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { calculatedAt: "desc" },
        take: 5,
      });
      expect(result).toEqual(mockRoutePlans);
    });
  });

  describe("getAverageRouteTime", () => {
    it("should calculate average route time for destination", async () => {
      const mockRoutes = [
        { totalTravelMinutes: 90 },
        { totalTravelMinutes: 100 },
        { totalTravelMinutes: 80 },
      ];

      mockPrisma.routePlan.findMany.mockResolvedValue(mockRoutes);

      const result = await routePlanRepository.getAverageRouteTime(
        "user-1",
        "Home",
        "Test Location"
      );

      expect(mockPrisma.routePlan.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          schedule: {
            location: {
              contains: "Test Location",
              mode: "insensitive",
            },
          },
        },
        select: {
          totalTravelMinutes: true,
        },
      });
      expect(result).toBe(90); // (90 + 100 + 80) / 3 = 90
    });

    it("should return null if no routes found", async () => {
      mockPrisma.routePlan.findMany.mockResolvedValue([]);

      const result = await routePlanRepository.getAverageRouteTime(
        "user-1",
        "Home",
        "Test Location"
      );

      expect(result).toBeNull();
    });
  });

  describe("getRouteStats", () => {
    it("should return route statistics", async () => {
      const mockRoutes = [
        {
          totalTravelMinutes: 90,
          schedule: { location: "Location A" },
        },
        {
          totalTravelMinutes: 100,
          schedule: { location: "Location B" },
        },
        {
          totalTravelMinutes: 80,
          schedule: { location: "Location A" },
        },
      ];

      mockPrisma.routePlan.findMany.mockResolvedValue(mockRoutes);

      const result = await routePlanRepository.getRouteStats("user-1");

      expect(result).toEqual({
        totalRoutes: 3,
        averageTravelTime: 90,
        mostCommonDestination: "Location A",
      });
    });

    it("should return zero stats for user with no routes", async () => {
      mockPrisma.routePlan.findMany.mockResolvedValue([]);

      const result = await routePlanRepository.getRouteStats("user-1");

      expect(result).toEqual({
        totalRoutes: 0,
        averageTravelTime: 0,
        mostCommonDestination: null,
      });
    });
  });

  describe("updateRouteCalculation", () => {
    it("should update route calculation with new data", async () => {
      const routeData = {
        wakeUpTime: new Date("2024-12-01T06:00:00Z"),
        departureTime: new Date("2024-12-01T07:30:00Z"),
        arrivalTime: new Date("2024-12-01T08:00:00Z"),
        totalTravelMinutes: 90,
        routeSegments: [{ from: "Home", to: "Location", duration: 30 }],
        buffers: { carChange: 15, parking: 10 },
      };

      const mockUpdatedRoute: RoutePlan = {
        id: "route-1",
        ...routeData,
        calculatedAt: new Date(),
        userId: "user-1",
        scheduleId: "schedule-1",
      };

      mockPrisma.routePlan.update.mockResolvedValue(mockUpdatedRoute);

      const result = await routePlanRepository.updateRouteCalculation(
        "schedule-1",
        routeData
      );

      expect(mockPrisma.routePlan.update).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
        data: {
          ...routeData,
          calculatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUpdatedRoute);
    });
  });

  describe("findRoutesNeedingRecalculation", () => {
    it("should find routes needing recalculation", async () => {
      const mockRoutes = [
        {
          id: "route-1",
          calculatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          schedule: {
            shootingDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          },
          user: { id: "user-1" },
        },
      ];

      mockPrisma.routePlan.findMany.mockResolvedValue(mockRoutes);

      const result = await routePlanRepository.findRoutesNeedingRecalculation();

      expect(mockPrisma.routePlan.findMany).toHaveBeenCalledWith({
        where: {
          calculatedAt: {
            lt: expect.any(Date),
          },
          schedule: {
            shootingDate: {
              gte: expect.any(Date),
            },
          },
        },
        include: {
          schedule: true,
          user: true,
        },
      });
      expect(result).toEqual(mockRoutes);
    });
  });
});
