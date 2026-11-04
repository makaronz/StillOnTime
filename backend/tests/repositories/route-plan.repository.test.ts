import { RoutePlanRepository } from "@/repositories/route-plan.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * RoutePlanRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("RoutePlanRepository", () => {
  let repo: RoutePlanRepository;

  const routeRow = {
    id: "route-1",
    userId: "user-1",
    scheduleId: "schedule-1",
    wakeUpTime: new Date("2030-12-01T06:00:00Z"),
    departureTime: new Date("2030-12-01T07:30:00Z"),
    arrivalTime: new Date("2030-12-01T08:00:00Z"),
    totalTravelMinutes: 90,
    routeSegments: [{ from: "Home", to: "Panavision", duration: 30 }],
    buffers: {
      carChange: 15,
      parking: 10,
      entry: 10,
      traffic: 20,
      morningRoutine: 45,
    },
    calculatedAt: new Date("2030-11-30T12:00:00Z"),
    createdAt: new Date("2030-11-30T12:00:00Z"),
    updatedAt: new Date("2030-11-30T12:00:00Z"),
  };

  beforeEach(() => {
    repo = new RoutePlanRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    const input: any = {
      userId: "user-1",
      scheduleId: "schedule-1",
      wakeUpTime: routeRow.wakeUpTime,
      departureTime: routeRow.departureTime,
      arrivalTime: routeRow.arrivalTime,
      totalTravelMinutes: 90,
      routeSegments: [],
      buffers: {},
    };

    it("inserts a generated id plus the input and timestamps, returning the row", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.create(input);

      expect(result).toEqual(routeRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "route_plans" \("id", "userId", "scheduleId"/);
      expect(q.sql).toContain('"wakeUpTime"');
      expect(q.sql).toContain('"totalTravelMinutes"');
      expect(q.sql).toContain('"calculatedAt", "createdAt", "updatedAt"');
      expect(q.sql).toMatch(/returning \*$/);

      // id, 8 input fields, then calculatedAt / createdAt / updatedAt
      expect(q.parameters).toHaveLength(12);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters[1]).toBe("user-1");
      expect(q.parameters[2]).toBe("schedule-1");
      expect(q.parameters[3]).toBe(input.wakeUpTime);
      expect(q.parameters[4]).toBe(input.departureTime);
      expect(q.parameters[5]).toBe(input.arrivalTime);
      expect(q.parameters[6]).toBe(90);
      expect(q.parameters[9]).toBeInstanceOf(Date);
      expect(q.parameters[10]).toBeInstanceOf(Date);
      expect(q.parameters[11]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and uses a generated one", async () => {
      testDb.enqueueRows([routeRow]);

      await repo.create({ ...input, id: "caller-id" });

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("caller-id");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters).toHaveLength(12);
    });

    it("generates a different id on each call", async () => {
      testDb.enqueueRows([routeRow]);
      testDb.enqueueRows([routeRow]);

      await repo.create(input);
      await repo.create(input);

      expect(testDb.queries[0].parameters[0]).not.toBe(
        testDb.queries[1].parameters[0]
      );
    });

    it("throws when the insert returns no row", async () => {
      await expect(repo.create(input)).rejects.toThrow();
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("unique violation"));
      await expect(repo.create(input)).rejects.toThrow("unique violation");
    });
  });

  describe("findById", () => {
    it("filters on id and returns the row", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findById("route-1");

      expect(result).toEqual(routeRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "route_plans" where "id" = \$1/);
      expect(q.parameters).toEqual(["route-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });
  });

  describe("findByIdWithRelations", () => {
    it("delegates to findById (single plain select, no joins)", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findByIdWithRelations("route-1");

      expect(result).toEqual(routeRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "route_plans" where "id" = \$1/);
      expect(q.parameters).toEqual(["route-1"]);
    });

    it("returns null when the route plan does not exist", async () => {
      expect(await repo.findByIdWithRelations("missing")).toBeNull();
    });
  });

  describe("findByScheduleId", () => {
    it("filters on scheduleId and returns the row", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findByScheduleId("schedule-1");

      expect(result).toEqual(routeRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "route_plans" where "scheduleId" = \$1/
      );
      expect(q.parameters).toEqual(["schedule-1"]);
    });

    it("returns null when there is no route plan for the schedule", async () => {
      expect(await repo.findByScheduleId("nonexistent")).toBeNull();
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...routeRow, totalTravelMinutes: 120 }]);

      const result = await repo.update("route-1", { totalTravelMinutes: 120 } as any);

      expect(result.totalTravelMinutes).toBe(120);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "route_plans" set "totalTravelMinutes" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*/
      );
      expect(q.parameters[0]).toBe(120);
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("route-1");
    });

    it("throws when no route plan matches", async () => {
      await expect(repo.update("missing", { totalTravelMinutes: 1 } as any)).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([routeRow]);

      expect(await repo.delete("route-1")).toEqual(routeRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "route_plans" where "id" = \$1 returning \*/
      );
      expect(q.parameters).toEqual(["route-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("findByUserId", () => {
    it("filters by user, orders newest calculation first, and defaults the limit to 20", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual([routeRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "route_plans" where "userId" = \$1 order by "calculatedAt" desc limit \$2$/
      );
      expect(q.parameters).toEqual(["user-1", 20]);
    });

    it("applies a custom limit", async () => {
      expect(await repo.findByUserId("user-1", 5)).toEqual([]);
      expect(testDb.lastQuery().parameters).toEqual(["user-1", 5]);
    });
  });

  describe("findRecentRoutes", () => {
    it("filters by user, orders newest calculation first, and defaults the limit to 10", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findRecentRoutes("user-1");

      expect(result).toEqual([routeRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "route_plans" where "userId" = \$1 order by "calculatedAt" desc limit \$2$/
      );
      expect(q.parameters).toEqual(["user-1", 10]);
    });

    it("applies a custom limit", async () => {
      await repo.findRecentRoutes("user-1", 3);
      expect(testDb.lastQuery().parameters).toEqual(["user-1", 3]);
    });
  });

  describe("findRoutesNeedingRecalculation", () => {
    it("selects plans calculated more than 24 hours ago", async () => {
      const now = new Date("2031-01-10T12:00:00Z").getTime();
      jest.spyOn(Date, "now").mockReturnValue(now);
      testDb.enqueueRows([routeRow]);

      const result = await repo.findRoutesNeedingRecalculation();

      expect(result).toEqual([routeRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "route_plans" where "calculatedAt" < \$1$/
      );
      expect(q.parameters).toHaveLength(1);
      expect(q.parameters[0]).toBeInstanceOf(Date);
      expect((q.parameters[0] as Date).getTime()).toBe(now - 24 * 60 * 60 * 1000);
    });

    it("returns an empty array when everything is fresh", async () => {
      expect(await repo.findRoutesNeedingRecalculation()).toEqual([]);
    });
  });

  describe("getAverageRouteTime", () => {
    it("selects only totalTravelMinutes for the user and returns the rounded mean", async () => {
      testDb.enqueueRows([
        { totalTravelMinutes: 90 },
        { totalTravelMinutes: 100 },
        { totalTravelMinutes: 80 },
      ]);

      const result = await repo.getAverageRouteTime("user-1", "Home", "Studio");

      expect(result).toBe(90);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select "totalTravelMinutes" from "route_plans" where "userId" = \$1$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("rounds a fractional mean to the nearest minute", async () => {
      testDb.enqueueRows([
        { totalTravelMinutes: 10 },
        { totalTravelMinutes: 11 },
        { totalTravelMinutes: 11 },
      ]); // 32 / 3 = 10.67
      expect(await repo.getAverageRouteTime("user-1", "a", "b")).toBe(11);
    });

    it("returns null when the user has no routes", async () => {
      expect(await repo.getAverageRouteTime("user-1", "a", "b")).toBeNull();
    });
  });

  describe("getRouteStats", () => {
    it("selects all of the user's plans and returns count and rounded average", async () => {
      testDb.enqueueRows([
        { ...routeRow, id: "r1", totalTravelMinutes: 90 },
        { ...routeRow, id: "r2", totalTravelMinutes: 100 },
        { ...routeRow, id: "r3", totalTravelMinutes: 81 },
      ]); // 271 / 3 = 90.33

      const stats = await repo.getRouteStats("user-1");

      expect(stats.totalRoutes).toBe(3);
      expect(stats.averageTravelTime).toBe(90);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "route_plans" where "userId" = \$1$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns zeroed stats for a user with no routes", async () => {
      expect(await repo.getRouteStats("user-1")).toEqual({
        totalRoutes: 0,
        averageTravelTime: 0,
        mostCommonDestination: null,
      });
    });
  });

  describe("updateRouteCalculation", () => {
    const routeData = {
      wakeUpTime: new Date("2030-12-02T06:00:00Z"),
      departureTime: new Date("2030-12-02T07:30:00Z"),
      arrivalTime: new Date("2030-12-02T08:00:00Z"),
      totalTravelMinutes: 75,
      routeSegments: [{ from: "Home", to: "Studio", duration: 30 }] as any,
      buffers: {
        carChange: 15,
        parking: 10,
        entry: 10,
        traffic: 20,
        morningRoutine: 45,
      } as any,
    };

    it("updates the calculation fields scoped by scheduleId and refreshes timestamps", async () => {
      testDb.enqueueRows([{ ...routeRow, ...routeData }]);

      const result = await repo.updateRouteCalculation("schedule-1", routeData);

      expect(result.totalTravelMinutes).toBe(75);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "route_plans" set "wakeUpTime" = \$1, "departureTime" = \$2, "arrivalTime" = \$3, "totalTravelMinutes" = \$4, "routeSegments" = \$5, "buffers" = \$6, "calculatedAt" = \$7, "updatedAt" = \$8 where "scheduleId" = \$9 returning \*/
      );
      expect(q.parameters[0]).toBe(routeData.wakeUpTime);
      expect(q.parameters[1]).toBe(routeData.departureTime);
      expect(q.parameters[2]).toBe(routeData.arrivalTime);
      expect(q.parameters[3]).toBe(75);
      expect(q.parameters[4]).toBe(routeData.routeSegments);
      expect(q.parameters[5]).toBe(routeData.buffers);
      expect(q.parameters[6]).toBeInstanceOf(Date);
      expect(q.parameters[7]).toBeInstanceOf(Date);
      expect(q.parameters[8]).toBe("schedule-1");
      expect(q.parameters).toHaveLength(9);
    });

    it("throws when no route plan exists for the schedule", async () => {
      await expect(
        repo.updateRouteCalculation("missing", routeData)
      ).rejects.toThrow();
    });
  });

  describe("findRoutesByDateRange", () => {
    it("scopes the query to the user and returns the rows", async () => {
      testDb.enqueueRows([routeRow]);

      const result = await repo.findRoutesByDateRange(
        "user-1",
        new Date("2030-12-01T00:00:00Z"),
        new Date("2030-12-31T00:00:00Z")
      );

      expect(result).toEqual([routeRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "route_plans" where "userId" = \$1/);
      expect(q.parameters[0]).toBe("user-1");
    });
  });

  describe("error propagation", () => {
    it("surfaces database errors from reads", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("route-1")).rejects.toThrow("connection lost");
    });

    it("surfaces database errors from list queries", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findByUserId("user-1")).rejects.toThrow("connection lost");
    });
  });
});
