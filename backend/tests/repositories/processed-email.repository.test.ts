import crypto from "crypto";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * ProcessedEmailRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("ProcessedEmailRepository", () => {
  let repo: ProcessedEmailRepository;

  const emailRow = {
    id: "email-1",
    messageId: "msg-123",
    subject: "Test Schedule",
    sender: "sender@example.com",
    receivedAt: new Date("2025-03-01T08:00:00Z"),
    threadId: "thread-123",
    processed: false,
    processingStatus: "pending",
    pdfHash: "hash-123",
    error: null,
    createdAt: new Date("2025-03-01T08:00:01Z"),
    updatedAt: new Date("2025-03-01T08:00:01Z"),
    userId: "user-1",
  };

  beforeEach(() => {
    repo = new ProcessedEmailRepository();
  });

  describe("create", () => {
    const input: any = {
      messageId: "msg-123",
      subject: "Test Schedule",
      sender: "sender@example.com",
      receivedAt: new Date("2025-03-01T08:00:00Z"),
      userId: "user-1",
    };

    it("inserts a generated id plus the data and timestamps, returning the row", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.create(input);

      expect(result).toEqual(emailRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^insert into "processed_emails" \("id", "messageId", "subject", "sender", "receivedAt", "userId", "createdAt", "updatedAt"\) values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\) returning \*/
      );
      expect(q.parameters).toHaveLength(8);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 5)).toEqual([
        "msg-123",
        "Test Schedule",
        "sender@example.com",
        input.receivedAt,
      ]);
      expect(q.parameters[5]).toBe("user-1");
      expect(q.parameters[6]).toBeInstanceOf(Date);
      expect(q.parameters[7]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and generates its own", async () => {
      testDb.enqueueRows([emailRow]);

      await repo.create({ ...input, id: "client-chosen-id" });

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("client-chosen-id");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
    });

    it("generates a different id on each call", async () => {
      await repo.create(input).catch(() => undefined);
      await repo.create(input).catch(() => undefined);

      expect(testDb.queries[0].parameters[0]).not.toBe(
        testDb.queries[1].parameters[0]
      );
    });

    it("throws when the insert returns no row", async () => {
      await expect(repo.create(input)).rejects.toThrow();
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("duplicate key value"));
      await expect(repo.create(input)).rejects.toThrow("duplicate key value");
    });
  });

  describe("lookups", () => {
    it("findById filters on id and returns the row", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findById("email-1");

      expect(result).toEqual(emailRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "processed_emails" where "id" = \$1/
      );
      expect(q.parameters).toEqual(["email-1"]);
    });

    it("findById returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
    });

    it("findByMessageId filters on messageId", async () => {
      testDb.enqueueRows([emailRow]);

      expect(await repo.findByMessageId("msg-123")).toEqual(emailRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "processed_emails" where "messageId" = \$1/
      );
      expect(q.parameters).toEqual(["msg-123"]);
    });

    it("findByMessageId returns null when nothing matches", async () => {
      expect(await repo.findByMessageId("nope")).toBeNull();
    });

    it("findByPdfHash filters on pdfHash", async () => {
      testDb.enqueueRows([emailRow]);

      expect(await repo.findByPdfHash("hash-123")).toEqual(emailRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "processed_emails" where "pdfHash" = \$1/
      );
      expect(q.parameters).toEqual(["hash-123"]);
    });

    it("findByPdfHash returns null when nothing matches", async () => {
      expect(await repo.findByPdfHash("nope")).toBeNull();
    });

    it("surfaces database errors from lookups", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("email-1")).rejects.toThrow("connection lost");
    });
  });

  describe("findWithSchedule", () => {
    it("loads the email by id and returns it", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findWithSchedule("email-1");

      expect(result).toEqual(emailRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('from "processed_emails" where "id" = $1');
      expect(q.parameters).toEqual(["email-1"]);
    });

    it("returns null when the email does not exist", async () => {
      expect(await repo.findWithSchedule("missing")).toBeNull();
    });
  });

  describe("findMany", () => {
    it("selects everything with no clauses by default", async () => {
      testDb.enqueueRows([emailRow]);

      expect(await repo.findMany()).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe('select * from "processed_emails"');
      expect(q.parameters).toEqual([]);
    });

    it("ANDs every where entry as an equality", async () => {
      await repo.findMany({
        where: { userId: "user-1", processingStatus: "failed" },
      });

      const q = testDb.lastQuery();
      expect(q.sql).toContain(
        'where "userId" = $1 and "processingStatus" = $2'
      );
      expect(q.parameters).toEqual(["user-1", "failed"]);
    });

    it("applies orderBy and take as order by / limit", async () => {
      await repo.findMany({ orderBy: { receivedAt: "desc" }, take: 5 });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('order by "receivedAt" desc');
      expect(q.sql).toMatch(/limit \$1$/);
      expect(q.parameters).toEqual([5]);
    });

    it("supports ascending order", async () => {
      await repo.findMany({ orderBy: { createdAt: "asc" } });
      expect(testDb.lastQuery().sql).toContain('order by "createdAt" asc');
    });

    it("combines where, orderBy and take in SQL order", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findMany({
        where: { userId: "user-1" },
        orderBy: { receivedAt: "desc" },
        take: 10,
      });

      expect(result).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 order by "receivedAt" desc limit $2'
      );
      expect(q.parameters).toEqual(["user-1", 10]);
    });

    it("returns an empty array when nothing matches", async () => {
      expect(await repo.findMany({ where: { userId: "ghost" } })).toEqual([]);
    });
  });

  describe("findManyWithSchedule", () => {
    it("delegates to findMany and returns its rows", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findManyWithSchedule({
        where: { userId: "user-1" } as any,
        take: 3,
      });

      expect(result).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "userId" = $1');
      expect(q.sql).toMatch(/limit \$2$/);
      expect(q.parameters).toEqual(["user-1", 3]);
    });
  });

  describe("count", () => {
    it("counts all rows and coerces the bigint-as-string result to a number", async () => {
      testDb.enqueueRows([{ count: "42" }]);

      const n = await repo.count();

      expect(n).toBe(42);
      const q = testDb.lastQuery();
      expect(q.sql).toBe('select count(*) as "count" from "processed_emails"');
      expect(q.parameters).toEqual([]);
    });

    it("applies where entries as equality filters", async () => {
      testDb.enqueueRows([{ count: 3 }]);

      expect(
        await repo.count({ where: { userId: "user-1", processed: true } })
      ).toBe(3);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "userId" = $1 and "processed" = $2');
      expect(q.parameters).toEqual(["user-1", true]);
    });

    it("throws when the count query returns no row", async () => {
      await expect(repo.count()).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...emailRow, subject: "Renamed" }]);

      const result = await repo.update("email-1", { subject: "Renamed" });

      expect(result.subject).toBe("Renamed");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "processed_emails" set "subject" = \$1, "updatedAt" = \$2 where "id" = \$3 returning \*/
      );
      expect(q.parameters[0]).toBe("Renamed");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("email-1");
    });

    it("throws when no email matches", async () => {
      await expect(
        repo.update("missing", { subject: "x" })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([emailRow]);

      expect(await repo.delete("email-1")).toEqual(emailRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "processed_emails" where "id" = \$1 returning \*/
      );
      expect(q.parameters).toEqual(["email-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("findRecentEmails", () => {
    it("filters by user, newest first, defaulting to 20 rows", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findRecentEmails("user-1");

      expect(result).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 order by "receivedAt" desc limit $2'
      );
      expect(q.parameters).toEqual(["user-1", 20]);
    });

    it("honours an explicit limit", async () => {
      await repo.findRecentEmails("user-1", 5);
      expect(testDb.lastQuery().parameters).toEqual(["user-1", 5]);
    });

    it("returns an empty array when the user has no emails", async () => {
      expect(await repo.findRecentEmails("user-1")).toEqual([]);
    });
  });

  describe("findPendingEmails", () => {
    it("selects unprocessed, pending emails oldest first", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findPendingEmails("user-1");

      expect(result).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 and "processed" = $2 and "processingStatus" = $3 order by "receivedAt" asc'
      );
      expect(q.parameters).toEqual(["user-1", false, "pending"]);
    });

    it("returns an empty array when none are pending", async () => {
      expect(await repo.findPendingEmails("user-1")).toEqual([]);
    });
  });

  describe("findFailedEmails", () => {
    it("selects unprocessed, failed emails newest first", async () => {
      const failed = { ...emailRow, processingStatus: "failed", error: "boom" };
      testDb.enqueueRows([failed]);

      const result = await repo.findFailedEmails("user-1");

      expect(result).toEqual([failed]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 and "processed" = $2 and "processingStatus" = $3 order by "receivedAt" desc'
      );
      expect(q.parameters).toEqual(["user-1", false, "failed"]);
    });

    it("returns an empty array when none have failed", async () => {
      expect(await repo.findFailedEmails("user-1")).toEqual([]);
    });
  });

  describe("isDuplicate", () => {
    it("checks only messageId when no pdf hash is given", async () => {
      testDb.enqueueRows([{ id: "email-1" }]);

      expect(await repo.isDuplicate("msg-123")).toBe(true);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select "id" from "processed_emails" where "messageId" = $1'
      );
      expect(q.parameters).toEqual(["msg-123"]);
    });

    it("matches on messageId OR pdfHash when a hash is given", async () => {
      testDb.enqueueRows([{ id: "email-1" }]);

      expect(await repo.isDuplicate("msg-123", "hash-123")).toBe(true);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select "id" from "processed_emails" where ("messageId" = $1 or "pdfHash" = $2)'
      );
      expect(q.parameters).toEqual(["msg-123", "hash-123"]);
    });

    it("returns false when nothing matches (no hash)", async () => {
      expect(await repo.isDuplicate("msg-123")).toBe(false);
    });

    it("returns false when nothing matches (with hash)", async () => {
      expect(await repo.isDuplicate("msg-123", "hash-123")).toBe(false);
    });
  });

  describe("markAsProcessed", () => {
    it("sets processed=true and status=completed, scoped by id", async () => {
      const done = { ...emailRow, processed: true, processingStatus: "completed" };
      testDb.enqueueRows([done]);

      const result = await repo.markAsProcessed("email-1");

      expect(result).toEqual(done);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "processed_emails" set "processed" = \$1, "processingStatus" = \$2, "updatedAt" = \$3 where "id" = \$4 returning \*/
      );
      expect(q.parameters[0]).toBe(true);
      expect(q.parameters[1]).toBe("completed");
      expect(q.parameters[2]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("email-1");
    });

    it("throws when the email does not exist", async () => {
      await expect(repo.markAsProcessed("missing")).rejects.toThrow();
    });
  });

  describe("markAsFailed", () => {
    it("sets processed=false, status=failed and stores the error", async () => {
      const failed = {
        ...emailRow,
        processingStatus: "failed",
        error: "PDF parsing failed",
      };
      testDb.enqueueRows([failed]);

      const result = await repo.markAsFailed("email-1", "PDF parsing failed");

      expect(result).toEqual(failed);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "processed_emails" set "processed" = \$1, "processingStatus" = \$2, "error" = \$3, "updatedAt" = \$4 where "id" = \$5 returning \*/
      );
      expect(q.parameters[0]).toBe(false);
      expect(q.parameters[1]).toBe("failed");
      expect(q.parameters[2]).toBe("PDF parsing failed");
      expect(q.parameters[3]).toBeInstanceOf(Date);
      expect(q.parameters[4]).toBe("email-1");
    });

    it("throws when the email does not exist", async () => {
      await expect(repo.markAsFailed("missing", "x")).rejects.toThrow();
    });
  });

  describe("retryProcessing", () => {
    it("resets status to pending and clears the error, scoped by id", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.retryProcessing("email-1");

      expect(result).toEqual(emailRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "processed_emails" set "processingStatus" = \$1, "error" = \$2, "updatedAt" = \$3 where "id" = \$4 returning \*/
      );
      expect(q.parameters[0]).toBe("pending");
      expect(q.parameters[1]).toBeNull();
      expect(q.parameters[2]).toBeInstanceOf(Date);
      expect(q.parameters[3]).toBe("email-1");
    });

    it("throws when the email does not exist", async () => {
      await expect(repo.retryProcessing("missing")).rejects.toThrow();
    });
  });

  describe("generatePdfHash", () => {
    it("returns the SHA-256 hex digest of the buffer", () => {
      const buf = Buffer.from("test pdf content");
      const expected = crypto.createHash("sha256").update(buf).digest("hex");

      expect(repo.generatePdfHash(buf)).toBe(expected);
      expect(repo.generatePdfHash(buf)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic and content-sensitive", () => {
      const a = repo.generatePdfHash(Buffer.from("a"));
      expect(repo.generatePdfHash(Buffer.from("a"))).toBe(a);
      expect(repo.generatePdfHash(Buffer.from("b"))).not.toBe(a);
    });

    it("does not touch the database", () => {
      repo.generatePdfHash(Buffer.from("x"));
      expect(testDb.queries).toHaveLength(0);
    });
  });

  describe("getProcessingStats", () => {
    it("runs four count queries and maps them to total/processed/pending/failed", async () => {
      // The four counts run concurrently, so answer by inspecting the bound
      // parameters rather than relying on execution order.
      const answer = (q: { parameters: readonly unknown[] }) => {
        const p = q.parameters;
        let count = 10; // total
        if (p.includes(true)) count = 7;
        else if (p.includes("pending")) count = 2;
        else if (p.includes("failed")) count = 1;
        return { rows: [{ count: String(count) }] };
      };
      for (let i = 0; i < 4; i++) testDb.enqueueFn(answer);

      const stats = await repo.getProcessingStats("user-1");

      expect(stats).toEqual({ total: 10, processed: 7, pending: 2, failed: 1 });
      expect(testDb.queries).toHaveLength(4);
      for (const q of testDb.queries) {
        expect(q.sql).toMatch(
          /^select count\(\*\) as "count" from "processed_emails" where "userId" = \$1/
        );
        expect(q.parameters[0]).toBe("user-1");
      }
      const params = testDb.queries.map((q) => q.parameters.slice(1));
      expect(params).toEqual(
        expect.arrayContaining([[], [true], ["pending"], ["failed"]])
      );
    });

    it("returns zeros when every count is zero", async () => {
      for (let i = 0; i < 4; i++) testDb.enqueueRows([{ count: "0" }]);

      expect(await repo.getProcessingStats("user-1")).toEqual({
        total: 0,
        processed: 0,
        pending: 0,
        failed: 0,
      });
    });
  });

  describe("createWithDuplicateCheck", () => {
    const base: any = {
      messageId: "msg-123",
      subject: "Test Schedule",
      sender: "sender@example.com",
      receivedAt: new Date("2025-03-01T08:00:00Z"),
      userId: "user-1",
    };

    it("inserts with the computed pdfHash when no duplicate exists", async () => {
      const pdfBuffer = Buffer.from("test pdf content");
      const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      testDb.enqueueRows([]); // isDuplicate -> none
      testDb.enqueueRows([{ ...emailRow, pdfHash: hash }]); // insert

      const result = await repo.createWithDuplicateCheck({ ...base, pdfBuffer });

      expect(result).toEqual({ ...emailRow, pdfHash: hash });
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toBe(
        'select "id" from "processed_emails" where ("messageId" = $1 or "pdfHash" = $2)'
      );
      expect(testDb.queries[0].parameters).toEqual(["msg-123", hash]);
      expect(testDb.queries[1].sql).toMatch(/^insert into "processed_emails"/);
      expect(testDb.queries[1].parameters).toContain(hash);
      // the raw buffer must never be written to the table
      expect(testDb.queries[1].sql).not.toContain("pdfBuffer");
      expect(testDb.queries[1].parameters).not.toContain(pdfBuffer);
    });

    it("checks only messageId and inserts without a hash when there is no pdf", async () => {
      testDb.enqueueRows([]); // isDuplicate -> none
      testDb.enqueueRows([emailRow]); // insert

      const result = await repo.createWithDuplicateCheck(base);

      expect(result).toEqual(emailRow);
      expect(testDb.queries[0].sql).toBe(
        'select "id" from "processed_emails" where "messageId" = $1'
      );
      expect(testDb.queries[0].parameters).toEqual(["msg-123"]);
      expect(testDb.queries[1].sql).toMatch(/^insert into "processed_emails"/);
      expect(testDb.queries[1].sql).not.toContain('"pdfHash"');
    });

    it("returns null and does not insert when a duplicate exists", async () => {
      testDb.enqueueRows([{ id: "email-existing" }]);

      const result = await repo.createWithDuplicateCheck({
        ...base,
        pdfBuffer: Buffer.from("test pdf content"),
      });

      expect(result).toBeNull();
      expect(testDb.queries).toHaveLength(1);
      expect(testDb.queries[0].sql).toMatch(/^select "id"/);
    });
  });

  describe("findForExport", () => {
    it("filters by user only and orders newest first when no filters are given", async () => {
      testDb.enqueueRows([emailRow]);

      const result = await repo.findForExport("user-1");

      expect(result).toEqual([emailRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 order by "receivedAt" desc'
      );
      expect(q.parameters).toEqual(["user-1"]);
      expect(q.sql).not.toContain("limit");
    });

    it('status "processed" filters on processed = true', async () => {
      await repo.findForExport("user-1", { status: "processed" });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "userId" = $1 and "processed" = $2');
      expect(q.parameters).toEqual(["user-1", true]);
    });

    it('status "pending" filters on processingStatus = pending', async () => {
      await repo.findForExport("user-1", { status: "pending" });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('and "processingStatus" = $2');
      expect(q.parameters).toEqual(["user-1", "pending"]);
    });

    it('status "failed" filters on processingStatus = failed', async () => {
      await repo.findForExport("user-1", { status: "failed" });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('and "processingStatus" = $2');
      expect(q.parameters).toEqual(["user-1", "failed"]);
    });

    it("ignores an unrecognised status", async () => {
      await repo.findForExport("user-1", { status: "bogus" });

      const q = testDb.lastQuery();
      expect(q.sql).not.toContain('"processed" =');
      expect(q.sql).not.toContain('"processingStatus"');
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("applies dateFrom as >= and dateTo as <= on receivedAt", async () => {
      const dateFrom = new Date("2025-03-01T00:00:00Z");
      const dateTo = new Date("2025-03-31T23:59:59Z");

      await repo.findForExport("user-1", { dateFrom, dateTo });

      const q = testDb.lastQuery();
      expect(q.sql).toContain(
        'where "userId" = $1 and "receivedAt" >= $2 and "receivedAt" <= $3'
      );
      expect(q.parameters).toEqual(["user-1", dateFrom, dateTo]);
    });

    it("applies only the date bound that was supplied", async () => {
      const dateFrom = new Date("2025-03-01T00:00:00Z");
      await repo.findForExport("user-1", { dateFrom });
      expect(testDb.lastQuery().sql).toContain('"receivedAt" >= $2');
      expect(testDb.lastQuery().sql).not.toContain('"receivedAt" <=');

      const dateTo = new Date("2025-03-31T23:59:59Z");
      await repo.findForExport("user-1", { dateTo });
      expect(testDb.lastQuery().sql).toContain('"receivedAt" <= $2');
      expect(testDb.lastQuery().sql).not.toContain('"receivedAt" >=');
    });

    it("search matches subject OR sender case-insensitively with %term% wildcards", async () => {
      await repo.findForExport("user-1", { search: "call sheet" });

      const q = testDb.lastQuery();
      expect(q.sql).toContain(
        'and ("subject" ilike $2 or "sender" ilike $3)'
      );
      expect(q.parameters).toEqual(["user-1", "%call sheet%", "%call sheet%"]);
    });

    it("combines every filter, keeping the order-by last", async () => {
      const dateFrom = new Date("2025-03-01T00:00:00Z");
      const dateTo = new Date("2025-03-31T23:59:59Z");

      await repo.findForExport("user-1", {
        status: "failed",
        dateFrom,
        dateTo,
        search: "x",
      });

      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'select * from "processed_emails" where "userId" = $1 and "processingStatus" = $2 and "receivedAt" >= $3 and "receivedAt" <= $4 and ("subject" ilike $5 or "sender" ilike $6) order by "receivedAt" desc'
      );
      expect(q.parameters).toEqual([
        "user-1",
        "failed",
        dateFrom,
        dateTo,
        "%x%",
        "%x%",
      ]);
    });

    it("ignores an empty search string", async () => {
      await repo.findForExport("user-1", { search: "" });

      const q = testDb.lastQuery();
      expect(q.sql).not.toContain("ilike");
      expect(q.parameters).toEqual(["user-1"]);
    });
  });

  describe("cleanupOldEmails", () => {
    it("deletes processed emails created before the 90-day default cutoff", async () => {
      testDb.enqueueAffected(7);
      const before = Date.now();

      const result = await repo.cleanupOldEmails();

      const after = Date.now();
      expect(result).toEqual({ count: 7 });
      const q = testDb.lastQuery();
      expect(q.sql).toBe(
        'delete from "processed_emails" where "createdAt" < $1 and "processed" = $2'
      );
      expect(q.parameters[1]).toBe(true);

      const cutoff = q.parameters[0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      const day = 24 * 60 * 60 * 1000;
      // setDate() works in local time, so allow an hour of DST slack.
      const slack = 60 * 60 * 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 90 * day - slack);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - 90 * day + slack);
    });

    it("honours a custom retention period", async () => {
      testDb.enqueueAffected(0);
      const before = Date.now();

      await repo.cleanupOldEmails(30);

      const cutoff = testDb.lastQuery().parameters[0] as Date;
      const day = 24 * 60 * 60 * 1000;
      const slack = 60 * 60 * 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * day - slack);
      expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 30 * day + slack);
    });

    it("reports a count of 0 when nothing was deleted", async () => {
      testDb.enqueueAffected(0);
      expect(await repo.cleanupOldEmails()).toEqual({ count: 0 });
    });

    it("reports a count of 0 when the driver gives no affected-row count", async () => {
      expect(await repo.cleanupOldEmails()).toEqual({ count: 0 });
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("deadlock detected"));
      await expect(repo.cleanupOldEmails()).rejects.toThrow("deadlock detected");
    });
  });
});
