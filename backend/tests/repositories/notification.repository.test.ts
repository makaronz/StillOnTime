import {
  NotificationRepository,
  notificationRepository,
} from "@/repositories/notification.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * NotificationRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("NotificationRepository", () => {
  let repo: NotificationRepository;

  const notificationRow = {
    id: "notif-1",
    userId: "user-1",
    channel: "email",
    template: "schedule_processed",
    subject: "Test Subject",
    message: "Test Message",
    data: { key: "value" },
    scheduledFor: null,
    sentAt: null,
    status: "pending",
    error: null,
    retryCount: 0,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    repo = new NotificationRepository();
  });

  describe("exports", () => {
    it("exposes a ready-to-use singleton instance", () => {
      expect(notificationRepository).toBeInstanceOf(NotificationRepository);
    });
  });

  describe("create", () => {
    const input = {
      userId: "user-1",
      channel: "email",
      template: "schedule_processed",
      subject: "Test Subject",
      message: "Test Message",
    };

    it("inserts a generated id, the input fields and timestamps, and returns the row", async () => {
      testDb.enqueueRows([notificationRow]);

      const result = await repo.create(input);

      expect(result).toEqual(notificationRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^insert into "notifications" \("id", "userId", "channel", "template", "subject", "message", "createdAt", "updatedAt"\) values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\)/
      );
      expect(q.sql).toContain("returning *");
      expect(q.parameters).toHaveLength(8);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 6)).toEqual([
        "user-1",
        "email",
        "schedule_processed",
        "Test Subject",
        "Test Message",
      ]);
      expect(q.parameters[6]).toBeInstanceOf(Date);
      expect(q.parameters[7]).toBeInstanceOf(Date);
    });

    it("passes optional fields (data, status, scheduledFor, retryCount) through", async () => {
      const scheduledFor = new Date("2030-01-01T05:00:00Z");
      testDb.enqueueRows([notificationRow]);

      await repo.create({
        ...input,
        data: { key: "value" },
        status: "pending",
        scheduledFor,
        retryCount: 0,
      });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('"data"');
      expect(q.sql).toContain('"status"');
      expect(q.sql).toContain('"scheduledFor"');
      expect(q.sql).toContain('"retryCount"');
      expect(q.parameters).toContainEqual({ key: "value" });
      expect(q.parameters).toContain("pending");
      expect(q.parameters).toContain(scheduledFor);
      expect(q.parameters).toContain(0);
    });

    it("generates a different id on each call", async () => {
      testDb.enqueueRows([notificationRow]);
      testDb.enqueueRows([notificationRow]);

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
      testDb.enqueueRows([notificationRow]);

      const result = await repo.findById("notif-1");

      expect(result).toEqual(notificationRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "notifications" where "id" = \$1/);
      expect(q.parameters).toEqual(["notif-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });
  });

  describe("findByUserId", () => {
    it("filters on userId and orders newest first, with no limit/offset by default", async () => {
      testDb.enqueueRows([notificationRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual([notificationRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "notifications" where "userId" = \$1 order by "createdAt" desc$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns an empty array when the user has no notifications", async () => {
      expect(await repo.findByUserId("user-1")).toEqual([]);
    });

    it("applies status, channel, limit and offset in order", async () => {
      testDb.enqueueRows([notificationRow]);

      await repo.findByUserId("user-1", {
        status: "sent",
        channel: "email" as any,
        limit: 10,
        offset: 5,
      });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /where "userId" = \$1 and "status" = \$2 and "channel" = \$3 order by "createdAt" desc limit \$4 offset \$5$/
      );
      expect(q.parameters).toEqual(["user-1", "sent", "email", 10, 5]);
    });

    it("applies only the status filter when given alone", async () => {
      await repo.findByUserId("user-1", { status: "failed" });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('"userId" = $1 and "status" = $2');
      expect(q.sql).not.toContain('"channel"');
      expect(q.sql).not.toContain("limit");
      expect(q.parameters).toEqual(["user-1", "failed"]);
    });

    it("applies only the channel filter when given alone", async () => {
      await repo.findByUserId("user-1", { channel: "sms" as any });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('"userId" = $1 and "channel" = $2');
      expect(q.sql).not.toContain('"status"');
      expect(q.parameters).toEqual(["user-1", "sms"]);
    });

    it("applies limit without offset", async () => {
      await repo.findByUserId("user-1", { limit: 25 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/order by "createdAt" desc limit \$2$/);
      expect(q.sql).not.toContain("offset");
      expect(q.parameters).toEqual(["user-1", 25]);
    });

    it("applies offset without limit", async () => {
      await repo.findByUserId("user-1", { offset: 20 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/order by "createdAt" desc offset \$2$/);
      expect(q.sql).not.toContain("limit");
      expect(q.parameters).toEqual(["user-1", 20]);
    });
  });

  describe("findPendingScheduled", () => {
    it("selects pending notifications scheduled up to the given date, oldest first", async () => {
      const before = new Date("2030-01-15T06:00:00Z");
      testDb.enqueueRows([notificationRow]);

      const result = await repo.findPendingScheduled(before);

      expect(result).toEqual([notificationRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "notifications" where "status" = \$1 and "scheduledFor" <= \$2 order by "scheduledFor" asc$/
      );
      expect(q.parameters).toEqual(["pending", before]);
    });

    it("defaults the cut-off to now", async () => {
      const start = Date.now();

      await repo.findPendingScheduled();

      const q = testDb.lastQuery();
      expect(q.parameters[0]).toBe("pending");
      const cutoff = q.parameters[1] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(start);
      expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("returns an empty array when nothing is due", async () => {
      expect(await repo.findPendingScheduled(new Date())).toEqual([]);
    });
  });

  describe("findRetryable", () => {
    it("selects failed notifications under the retry limit, least recently updated first", async () => {
      const failed = { ...notificationRow, status: "failed", retryCount: 2 };
      testDb.enqueueRows([failed]);

      const result = await repo.findRetryable(5);

      expect(result).toEqual([failed]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "notifications" where "status" = \$1 and "retryCount" < \$2 order by "updatedAt" asc$/
      );
      expect(q.parameters).toEqual(["failed", 5]);
    });

    it("defaults maxRetries to 3", async () => {
      await repo.findRetryable();
      expect(testDb.lastQuery().parameters).toEqual(["failed", 3]);
    });
  });

  describe("findByMessageId", () => {
    // NOTE: the repository currently ignores its messageId argument (see the
    // report). Only the shape that is safe to rely on is asserted here.
    it("returns null when no notification row exists", async () => {
      expect(await repo.findByMessageId("msg-1")).toBeNull();
      expect(testDb.lastQuery().sql).toMatch(/^select \* from "notifications"/);
    });
  });

  describe("update / updateById", () => {
    it("sets the given fields plus updatedAt, scoped by id, and returns the row", async () => {
      const sentAt = new Date("2030-01-01T00:00:00Z");
      testDb.enqueueRows([{ ...notificationRow, status: "sent", sentAt }]);

      const result = await repo.update("notif-1", { status: "sent", sentAt });

      expect(result.status).toBe("sent");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "status" = \$1, "sentAt" = \$2, "updatedAt" = \$3 where "id" = \$4 returning \*/
      );
      expect(q.parameters[0]).toBe("sent");
      expect(q.parameters[1]).toBe(sentAt);
      expect(q.parameters[2]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("notif-1");
    });

    it("always bumps updatedAt even for an empty patch", async () => {
      testDb.enqueueRows([notificationRow]);

      await repo.update("notif-1", {});

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "updatedAt" = \$1 where "id" = \$2/
      );
      expect(q.parameters[0]).toBeInstanceOf(Date);
      expect(q.parameters[1]).toBe("notif-1");
    });

    it("throws when no notification matches", async () => {
      await expect(repo.update("missing", { status: "sent" })).rejects.toThrow();
    });

    it("updateById delegates to update", async () => {
      testDb.enqueueRows([{ ...notificationRow, subject: "New" }]);

      const result = await repo.updateById("notif-1", { subject: "New" });

      expect(result.subject).toBe("New");
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "subject" = \$1, "updatedAt" = \$2 where "id" = \$3/
      );
      expect(q.parameters[0]).toBe("New");
      expect(q.parameters[2]).toBe("notif-1");
    });

    it("updateById throws when no notification matches", async () => {
      await expect(
        repo.updateById("missing", { subject: "x" })
      ).rejects.toThrow();
    });
  });

  describe("markAsSent", () => {
    it("sets status sent, sentAt, the messageId data and updatedAt", async () => {
      testDb.enqueueRows([{ ...notificationRow, status: "sent" }]);

      const result = await repo.markAsSent("notif-1", "msg-123");

      expect(result.status).toBe("sent");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "status" = \$1, "sentAt" = \$2, "data" = \$3, "updatedAt" = \$4 where "id" = \$5 returning \*/
      );
      expect(q.parameters[0]).toBe("sent");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toEqual({ messageId: "msg-123" });
      expect(q.parameters[3]).toBeInstanceOf(Date);
      expect(q.parameters[4]).toBe("notif-1");
    });

    it("omits the data column when no messageId is given", async () => {
      testDb.enqueueRows([{ ...notificationRow, status: "sent" }]);

      await repo.markAsSent("notif-1");

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "status" = \$1, "sentAt" = \$2, "updatedAt" = \$3 where "id" = \$4/
      );
      expect(q.sql).not.toContain('"data"');
      expect(q.parameters[0]).toBe("sent");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("notif-1");
    });

    it("throws when the notification does not exist", async () => {
      await expect(repo.markAsSent("missing", "m")).rejects.toThrow();
    });
  });

  describe("markAsFailed", () => {
    it("reads the current row, then writes status, error and retryCount + 1", async () => {
      testDb.enqueueRows([{ ...notificationRow, retryCount: 2 }]); // findById
      testDb.enqueueRows([
        { ...notificationRow, status: "failed", error: "boom", retryCount: 3 },
      ]); // update

      const result = await repo.markAsFailed("notif-1", "boom");

      expect(result.status).toBe("failed");
      expect(result.retryCount).toBe(3);
      expect(testDb.queries).toHaveLength(2);

      expect(testDb.queries[0].sql).toMatch(
        /^select \* from "notifications" where "id" = \$1/
      );
      expect(testDb.queries[0].parameters).toEqual(["notif-1"]);

      const update = testDb.queries[1];
      expect(update.sql).toMatch(
        /^update "notifications" set "status" = \$1, "error" = \$2, "retryCount" = \$3, "updatedAt" = \$4 where "id" = \$5 returning \*/
      );
      expect(update.parameters[0]).toBe("failed");
      expect(update.parameters[1]).toBe("boom");
      expect(update.parameters[2]).toBe(3);
      expect(update.parameters[3]).toBeInstanceOf(Date);
      expect(update.parameters[4]).toBe("notif-1");
    });

    it("starts the retry count at 1 when the current row has none", async () => {
      testDb.enqueueRows([{ ...notificationRow, retryCount: null }]);
      testDb.enqueueRows([{ ...notificationRow, status: "failed", retryCount: 1 }]);

      await repo.markAsFailed("notif-1", "boom");

      expect(testDb.queries[1].parameters[2]).toBe(1);
    });

    it("sets retryCount to 1 when the row is not found by the initial read, then throws on the empty update", async () => {
      testDb.enqueueRows([]); // findById -> none
      // update returns nothing

      await expect(repo.markAsFailed("missing", "boom")).rejects.toThrow();

      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[1].parameters[2]).toBe(1);
    });

    it("surfaces a failure of the initial read without attempting an update", async () => {
      testDb.enqueueError(new Error("read failed"));

      await expect(repo.markAsFailed("notif-1", "boom")).rejects.toThrow(
        "read failed"
      );
      expect(testDb.queries).toHaveLength(1);
    });
  });

  describe("cancel", () => {
    it("sets status cancelled via update", async () => {
      testDb.enqueueRows([{ ...notificationRow, status: "cancelled" }]);

      const result = await repo.cancel("notif-1");

      expect(result.status).toBe("cancelled");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "notifications" set "status" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*/
      );
      expect(q.parameters[0]).toBe("cancelled");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("notif-1");
    });

    it("throws when the notification does not exist", async () => {
      await expect(repo.cancel("missing")).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([notificationRow]);

      expect(await repo.delete("notif-1")).toEqual(notificationRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "notifications" where "id" = \$1 returning \*/
      );
      expect(q.parameters).toEqual(["notif-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("deleteOlderThan", () => {
    it("deletes old sent/cancelled notifications and returns the affected row count", async () => {
      const cutoff = new Date("2024-01-01T00:00:00Z");
      testDb.enqueueAffected(5);

      const count = await repo.deleteOlderThan(cutoff);

      expect(count).toBe(5);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "notifications" where "createdAt" < \$1 and "status" in \(\$2, \$3\)$/
      );
      expect(q.parameters).toEqual([cutoff, "sent", "cancelled"]);
    });

    it("returns 0 when nothing was deleted", async () => {
      testDb.enqueueAffected(0);
      expect(await repo.deleteOlderThan(new Date())).toBe(0);
    });

    it("returns 0 when the driver reports no affected-row count", async () => {
      expect(await repo.deleteOlderThan(new Date())).toBe(0);
    });

    it("converts a bigint count to a number", async () => {
      testDb.enqueueAffected(BigInt(12));
      const count = await repo.deleteOlderThan(new Date());
      expect(count).toBe(12);
      expect(typeof count).toBe("number");
    });
  });

  describe("getStatistics", () => {
    /** Answer each count query according to the status it filters on. */
    function enqueueCounts(counts: {
      total: unknown;
      sent: unknown;
      failed: unknown;
      pending: unknown;
    }): void {
      for (let i = 0; i < 4; i++) {
        testDb.enqueueFn((q) => {
          let count = counts.total;
          if (q.parameters.includes("sent")) count = counts.sent;
          else if (q.parameters.includes("failed")) count = counts.failed;
          else if (q.parameters.includes("pending")) count = counts.pending;
          return { rows: [{ count }] };
        });
      }
    }

    it("runs one count per bucket and coerces the (string) counts to numbers", async () => {
      enqueueCounts({ total: "100", sent: "80", failed: 15, pending: "5" });

      const stats = await repo.getStatistics("user-1");

      expect(stats).toMatchObject({
        total: 100,
        sent: 80,
        failed: 15,
        pending: 5,
      });
      expect(testDb.queries).toHaveLength(4);
    });

    it("scopes every query to the user and filters the status buckets", async () => {
      enqueueCounts({ total: 1, sent: 1, failed: 1, pending: 1 });

      await repo.getStatistics("user-1");

      for (const q of testDb.queries) {
        expect(q.sql).toMatch(
          /^select count\(\*\) as "count" from "notifications" where "userId" = \$1/
        );
        expect(q.parameters[0]).toBe("user-1");
      }

      const plain = testDb.queries.filter((q) => q.parameters.length === 1);
      expect(plain).toHaveLength(1);
      expect(plain[0].sql).not.toContain('"status"');

      for (const status of ["sent", "failed", "pending"]) {
        const matching = testDb.queries.filter(
          (q) =>
            q.sql.includes('and "status" = $2') && q.parameters[1] === status
        );
        expect(matching).toHaveLength(1);
        expect(matching[0].parameters).toEqual(["user-1", status]);
      }
    });

    it("adds createdAt bounds to every query when fromDate and toDate are given", async () => {
      const from = new Date("2024-01-01T00:00:00Z");
      const to = new Date("2024-01-31T00:00:00Z");
      enqueueCounts({ total: 50, sent: 40, failed: 6, pending: 4 });

      const stats = await repo.getStatistics("user-1", from, to);

      expect(stats.total).toBe(50);
      expect(testDb.queries).toHaveLength(4);
      for (const q of testDb.queries) {
        expect(q.sql).toContain(
          'where "userId" = $1 and "createdAt" >= $2 and "createdAt" <= $3'
        );
        expect(q.parameters.slice(0, 3)).toEqual(["user-1", from, to]);
      }
      // status buckets append their status after the date bounds
      const statuses = testDb.queries
        .map((q) => q.parameters[3])
        .filter((p) => p !== undefined)
        .sort();
      expect(statuses).toEqual(["failed", "pending", "sent"]);
    });

    it("applies only fromDate when toDate is omitted", async () => {
      const from = new Date("2024-01-01T00:00:00Z");
      enqueueCounts({ total: 1, sent: 1, failed: 1, pending: 1 });

      await repo.getStatistics("user-1", from);

      for (const q of testDb.queries) {
        expect(q.sql).toContain('"createdAt" >= $2');
        expect(q.sql).not.toContain('"createdAt" <=');
        expect(q.parameters.slice(0, 2)).toEqual(["user-1", from]);
      }
    });

    it("applies only toDate when fromDate is omitted", async () => {
      const to = new Date("2024-01-31T00:00:00Z");
      enqueueCounts({ total: 1, sent: 1, failed: 1, pending: 1 });

      await repo.getStatistics("user-1", undefined, to);

      for (const q of testDb.queries) {
        expect(q.sql).toContain('"createdAt" <= $2');
        expect(q.sql).not.toContain('"createdAt" >=');
        expect(q.parameters.slice(0, 2)).toEqual(["user-1", to]);
      }
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("stats failed"));
      await expect(repo.getStatistics("user-1")).rejects.toThrow("stats failed");
    });

    it("throws when a count query returns no row", async () => {
      testDb.enqueueRows([]);
      testDb.enqueueRows([]);
      testDb.enqueueRows([]);
      testDb.enqueueRows([]);
      await expect(repo.getStatistics("user-1")).rejects.toThrow();
    });
  });
});
