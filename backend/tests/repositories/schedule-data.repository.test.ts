import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * ScheduleDataRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts): they assert on the SQL and bound parameters the
 * repository would send, and on how scripted rows are returned.
 */
describe("ScheduleDataRepository", () => {
  let repo: ScheduleDataRepository;

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const scheduleRow = {
    id: "sched-1",
    userId: "user-1",
    emailId: "email-1",
    shootingDate: new Date("2030-06-01T00:00:00Z"),
    callTime: "08:00",
    location: "Studio A",
    baseLocation: "Base",
    sceneType: "EXT",
    scenes: null,
    safetyNotes: null,
    equipment: null,
    contacts: null,
    notes: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    repo = new ScheduleDataRepository();
  });

  describe("create", () => {
    const input = {
      userId: "user-1",
      emailId: "email-1",
      shootingDate: new Date("2030-06-01T00:00:00Z"),
      callTime: "08:00",
      location: "Studio A",
      sceneType: "EXT",
    } as any;

    it("inserts a generated id, the input fields and timestamps, and returns the row", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.create(input);

      expect(result).toEqual(scheduleRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^insert into "schedule_data" \("id", "userId", "emailId", "shootingDate", "callTime", "location", "sceneType", "createdAt", "updatedAt"\) values/
      );
      expect(q.sql).toContain("returning *");
      expect(q.parameters).toHaveLength(9);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 7)).toEqual([
        "user-1",
        "email-1",
        input.shootingDate,
        "08:00",
        "Studio A",
        "EXT",
      ]);
      expect(q.parameters[7]).toBeInstanceOf(Date);
      expect(q.parameters[8]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and generates its own", async () => {
      testDb.enqueueRows([scheduleRow]);

      await repo.create({ ...input, id: "caller-chosen" });

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("caller-chosen");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters).toHaveLength(9);
    });

    it("generates a different id for each insert", async () => {
      testDb.enqueueRows([scheduleRow]);
      testDb.enqueueRows([scheduleRow]);

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
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findById("sched-1");

      expect(result).toEqual(scheduleRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "schedule_data" where "id" = \$1/);
      expect(q.parameters).toEqual(["sched-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("sched-1")).rejects.toThrow("connection lost");
    });
  });

  describe("findMany", () => {
    it("selects everything with no options", async () => {
      testDb.enqueueRows([scheduleRow]);

      expect(await repo.findMany()).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe('select * from "schedule_data"');
      expect(q.parameters).toEqual([]);
    });

    it("returns an empty array when nothing matches", async () => {
      expect(await repo.findMany()).toEqual([]);
    });

    it("ANDs every where entry as an equality", async () => {
      await repo.findMany({ where: { userId: "user-1", sceneType: "INT" } });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "userId" = $1 and "sceneType" = $2');
      expect(q.parameters).toEqual(["user-1", "INT"]);
    });

    it("applies orderBy and take", async () => {
      await repo.findMany({ orderBy: { shootingDate: "desc" }, take: 5 });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('order by "shootingDate" desc');
      expect(q.sql).toMatch(/limit \$1$/);
      expect(q.parameters).toEqual([5]);
    });

    it("combines where, orderBy and take in order", async () => {
      await repo.findMany({
        where: { userId: "user-1" },
        orderBy: { createdAt: "asc" },
        take: 3,
      });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1 order by "createdAt" asc limit \$2$/
      );
      expect(q.parameters).toEqual(["user-1", 3]);
    });
  });

  describe("findWithRelations", () => {
    it("returns null when the schedule does not exist", async () => {
      expect(await repo.findWithRelations("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });

    it("returns the schedule when it exists", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findWithRelations("sched-1");

      expect(result).toMatchObject({ id: "sched-1", userId: "user-1" });
      expect(testDb.lastQuery().parameters).toEqual(["sched-1"]);
    });
  });

  describe("findByEmailId", () => {
    it("filters on emailId and returns the row", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findByEmailId("email-1");

      expect(result).toEqual(scheduleRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "emailId" = \$1/
      );
      expect(q.parameters).toEqual(["email-1"]);
    });

    it("returns null when no schedule belongs to the email", async () => {
      expect(await repo.findByEmailId("email-x")).toBeNull();
    });
  });

  describe("findUpcomingSchedules", () => {
    it("selects the user's schedules from now on, soonest first, default limit 10", async () => {
      testDb.enqueueRows([scheduleRow]);
      const before = Date.now();

      const result = await repo.findUpcomingSchedules("user-1");

      const after = Date.now();
      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1 and "shootingDate" >= \$2 order by "shootingDate" asc limit \$3$/
      );
      expect(q.parameters[0]).toBe("user-1");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      const bound = (q.parameters[1] as Date).getTime();
      expect(bound).toBeGreaterThanOrEqual(before);
      expect(bound).toBeLessThanOrEqual(after);
      expect(q.parameters[2]).toBe(10);
    });

    it("honours an explicit limit", async () => {
      await repo.findUpcomingSchedules("user-1", 5);
      expect(testDb.lastQuery().parameters[2]).toBe(5);
    });

    it("returns an empty array when there are none", async () => {
      expect(await repo.findUpcomingSchedules("user-1")).toEqual([]);
    });
  });

  describe("findPastSchedules", () => {
    it("selects the user's schedules before now, most recent first, default limit 20", async () => {
      testDb.enqueueRows([scheduleRow]);
      const before = Date.now();

      const result = await repo.findPastSchedules("user-1");

      const after = Date.now();
      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1 and "shootingDate" < \$2 order by "shootingDate" desc limit \$3$/
      );
      expect(q.parameters[0]).toBe("user-1");
      const bound = (q.parameters[1] as Date).getTime();
      expect(bound).toBeGreaterThanOrEqual(before);
      expect(bound).toBeLessThanOrEqual(after);
      expect(q.parameters[2]).toBe(20);
    });

    it("honours an explicit limit", async () => {
      await repo.findPastSchedules("user-1", 3);
      expect(testDb.lastQuery().parameters[2]).toBe(3);
    });

    it("returns an empty array when there are none", async () => {
      expect(await repo.findPastSchedules("user-1")).toEqual([]);
    });
  });

  describe("findSchedulesByDateRange", () => {
    const start = new Date("2030-06-01T00:00:00Z");
    const end = new Date("2030-06-30T23:59:59Z");

    it("selects the user's schedules in the inclusive range, oldest first", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findSchedulesByDateRange("user-1", start, end);

      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1 and "shootingDate" >= \$2 and "shootingDate" <= \$3 order by "shootingDate" asc$/
      );
      expect(q.parameters).toEqual(["user-1", start, end]);
    });

    it("returns an empty array when nothing falls in range", async () => {
      expect(
        await repo.findSchedulesByDateRange("user-1", start, end)
      ).toEqual([]);
    });
  });

  describe("findSchedulesByLocation", () => {
    // NOTE: the location argument is currently ignored by the repository (see
    // report); only the user scoping and ordering are asserted here.
    it("is scoped to the user and returns the newest schedules first", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findSchedulesByLocation("user-1", "Studio");

      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1/
      );
      expect(q.sql).toContain('order by "shootingDate" desc');
      expect(q.parameters[0]).toBe("user-1");
    });
  });

  describe("getScheduleStats", () => {
    /** Answer each of the four parallel queries by its SQL, so the test does not
     *  depend on the order in which Promise.all dispatches them. */
    function scriptStats(
      counts: { total: number | string; upcoming: number | string; past: number | string },
      schedules: Array<{ sceneType: string; shootingDate: Date }>
    ): void {
      for (let i = 0; i < 4; i++) {
        testDb.enqueueFn((query) => {
          if (query.sql.includes("count(*)")) {
            if (query.sql.includes('"shootingDate" >=')) {
              return { rows: [{ count: counts.upcoming }] };
            }
            if (query.sql.includes('"shootingDate" <')) {
              return { rows: [{ count: counts.past }] };
            }
            return { rows: [{ count: counts.total }] };
          }
          return { rows: schedules };
        });
      }
    }

    it("returns counts, scene type distribution and monthly distribution", async () => {
      scriptStats({ total: 3, upcoming: 2, past: 1 }, [
        { sceneType: "EXT", shootingDate: new Date("2024-12-01T12:00:00Z") },
        { sceneType: "INT", shootingDate: new Date("2024-12-15T12:00:00Z") },
        { sceneType: "EXT", shootingDate: new Date("2024-11-20T12:00:00Z") },
      ]);

      const stats = await repo.getScheduleStats("user-1");

      expect(stats).toEqual({
        total: 3,
        upcoming: 2,
        past: 1,
        bySceneType: { INT: 1, EXT: 2 },
        byMonth: { "2024-12": 2, "2024-11": 1 },
      });
    });

    it("coerces string counts (as returned by pg for count(*)) to numbers", async () => {
      scriptStats({ total: "10", upcoming: "7", past: "3" }, []);

      const stats = await repo.getScheduleStats("user-1");

      expect(stats.total).toBe(10);
      expect(stats.upcoming).toBe(7);
      expect(stats.past).toBe(3);
    });

    it("returns zeroed stats and empty distributions when there are no schedules", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0 }, []);

      expect(await repo.getScheduleStats("user-1")).toEqual({
        total: 0,
        upcoming: 0,
        past: 0,
        bySceneType: { INT: 0, EXT: 0 },
        byMonth: {},
      });
    });

    it("runs four queries, all scoped to the user", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0 }, []);

      await repo.getScheduleStats("user-1");

      expect(testDb.queries).toHaveLength(4);
      for (const q of testDb.queries) {
        expect(q.sql).toContain('from "schedule_data" where "userId" = $1');
        expect(q.parameters[0]).toBe("user-1");
      }
    });

    it("counts upcoming as >= now and past as < now using the same instant", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0 }, []);

      await repo.getScheduleStats("user-1");

      const countQueries = testDb.queries.filter((q) =>
        q.sql.includes("count(*)")
      );
      expect(countQueries).toHaveLength(3);

      const total = countQueries.find((q) => !q.sql.includes('"shootingDate"'))!;
      const upcoming = countQueries.find((q) =>
        q.sql.includes('"shootingDate" >= $2')
      )!;
      const past = countQueries.find((q) =>
        q.sql.includes('"shootingDate" < $2')
      )!;
      expect(total.parameters).toEqual(["user-1"]);
      expect(upcoming.parameters[1]).toBeInstanceOf(Date);
      expect(past.parameters[1]).toBeInstanceOf(Date);
      expect((upcoming.parameters[1] as Date).getTime()).toBe(
        (past.parameters[1] as Date).getTime()
      );
    });

    it("selects only sceneType and shootingDate for the distributions", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0 }, []);

      await repo.getScheduleStats("user-1");

      const detail = testDb.queries.find(
        (q) => !q.sql.includes("count(*)")
      )!;
      expect(detail.sql).toMatch(
        /^select "sceneType", "shootingDate" from "schedule_data" where "userId" = \$1$/
      );
    });

    it("fails when a count query returns no row", async () => {
      // Nothing queued: every query returns { rows: [] }.
      await expect(repo.getScheduleStats("user-1")).rejects.toThrow();
    });
  });

  describe("findConflictingSchedules", () => {
    it("selects the user's schedules within the shooting day, [start, start + 24h)", async () => {
      testDb.enqueueRows([scheduleRow]);
      const shootingDate = new Date(2030, 5, 1, 15, 30); // local time

      const result = await repo.findConflictingSchedules(
        "user-1",
        shootingDate,
        "08:00"
      );

      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "userId" = \$1 and "shootingDate" >= \$2 and "shootingDate" < \$3$/
      );
      const startOfDay = new Date(shootingDate.toDateString());
      expect(q.parameters[0]).toBe("user-1");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect((q.parameters[1] as Date).getTime()).toBe(startOfDay.getTime());
      expect((q.parameters[2] as Date).getTime()).toBe(
        startOfDay.getTime() + DAY
      );
      // the day window must contain the requested instant
      expect((q.parameters[1] as Date).getTime()).toBeLessThanOrEqual(
        shootingDate.getTime()
      );
      expect((q.parameters[2] as Date).getTime()).toBeGreaterThan(
        shootingDate.getTime()
      );
    });

    it("returns an empty array when the day is free", async () => {
      expect(
        await repo.findConflictingSchedules("user-1", new Date(), "08:00")
      ).toEqual([]);
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...scheduleRow, location: "Studio B" }]);

      const result = await repo.update("sched-1", {
        location: "Studio B",
        callTime: "09:30",
      } as any);

      expect(result.location).toBe("Studio B");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "schedule_data" set "location" = \$1, "callTime" = \$2, "updatedAt" = \$3 where "id" = \$4 returning \*/
      );
      expect(q.parameters[0]).toBe("Studio B");
      expect(q.parameters[1]).toBe("09:30");
      expect(q.parameters[2]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("sched-1");
    });

    it("throws when no schedule matches", async () => {
      await expect(
        repo.update("missing", { location: "x" } as any)
      ).rejects.toThrow();
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("deadlock detected"));
      await expect(
        repo.update("sched-1", { location: "x" } as any)
      ).rejects.toThrow("deadlock detected");
    });
  });

  describe("updateWithRelations", () => {
    it("updates by id and returns the updated row", async () => {
      testDb.enqueueRows([{ ...scheduleRow, notes: "Bring umbrellas" }]);

      const result = await repo.updateWithRelations("sched-1", {
        notes: "Bring umbrellas",
      } as any);

      expect(result).toMatchObject({ id: "sched-1", notes: "Bring umbrellas" });
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "schedule_data" set "notes" = \$1, "updatedAt" = \$2 where "id" = \$3/
      );
      expect(q.parameters[0]).toBe("Bring umbrellas");
      expect(q.parameters[2]).toBe("sched-1");
    });

    it("throws when no schedule matches", async () => {
      await expect(
        repo.updateWithRelations("missing", { notes: "x" } as any)
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([scheduleRow]);

      expect(await repo.delete("sched-1")).toEqual(scheduleRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "schedule_data" where "id" = \$1 returning \*/
      );
      expect(q.parameters).toEqual(["sched-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("createWithValidation", () => {
    const validInput = (overrides: Record<string, unknown> = {}): any => ({
      userId: "user-1",
      emailId: "email-1",
      shootingDate: new Date(Date.now() + DAY),
      callTime: "08:00",
      location: "Studio A",
      sceneType: "EXT",
      ...overrides,
    });

    it("creates the schedule when the data is valid", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.createWithValidation(validInput());

      expect(result).toEqual(scheduleRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "schedule_data"/);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters).toContain("08:00");
    });

    it("accepts a schedule that is less than a day in the past", async () => {
      testDb.enqueueRows([scheduleRow]);

      await expect(
        repo.createWithValidation(
          validInput({ shootingDate: new Date(Date.now() - 23 * HOUR) })
        )
      ).resolves.toEqual(scheduleRow);
    });

    it("rejects a shooting date more than a day in the past without touching the database", async () => {
      await expect(
        repo.createWithValidation(
          validInput({ shootingDate: new Date(Date.now() - 25 * HOUR) })
        )
      ).rejects.toThrow("Shooting date cannot be more than 1 day in the past");
      expect(testDb.queries).toHaveLength(0);
    });

    it.each(["25:00", "24:00", "08:60", "0800", "8am", "", "08:5"])(
      "rejects call time %p",
      async (callTime) => {
        await expect(
          repo.createWithValidation(validInput({ callTime }))
        ).rejects.toThrow("Call time must be in HH:MM format");
        expect(testDb.queries).toHaveLength(0);
      }
    );

    it.each(["00:00", "08:00", "8:30", "19:45", "23:59"])(
      "accepts call time %p",
      async (callTime) => {
        testDb.enqueueRows([scheduleRow]);
        await expect(
          repo.createWithValidation(validInput({ callTime }))
        ).resolves.toBeDefined();
      }
    );

    it("rejects a scene type other than INT or EXT", async () => {
      await expect(
        repo.createWithValidation(validInput({ sceneType: "INVALID" }))
      ).rejects.toThrow("Scene type must be either INT or EXT");
      expect(testDb.queries).toHaveLength(0);
    });

    it.each(["INT", "EXT"])("accepts scene type %p", async (sceneType) => {
      testDb.enqueueRows([scheduleRow]);
      await expect(
        repo.createWithValidation(validInput({ sceneType }))
      ).resolves.toBeDefined();
    });

    it("does not require a scene type", async () => {
      testDb.enqueueRows([scheduleRow]);
      await expect(
        repo.createWithValidation(validInput({ sceneType: undefined }))
      ).resolves.toEqual(scheduleRow);
    });
  });

  describe("findSchedulesNeedingWeatherUpdate", () => {
    it("selects schedules from the start of tomorrow to the end of day seven days out", async () => {
      testDb.enqueueRows([scheduleRow]);
      const before = Date.now();

      const result = await repo.findSchedulesNeedingWeatherUpdate();

      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "shootingDate" >= \$1 and "shootingDate" <= \$2$/
      );
      const from = q.parameters[0] as Date;
      const to = q.parameters[1] as Date;
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);

      // start of tomorrow (local midnight), within the next ~48h
      expect([from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds()]).toEqual([0, 0, 0, 0]);
      expect(from.getTime()).toBeGreaterThan(before);
      expect(from.getTime()).toBeLessThanOrEqual(before + DAY + 5 * 1000);

      // end of the day seven days from now (local 23:59:59.999)
      expect([to.getHours(), to.getMinutes(), to.getSeconds(), to.getMilliseconds()]).toEqual([23, 59, 59, 999]);
      const daysAhead = (to.getTime() - before) / DAY;
      expect(daysAhead).toBeGreaterThan(6.9);
      expect(daysAhead).toBeLessThan(8);
    });

    it("returns an empty array when nothing qualifies", async () => {
      expect(await repo.findSchedulesNeedingWeatherUpdate()).toEqual([]);
    });
  });

  describe("findSchedulesNeedingRouteUpdate", () => {
    it("selects schedules from this time tomorrow onwards, with no upper bound", async () => {
      testDb.enqueueRows([scheduleRow]);
      const before = Date.now();

      const result = await repo.findSchedulesNeedingRouteUpdate();

      const after = Date.now();
      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "shootingDate" >= \$1$/
      );
      expect(q.parameters).toHaveLength(1);
      const from = (q.parameters[0] as Date).getTime();
      // tomorrow at the current time (allow a DST hour either way)
      expect(from).toBeGreaterThanOrEqual(before + DAY - HOUR);
      expect(from).toBeLessThanOrEqual(after + DAY + HOUR);
    });

    it("returns an empty array when nothing qualifies", async () => {
      expect(await repo.findSchedulesNeedingRouteUpdate()).toEqual([]);
    });
  });

  describe("findUpcomingSchedulesInDateRange", () => {
    const start = new Date("2030-06-01T00:00:00Z");
    const end = new Date("2030-06-07T23:59:59Z");

    it("selects schedules for all users in the inclusive range, oldest first", async () => {
      testDb.enqueueRows([scheduleRow]);

      const result = await repo.findUpcomingSchedulesInDateRange(start, end);

      expect(result).toEqual([scheduleRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "schedule_data" where "shootingDate" >= \$1 and "shootingDate" <= \$2 order by "shootingDate" asc$/
      );
      expect(q.sql).not.toContain('"userId"');
      expect(q.parameters).toEqual([start, end]);
    });

    it("returns an empty array when nothing falls in range", async () => {
      expect(
        await repo.findUpcomingSchedulesInDateRange(start, end)
      ).toEqual([]);
    });
  });
});
