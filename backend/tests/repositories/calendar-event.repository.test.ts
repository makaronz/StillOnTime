import { CalendarEventRepository } from "@/repositories/calendar-event.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * CalendarEventRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("CalendarEventRepository", () => {
  let repo: CalendarEventRepository;

  const eventRow = {
    id: "event-1",
    calendarEventId: "google-event-123",
    title: "StillOnTime - Dzien zdjeciowy (Test Location)",
    startTime: new Date("2030-12-01T06:00:00Z"),
    endTime: new Date("2030-12-01T18:00:00Z"),
    description: "Shooting day details",
    location: "Test Location",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    userId: "user-1",
    scheduleId: "schedule-1",
  };

  beforeEach(() => {
    repo = new CalendarEventRepository();
  });

  describe("create", () => {
    const input = {
      calendarEventId: "google-event-123",
      title: "Shoot",
      startTime: new Date("2030-12-01T06:00:00Z"),
      endTime: new Date("2030-12-01T18:00:00Z"),
      description: "desc",
      location: "Loc",
      userId: "user-1",
      scheduleId: "schedule-1",
    } as any;

    it("inserts a generated id plus the input and returns the row", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.create(input);

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "calendar_events" \(/);
      expect(q.sql).toContain("returning *");
      for (const col of [
        "id",
        "calendarEventId",
        "title",
        "startTime",
        "endTime",
        "description",
        "location",
        "userId",
        "scheduleId",
        "createdAt",
        "updatedAt",
      ]) {
        expect(q.sql).toContain(`"${col}"`);
      }
      // id, 8 input fields, createdAt, updatedAt
      expect(q.parameters).toHaveLength(11);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 9)).toEqual([
        "google-event-123",
        "Shoot",
        input.startTime,
        input.endTime,
        "desc",
        "Loc",
        "user-1",
        "schedule-1",
      ]);
      expect(q.parameters[9]).toBeInstanceOf(Date);
      expect(q.parameters[10]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and generates its own", async () => {
      testDb.enqueueRows([eventRow]);

      await repo.create({ ...input, id: "caller-id" });

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("caller-id");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters).toHaveLength(11);
    });

    it("generates a different id for each call", async () => {
      testDb.enqueueRows([eventRow]);
      testDb.enqueueRows([eventRow]);

      await repo.create(input);
      await repo.create(input);

      expect(testDb.queries[0].parameters[0]).not.toBe(
        testDb.queries[1].parameters[0]
      );
    });

    it("throws when the insert returns no row", async () => {
      await expect(repo.create(input)).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("filters on id and returns the row", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findById("event-1");

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "id" = \$1/
      );
      expect(q.parameters).toEqual(["event-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
    });
  });

  describe("findByScheduleId", () => {
    it("filters on scheduleId and returns the row", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findByScheduleId("schedule-1");

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "scheduleId" = \$1/
      );
      expect(q.parameters).toEqual(["schedule-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findByScheduleId("nonexistent")).toBeNull();
    });
  });

  describe("findByCalendarEventId", () => {
    it("filters on the Google calendarEventId and returns the row", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findByCalendarEventId("google-event-123");

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "calendarEventId" = \$1/
      );
      expect(q.parameters).toEqual(["google-event-123"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findByCalendarEventId("nope")).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("filters by user, newest first, with the default limit of 20", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual([eventRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "userId" = \$1 order by "startTime" desc limit \$2$/
      );
      expect(q.parameters).toEqual(["user-1", 20]);
    });

    it("honours a custom limit", async () => {
      await repo.findByUserId("user-1", 5);
      expect(testDb.lastQuery().parameters).toEqual(["user-1", 5]);
    });

    it("returns an empty array when the user has no events", async () => {
      expect(await repo.findByUserId("user-1")).toEqual([]);
    });
  });

  describe("findUpcomingEvents", () => {
    it("selects the user's events starting from now, soonest first, default limit 10", async () => {
      testDb.enqueueRows([eventRow]);

      const before = Date.now();
      const result = await repo.findUpcomingEvents("user-1");
      const after = Date.now();

      expect(result).toEqual([eventRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "userId" = \$1 and "startTime" >= \$2 order by "startTime" asc limit \$3$/
      );
      expect(q.parameters[0]).toBe("user-1");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      const bound = (q.parameters[1] as Date).getTime();
      expect(bound).toBeGreaterThanOrEqual(before);
      expect(bound).toBeLessThanOrEqual(after);
      expect(q.parameters[2]).toBe(10);
    });

    it("honours a custom limit", async () => {
      await repo.findUpcomingEvents("user-1", 3);
      expect(testDb.lastQuery().parameters[2]).toBe(3);
    });

    it("returns an empty array when there are none", async () => {
      expect(await repo.findUpcomingEvents("user-1")).toEqual([]);
    });
  });

  describe("findEventsByDateRange", () => {
    it("filters on user and an inclusive start/end window, soonest first", async () => {
      const start = new Date("2030-12-01T00:00:00Z");
      const end = new Date("2030-12-31T23:59:59Z");
      testDb.enqueueRows([eventRow]);

      const result = await repo.findEventsByDateRange("user-1", start, end);

      expect(result).toEqual([eventRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "userId" = \$1 and "startTime" >= \$2 and "startTime" <= \$3 order by "startTime" asc$/
      );
      expect(q.parameters).toEqual(["user-1", start, end]);
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBeInstanceOf(Date);
    });

    it("returns an empty array when nothing falls in the window", async () => {
      expect(
        await repo.findEventsByDateRange("user-1", new Date(0), new Date())
      ).toEqual([]);
    });
  });

  describe("findConflictingEvents", () => {
    const start = new Date("2030-12-01T08:00:00Z");
    const end = new Date("2030-12-01T18:00:00Z");

    // The three overlap branches: starts inside, ends inside, encompasses.
    const overlapSql =
      '(("startTime" >= $2 and "startTime" < $3) or ("endTime" > $4 and "endTime" <= $5) or ("startTime" <= $6 and "endTime" >= $7))';

    it("checks the three overlap cases for the user, soonest first", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findConflictingEvents("user-1", start, end);

      expect(result).toEqual([eventRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "userId" = $1 and ' + overlapSql);
      expect(q.sql).not.toContain('"id" !=');
      expect(q.sql).toMatch(/order by "startTime" asc$/);
      expect(q.parameters).toEqual(["user-1", start, end, start, end, start, end]);
      q.parameters.slice(1).forEach((p) => expect(p).toBeInstanceOf(Date));
    });

    it("excludes the given event id when provided", async () => {
      await repo.findConflictingEvents("user-1", start, end, "event-1");

      const q = testDb.lastQuery();
      expect(q.sql).toContain(overlapSql + ' and "id" != $8');
      expect(q.sql).toMatch(/"id" != \$8 order by "startTime" asc$/);
      expect(q.parameters).toEqual([
        "user-1",
        start,
        end,
        start,
        end,
        start,
        end,
        "event-1",
      ]);
    });

    it("does not add an id filter for an empty exclusion id", async () => {
      await repo.findConflictingEvents("user-1", start, end, "");

      const q = testDb.lastQuery();
      expect(q.sql).not.toContain('"id" !=');
      expect(q.parameters).toHaveLength(7);
    });

    it("returns an empty array when nothing conflicts", async () => {
      expect(await repo.findConflictingEvents("user-1", start, end)).toEqual(
        []
      );
    });
  });

  describe("findEventsNeedingSync", () => {
    // NOTE: the repository filters on createdAt >= one hour ago, which does not
    // obviously express "needs sync" (see report). Only the stable parts of
    // the contract are asserted here: table, rows returned, the one-hour
    // window, and that it takes no user scoping.
    it("reads from calendar_events and returns the rows", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findEventsNeedingSync();

      expect(result).toEqual([eventRow]);
      expect(testDb.lastQuery().sql).toMatch(
        /^select \* from "calendar_events" where /
      );
    });

    it("binds a Date one hour before now", async () => {
      const before = Date.now();
      await repo.findEventsNeedingSync();
      const after = Date.now();

      const params = testDb.lastQuery().parameters;
      expect(params).toHaveLength(1);
      expect(params[0]).toBeInstanceOf(Date);
      const bound = (params[0] as Date).getTime();
      const hour = 60 * 60 * 1000;
      expect(bound).toBeGreaterThanOrEqual(before - hour);
      expect(bound).toBeLessThanOrEqual(after - hour);
    });

    it("returns an empty array when there are none", async () => {
      expect(await repo.findEventsNeedingSync()).toEqual([]);
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...eventRow, title: "Renamed" }]);

      const result = await repo.update("event-1", { title: "Renamed" } as any);

      expect(result.title).toBe("Renamed");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "calendar_events" set "title" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*$/
      );
      expect(q.parameters[0]).toBe("Renamed");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("event-1");
    });

    it("writes every provided field in order, with updatedAt last", async () => {
      const newStart = new Date("2031-01-01T00:00:00Z");
      testDb.enqueueRows([eventRow]);

      await repo.update("event-1", {
        location: "New Loc",
        startTime: newStart,
      } as any);

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "calendar_events" set "location" = \$1, "startTime" = \$2, "updatedAt" = \$3 where "id" = \$4/
      );
      expect(q.parameters[0]).toBe("New Loc");
      expect(q.parameters[1]).toBe(newStart);
      expect(q.parameters[2]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("event-1");
    });

    it("throws when no event matches", async () => {
      await expect(
        repo.update("missing", { title: "x" } as any)
      ).rejects.toThrow();
    });
  });

  describe("updateWithCalendarEventId", () => {
    it("updates only calendarEventId (plus updatedAt) for the event", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.updateWithCalendarEventId(
        "event-1",
        "google-event-123"
      );

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "calendar_events" set "calendarEventId" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*$/
      );
      expect(q.parameters[0]).toBe("google-event-123");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("event-1");
    });

    it("throws when the event does not exist", async () => {
      await expect(
        repo.updateWithCalendarEventId("missing", "g")
      ).rejects.toThrow();
    });
  });

  describe("findEventsByLocation", () => {
    // NOTE: the repository ignores its location argument (see report), so the
    // location filter is deliberately not asserted. Only user scoping and
    // ordering are.
    it("scopes to the user, newest first, and returns the rows", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.findEventsByLocation("user-1", "Test Location");

      expect(result).toEqual([eventRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "calendar_events" where "userId" = \$1/
      );
      expect(q.sql).toMatch(/order by "startTime" desc$/);
      expect(q.parameters[0]).toBe("user-1");
    });
  });

  describe("getEventStats", () => {
    const HOUR = 60 * 60 * 1000;

    /**
     * getEventStats fires its four queries via Promise.all. Rather than
     * depend on execution order, answer each query by inspecting its SQL.
     */
    function scriptStats(opts: {
      total: unknown;
      upcoming: unknown;
      past: unknown;
      events: Array<{ startTime: Date; endTime: Date }>;
    }): void {
      const answer = (q: { sql: string }): { rows: any[] } => {
        if (q.sql.includes("count(")) {
          if (q.sql.includes('"startTime" >=')) {
            return { rows: [{ count: opts.upcoming }] };
          }
          if (q.sql.includes('"startTime" <')) {
            return { rows: [{ count: opts.past }] };
          }
          return { rows: [{ count: opts.total }] };
        }
        return { rows: opts.events };
      };
      for (let i = 0; i < 4; i++) testDb.enqueueFn(answer as any);
    }

    it("returns counts and the average duration in whole minutes", async () => {
      const t0 = new Date("2030-01-01T00:00:00Z");
      scriptStats({
        total: 2,
        upcoming: 1,
        past: 1,
        events: [
          { startTime: t0, endTime: new Date(t0.getTime() + 8 * HOUR) },
          { startTime: t0, endTime: new Date(t0.getTime() + 10 * HOUR) },
        ],
      });

      const stats = await repo.getEventStats("user-1");

      expect(stats).toEqual({
        totalEvents: 2,
        upcomingEvents: 1,
        pastEvents: 1,
        averageDuration: 540, // (8h + 10h) / 2 = 9h = 540 min
      });
    });

    it("coerces string counts (bigint from pg) to numbers", async () => {
      scriptStats({ total: "12", upcoming: "5", past: "7", events: [] });

      const stats = await repo.getEventStats("user-1");

      expect(stats.totalEvents).toBe(12);
      expect(stats.upcomingEvents).toBe(5);
      expect(stats.pastEvents).toBe(7);
    });

    it("returns zeros for a user with no events", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0, events: [] });

      expect(await repo.getEventStats("user-1")).toEqual({
        totalEvents: 0,
        upcomingEvents: 0,
        pastEvents: 0,
        averageDuration: 0,
      });
    });

    it("rounds the average duration to the nearest minute", async () => {
      const t0 = new Date("2030-01-01T00:00:00Z");
      scriptStats({
        total: 1,
        upcoming: 0,
        past: 1,
        // 90 seconds = 1.5 minutes -> rounds to 2
        events: [{ startTime: t0, endTime: new Date(t0.getTime() + 90 * 1000) }],
      });

      expect((await repo.getEventStats("user-1")).averageDuration).toBe(2);
    });

    it("runs four user-scoped queries with a shared 'now' boundary", async () => {
      scriptStats({ total: 0, upcoming: 0, past: 0, events: [] });

      await repo.getEventStats("user-1");

      expect(testDb.queries).toHaveLength(4);
      for (const q of testDb.queries) {
        expect(q.sql).toContain('from "calendar_events" where "userId" = $1');
        expect(q.parameters[0]).toBe("user-1");
      }

      const total = testDb.queries.find(
        (q) => q.sql.includes("count(") && q.parameters.length === 1
      );
      const upcoming = testDb.queries.find((q) =>
        q.sql.includes('"startTime" >= $2')
      );
      const past = testDb.queries.find((q) => q.sql.includes('"startTime" < $2'));
      const durations = testDb.queries.find(
        (q) => !q.sql.includes("count(")
      );

      expect(total).toBeDefined();
      expect(upcoming).toBeDefined();
      expect(past).toBeDefined();
      expect(durations?.sql).toMatch(
        /^select "startTime", "endTime" from "calendar_events" where "userId" = \$1$/
      );

      expect(upcoming!.parameters[1]).toBeInstanceOf(Date);
      expect(past!.parameters[1]).toBeInstanceOf(Date);
      // upcoming and past are split on the very same instant
      expect(upcoming!.parameters[1]).toEqual(past!.parameters[1]);
    });

    it("throws when a count query returns no row", async () => {
      // nothing queued: every query yields { rows: [] }
      await expect(repo.getEventStats("user-1")).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([eventRow]);

      const result = await repo.delete("event-1");

      expect(result).toEqual(eventRow);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'delete from "calendar_events" where "id" = $1 returning *'
      );
      expect(q.parameters).toEqual(["event-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("cleanupOldEvents", () => {
    const DAY = 24 * 60 * 60 * 1000;

    it("deletes events that ended before now - 365 days by default", async () => {
      testDb.enqueueAffected(3);

      const before = Date.now();
      const result = await repo.cleanupOldEvents();
      const after = Date.now();

      expect(result).toEqual({ count: 3 });
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'delete from "calendar_events" where "endTime" < $1'
      );
      expect(q.parameters).toHaveLength(1);
      expect(q.parameters[0]).toBeInstanceOf(Date);
      const cutoff = (q.parameters[0] as Date).getTime();
      // setDate arithmetic can shift by an hour across DST, so allow 1h slack
      expect(cutoff).toBeGreaterThanOrEqual(before - 365 * DAY - 3600_000);
      expect(cutoff).toBeLessThanOrEqual(after - 365 * DAY + 3600_000);
    });

    it("uses the supplied retention period", async () => {
      testDb.enqueueAffected(1);

      const before = Date.now();
      const result = await repo.cleanupOldEvents(30);
      const after = Date.now();

      expect(result).toEqual({ count: 1 });
      const cutoff = (testDb.lastQuery().parameters[0] as Date).getTime();
      expect(cutoff).toBeGreaterThanOrEqual(before - 30 * DAY - 3600_000);
      expect(cutoff).toBeLessThanOrEqual(after - 30 * DAY + 3600_000);
    });

    it("reports zero when nothing was deleted", async () => {
      testDb.enqueueAffected(0);
      expect(await repo.cleanupOldEvents()).toEqual({ count: 0 });
    });

    it("reports zero when the driver gives no affected-row count", async () => {
      expect(await repo.cleanupOldEvents()).toEqual({ count: 0 });
    });
  });

  describe("error propagation", () => {
    it("surfaces database errors from reads", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("event-1")).rejects.toThrow("connection lost");
    });

    it("surfaces database errors from writes", async () => {
      testDb.enqueueError(new Error("write failed"));
      await expect(repo.delete("event-1")).rejects.toThrow("write failed");
    });
  });
});
