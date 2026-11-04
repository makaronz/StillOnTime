import { SummaryRepository, summaryRepository } from "@/repositories/summary.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * SummaryRepository is written against Kysely. These tests run the real query
 * builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("SummaryRepository", () => {
  let repo: SummaryRepository;

  const summaryRow = {
    id: "summary-1",
    userId: "user-1",
    scheduleId: "schedule-1",
    language: "pl",
    content: "Test content",
    htmlContent: "<div>Test HTML</div>",
    timeline: [{ time: "2024-01-15T05:00:00.000Z", event: "Wake up", type: "wake_up" }],
    weatherSummary: "15C, sunny",
    warnings: ["Test warning"],
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  const createData = {
    userId: "user-1",
    scheduleId: "schedule-1",
    language: "pl",
    content: "Test content",
    htmlContent: "<div>Test HTML</div>",
    timeline: [],
    weatherSummary: "15C",
    warnings: [],
  } as any;

  beforeEach(() => {
    repo = new SummaryRepository();
  });

  describe("module exports", () => {
    it("exports a ready-to-use singleton instance", () => {
      expect(summaryRepository).toBeInstanceOf(SummaryRepository);
    });
  });

  describe("create", () => {
    it("inserts a generated id plus the data and timestamps, returning the row", async () => {
      testDb.enqueueRows([summaryRow]);

      const result = await repo.create(createData);

      expect(result).toEqual(summaryRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "summaries" \("id", "userId", "scheduleId", "language", "content", "htmlContent", "timeline", "weatherSummary", "warnings", "createdAt", "updatedAt"\) values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11\)/);
      expect(q.sql).toMatch(/returning \*$/);
      expect(q.parameters).toHaveLength(11);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 9)).toEqual([
        "user-1",
        "schedule-1",
        "pl",
        "Test content",
        "<div>Test HTML</div>",
        [],
        "15C",
        [],
      ]);
      expect(q.parameters[9]).toBeInstanceOf(Date);
      expect(q.parameters[10]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and generates its own", async () => {
      testDb.enqueueRows([summaryRow]);

      await repo.create({ ...createData, id: "caller-chosen" });

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("caller-chosen");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters).toHaveLength(11);
    });

    it("generates a different id per call", async () => {
      testDb.enqueueRows([summaryRow]);
      testDb.enqueueRows([summaryRow]);

      await repo.create(createData);
      await repo.create(createData);

      expect(testDb.queries[0].parameters[0]).not.toBe(testDb.queries[1].parameters[0]);
    });

    it("throws when the insert returns no row", async () => {
      await expect(repo.create(createData)).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("selects by id with a single-row fetch and returns the row", async () => {
      testDb.enqueueRows([summaryRow]);

      const result = await repo.findById("summary-1");

      expect(result).toEqual(summaryRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "summaries" where "id" = \$1/);
      expect(q.parameters).toEqual(["summary-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...summaryRow, content: "Updated content" }]);

      const result = await repo.update("summary-1", { content: "Updated content" });

      expect(result.content).toBe("Updated content");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "summaries" set "content" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*/
      );
      expect(q.parameters[0]).toBe("Updated content");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("summary-1");
      expect(q.parameters).toHaveLength(3);
    });

    it("sets several fields in the given order", async () => {
      testDb.enqueueRows([summaryRow]);

      await repo.update("summary-1", { language: "en", weatherSummary: null } as any);

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /set "language" = \$1, "weatherSummary" = \$2, "updatedAt" = \$3 where "id" = \$4/
      );
      expect(q.parameters.slice(0, 2)).toEqual(["en", null]);
      expect(q.parameters[3]).toBe("summary-1");
    });

    it("throws when no summary matches", async () => {
      await expect(repo.update("missing", { content: "x" })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([summaryRow]);

      expect(await repo.delete("summary-1")).toEqual(summaryRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^delete from "summaries" where "id" = \$1 returning \*/);
      expect(q.parameters).toEqual(["summary-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("findByScheduleId", () => {
    it("filters on scheduleId and returns the row", async () => {
      testDb.enqueueRows([summaryRow]);

      expect(await repo.findByScheduleId("schedule-1")).toEqual(summaryRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "summaries" where "scheduleId" = \$1/);
      expect(q.parameters).toEqual(["schedule-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findByScheduleId("nope")).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("filters on userId, newest first, with no limit/offset by default", async () => {
      testDb.enqueueRows([summaryRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual([summaryRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "summaries" where "userId" = \$1 order by "createdAt" desc$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns an empty array when there are no summaries", async () => {
      expect(await repo.findByUserId("user-1")).toEqual([]);
    });

    it("applies language filter, limit and offset", async () => {
      testDb.enqueueRows([summaryRow]);

      await repo.findByUserId("user-1", { limit: 10, offset: 5, language: "pl" });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /where "userId" = \$1 and "language" = \$2 order by "createdAt" desc limit \$3 offset \$4$/
      );
      expect(q.parameters).toEqual(["user-1", "pl", 10, 5]);
    });

    it("applies only the language filter when no pagination is given", async () => {
      await repo.findByUserId("user-1", { language: "en" });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/where "userId" = \$1 and "language" = \$2 order by "createdAt" desc$/);
      expect(q.parameters).toEqual(["user-1", "en"]);
    });

    it("applies only a limit", async () => {
      await repo.findByUserId("user-1", { limit: 3 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/order by "createdAt" desc limit \$2$/);
      expect(q.sql).not.toContain("offset");
      expect(q.parameters).toEqual(["user-1", 3]);
    });

    it("applies only an offset", async () => {
      await repo.findByUserId("user-1", { offset: 20 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/order by "createdAt" desc offset \$2$/);
      expect(q.sql).not.toContain("limit");
      expect(q.parameters).toEqual(["user-1", 20]);
    });
  });

  describe("findWithSchedule", () => {
    it("filters on userId, newest first, and returns the rows", async () => {
      testDb.enqueueRows([summaryRow]);

      const result = await repo.findWithSchedule("user-1");

      expect(result).toEqual([summaryRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "summaries" where "userId" = \$1 order by "createdAt" desc$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns an empty array when there are no summaries", async () => {
      expect(await repo.findWithSchedule("user-1")).toEqual([]);
    });

    it("applies limit and offset", async () => {
      await repo.findWithSchedule("user-1", { limit: 10, offset: 5 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/order by "createdAt" desc limit \$2 offset \$3$/);
      expect(q.parameters).toEqual(["user-1", 10, 5]);
    });
  });

  describe("upsertByScheduleId", () => {
    it("updates the existing summary found by scheduleId", async () => {
      testDb.enqueueRows([summaryRow]); // findByScheduleId
      testDb.enqueueRows([{ ...summaryRow, content: "Updated content" }]); // update

      const result = await repo.upsertByScheduleId("schedule-1", createData, {
        content: "Updated content",
      });

      expect(result.content).toBe("Updated content");
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toMatch(/^select \* from "summaries" where "scheduleId" = \$1/);
      expect(testDb.queries[0].parameters).toEqual(["schedule-1"]);
      expect(testDb.queries[1].sql).toMatch(
        /^update "summaries" set "content" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*/
      );
      expect(testDb.queries[1].parameters[0]).toBe("Updated content");
      // updates the row that was found, by its id
      expect(testDb.queries[1].parameters[2]).toBe("summary-1");
    });

    it("creates a new summary from createData when none exists", async () => {
      testDb.enqueueRows([]); // findByScheduleId -> none
      testDb.enqueueRows([summaryRow]); // insert

      const result = await repo.upsertByScheduleId("schedule-1", createData, {
        content: "ignored",
      });

      expect(result).toEqual(summaryRow);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[1].sql).toMatch(/^insert into "summaries"/);
      expect(testDb.queries[1].parameters).toContain("Test content");
      expect(testDb.queries[1].parameters).not.toContain("ignored");
    });
  });

  describe("deleteOlderThan", () => {
    it("deletes rows created before the cutoff and returns the count", async () => {
      testDb.enqueueAffected(3);
      const cutoff = new Date("2024-01-01T00:00:00Z");

      const count = await repo.deleteOlderThan(cutoff);

      expect(count).toBe(3);
      const q = testDb.lastQuery();
      expect(q.sql).toBe('delete from "summaries" where "createdAt" < $1');
      expect(q.parameters).toEqual([cutoff]);
    });

    it("returns 0 when nothing was deleted", async () => {
      testDb.enqueueAffected(0);
      expect(await repo.deleteOlderThan(new Date())).toBe(0);
    });

    it("returns a plain number, not a bigint", async () => {
      testDb.enqueueAffected(BigInt(12));
      const count = await repo.deleteOlderThan(new Date());
      expect(typeof count).toBe("number");
      expect(count).toBe(12);
    });
  });

  describe("getStatistics", () => {
    /**
     * getStatistics runs its three queries concurrently, so for tests that only
     * inspect the SQL, answer each query by its text rather than by queue order.
     */
    function answerAnyStatsQuery(): void {
      const respond = (q: { sql: string }) =>
        q.sql.startsWith('select "language"')
          ? { rows: [] }
          : { rows: [{ count: "0" }] };
      testDb.enqueueFn(respond);
      testDb.enqueueFn(respond);
      testDb.enqueueFn(respond);
    }

    it("returns total, per-language counts and recent count", async () => {
      // No date filters: the total query and the recent query have identical SQL
      // shape, so script by call order instead.
      testDb.enqueueRows([{ count: "50" }]); // total
      testDb.enqueueRows([
        { language: "pl" },
        { language: "pl" },
        { language: "en" },
      ]); // languages
      testDb.enqueueRows([{ count: "10" }]); // recent

      const result = await repo.getStatistics("user-1");

      expect(result).toEqual({
        total: 50,
        byLanguage: { pl: 2, en: 1 },
        recentCount: 10,
      });
      expect(testDb.queries).toHaveLength(3);
    });

    it("issues a count, a language select and a recent-count query for the user", async () => {
      answerAnyStatsQuery();
      await repo.getStatistics("user-1");

      const sqls = testDb.queries.map((q) => q.sql);
      expect(sqls).toHaveLength(3);
      expect(sqls).toContain(
        'select count(*) as "count" from "summaries" where "userId" = $1'
      );
      expect(sqls).toContain('select "language" from "summaries" where "userId" = $1');
      expect(sqls).toContain(
        'select count(*) as "count" from "summaries" where "userId" = $1 and "createdAt" >= $2'
      );
      for (const q of testDb.queries) {
        expect(q.parameters[0]).toBe("user-1");
      }
    });

    it("recent count looks back 30 days from now", async () => {
      const before = Date.now();
      answerAnyStatsQuery();
      await repo.getStatistics("user-1");
      const after = Date.now();

      const recent = testDb.queries.find((q) =>
        q.sql.includes('select count(*) as "count" from "summaries" where "userId" = $1 and "createdAt" >= $2')
      );
      expect(recent).toBeDefined();
      const since = recent!.parameters[1] as Date;
      expect(since).toBeInstanceOf(Date);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(since.getTime()).toBeGreaterThanOrEqual(before - thirtyDays);
      expect(since.getTime()).toBeLessThanOrEqual(after - thirtyDays);
    });

    it("applies fromDate and toDate to the total and language queries but not the recent query", async () => {
      const fromDate = new Date("2024-01-01T00:00:00Z");
      const toDate = new Date("2024-01-31T00:00:00Z");

      answerAnyStatsQuery();
      await repo.getStatistics("user-1", fromDate, toDate);

      const sqls = testDb.queries.map((q) => q.sql);
      expect(sqls).toContain(
        'select count(*) as "count" from "summaries" where "userId" = $1 and "createdAt" >= $2 and "createdAt" <= $3'
      );
      expect(sqls).toContain(
        'select "language" from "summaries" where "userId" = $1 and "createdAt" >= $2 and "createdAt" <= $3'
      );
      const filtered = testDb.queries.filter((q) => q.sql.includes('"createdAt" <= $3'));
      expect(filtered).toHaveLength(2);
      for (const q of filtered) {
        expect(q.parameters).toEqual(["user-1", fromDate, toDate]);
      }
      const recent = testDb.queries.find(
        (q) => !q.sql.includes('"createdAt" <= $3') && q.sql.includes('"createdAt" >= $2')
      );
      expect(recent).toBeDefined();
      expect(recent!.parameters[1]).toBeInstanceOf(Date);
      expect(recent!.parameters[1]).not.toBe(fromDate);
    });

    it("applies only fromDate when toDate is omitted", async () => {
      const fromDate = new Date("2024-01-01T00:00:00Z");

      answerAnyStatsQuery();
      await repo.getStatistics("user-1", fromDate);

      const langQuery = testDb.queries.find((q) => q.sql.startsWith('select "language"'));
      expect(langQuery!.sql).toBe(
        'select "language" from "summaries" where "userId" = $1 and "createdAt" >= $2'
      );
      expect(langQuery!.parameters).toEqual(["user-1", fromDate]);
    });

    it("applies only toDate when fromDate is omitted", async () => {
      const toDate = new Date("2024-01-31T00:00:00Z");

      answerAnyStatsQuery();
      await repo.getStatistics("user-1", undefined, toDate);

      const langQuery = testDb.queries.find((q) => q.sql.startsWith('select "language"'));
      expect(langQuery!.sql).toBe(
        'select "language" from "summaries" where "userId" = $1 and "createdAt" <= $2'
      );
      expect(langQuery!.parameters).toEqual(["user-1", toDate]);
    });

    it("returns zeros and an empty language map when there are no summaries", async () => {
      testDb.enqueueRows([{ count: "0" }]);
      testDb.enqueueRows([]);
      testDb.enqueueRows([{ count: "0" }]);

      expect(await repo.getStatistics("user-1")).toEqual({
        total: 0,
        byLanguage: {},
        recentCount: 0,
      });
    });

    it("coerces string counts (as pg returns for count(*)) to numbers", async () => {
      testDb.enqueueRows([{ count: "7" }]);
      testDb.enqueueRows([{ language: "pl" }]);
      testDb.enqueueRows([{ count: "2" }]);

      const stats = await repo.getStatistics("user-1");

      expect(stats.total).toBe(7);
      expect(typeof stats.total).toBe("number");
      expect(stats.recentCount).toBe(2);
      expect(typeof stats.recentCount).toBe("number");
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.getStatistics("user-1")).rejects.toThrow("connection lost");
    });
  });

  describe("error propagation", () => {
    it("surfaces database errors from reads", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("summary-1")).rejects.toThrow("connection lost");
    });

    it("surfaces database errors from writes", async () => {
      testDb.enqueueError(new Error("unique violation"));
      await expect(repo.create(createData)).rejects.toThrow("unique violation");
    });

    it("upsert does not insert when the lookup fails", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(
        repo.upsertByScheduleId("schedule-1", createData, { content: "x" })
      ).rejects.toThrow("connection lost");
      expect(testDb.queries).toHaveLength(1);
    });
  });
});
