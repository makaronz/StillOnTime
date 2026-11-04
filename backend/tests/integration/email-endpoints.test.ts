/**
 * Integration test for the email processing endpoints.
 *
 * Runs against the real route graph (`apiRoutes`), the real auth middleware
 * (JWT + Google-token check) and the real controller/repository code. The
 * database is the fake Kysely driver from tests/helpers/kysely-test-db.ts
 * (wired in tests/setup.ts), so every query the endpoint runs is recorded and
 * its result is scripted here. The only boundary stubbed out is the job queue
 * (`services.jobProcessor`); googleapis is auto-mocked by tests/setup.ts.
 *
 * Query order for a request behind `authenticateToken` + `requireValidOAuth`:
 *   1. requireValidOAuth -> oauth2Service.getOAuthStatus -> users lookup
 *   2+. whatever the controller runs
 */
import express from "express";
import request from "supertest";
import { CompiledQuery } from "kysely";
import { apiRoutes } from "@/routes";
import { services } from "@/services";
import { testDb } from "../helpers/kysely-test-db";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRoutes);
  return app;
}

function token(): string {
  return services.oauth2.generateJWT({
    id: USER_ID,
    email: "user@example.invalid",
  } as any);
}

/** Row read by requireValidOAuth: a user with live Google tokens. */
function enqueueOAuthUser(): void {
  testDb.enqueueRows([
    {
      id: USER_ID,
      email: "user@example.invalid",
      accessToken: "encrypted-access",
      refreshToken: "encrypted-refresh",
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    },
  ]);
}

function emailRow(overrides: Record<string, unknown> = {}): any {
  return {
    id: "email-1",
    messageId: "msg-1",
    subject: "Shooting schedule day 1",
    sender: "production@example.invalid",
    receivedAt: new Date("2026-10-01T08:00:00.000Z"),
    threadId: "thread-1",
    processed: true,
    processingStatus: "completed",
    error: null,
    pdfHash: "hash-1",
    userId: USER_ID,
    createdAt: new Date("2026-10-01T08:01:00.000Z"),
    updatedAt: new Date("2026-10-01T08:02:00.000Z"),
    ...overrides,
  };
}

/**
 * Script the count queries run by ProcessedEmailRepository.getProcessingStats
 * (they run concurrently, so answer by the bound parameters, not by order).
 */
function enqueueProcessingStats(stats: {
  total: number;
  processed: number;
  pending: number;
  failed: number;
}): void {
  const answer = (q: CompiledQuery): { rows: unknown[] } => {
    const params = q.parameters;
    let count = stats.total;
    if (params.includes(true)) count = stats.processed;
    else if (params.includes("pending")) count = stats.pending;
    else if (params.includes("failed")) count = stats.failed;
    return { rows: [{ count: String(count) }] };
  };
  for (let i = 0; i < 4; i++) testDb.enqueueFn(answer);
}

const queriesOn = (table: string) =>
  testDb.queries.filter((q) => q.sql.includes(`from "${table}"`));

describe("Email Processing Endpoints Integration", () => {
  let app: express.Application;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(services.jobProcessor, "addEmailProcessingJob")
      .mockResolvedValue({ id: "job-123" });
    jest.spyOn(services.jobProcessor, "getJobStats").mockResolvedValue({
      emailProcessing: { waiting: 0, active: 0, completed: 5, failed: 1 },
    });
    jest
      .spyOn(services.jobProcessor, "schedulePeriodicEmailCheck")
      .mockResolvedValue({ id: "periodic-job" });
    jest
      .spyOn(services.jobProcessor, "cancelPeriodicEmailCheck")
      .mockResolvedValue(undefined);
  });

  describe("Authentication", () => {
    it("rejects requests without a token (401)", async () => {
      const response = await request(app).get("/api/email/status");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("MISSING_TOKEN");
      expect(testDb.queries).toHaveLength(0);
    });

    it("rejects a user without Google tokens (403 OAUTH_REQUIRED)", async () => {
      testDb.enqueueRows([
        { id: USER_ID, email: "user@example.invalid", accessToken: null },
      ]);

      const response = await request(app)
        .get("/api/email/status")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("OAUTH_REQUIRED");
      expect(testDb.queries).toHaveLength(1);
      expect(testDb.queries[0].sql).toContain('from "users"');
      expect(testDb.queries[0].parameters).toEqual([USER_ID]);
    });
  });

  describe("Task 9.2 Requirements", () => {
    it("should have manual email processing trigger endpoint", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .post("/api/email/process")
        .set("Authorization", `Bearer ${token()}`)
        .send({ messageId: "test-message" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toEqual({
        id: "job-123",
        status: "queued",
        messageId: "test-message",
        priority: 0,
      });
      expect(response.body.message).toBe("Specific email processing queued");
      expect(services.jobProcessor.addEmailProcessingJob).toHaveBeenCalledWith(
        USER_ID,
        "test-message",
        0
      );
    });

    it("should have email processing status endpoint", async () => {
      enqueueOAuthUser();
      enqueueProcessingStats({ total: 10, processed: 8, pending: 1, failed: 1 });
      testDb.enqueueRows([emailRow()]);

      const response = await request(app)
        .get("/api/email/status")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toMatchObject({
        totalEmails: 10,
        processedEmails: 8,
        pendingEmails: 1,
        failedEmails: 1,
      });
      expect(response.body.jobQueue).toEqual({
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 1,
      });
      expect(response.body.recentEmails).toHaveLength(1);
      expect(response.body.recentEmails[0]).toMatchObject({
        id: "email-1",
        messageId: "msg-1",
        processingStatus: "completed",
        schedule: null,
      });

      const recent = testDb.lastQuery();
      expect(recent.sql).toContain('from "processed_emails"');
      expect(recent.sql).toContain('order by "receivedAt" desc');
      expect(recent.parameters).toEqual([USER_ID, 20]);
    });

    it("should have email processing history endpoint", async () => {
      enqueueOAuthUser();
      // findManyWithSchedule and count run concurrently: answer by SQL shape.
      const answer = (q: CompiledQuery): { rows: unknown[] } =>
        q.sql.includes("count(*)")
          ? { rows: [{ count: "1" }] }
          : { rows: [emailRow()] };
      testDb.enqueueFn(answer);
      testDb.enqueueFn(answer);

      const response = await request(app)
        .get("/api/email/history")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(response.body.emails).toHaveLength(1);
      expect(response.body.emails[0]).toMatchObject({
        id: "email-1",
        subject: "Shooting schedule day 1",
        pdfHash: "hash-1",
        schedule: null,
      });

      const [list] = queriesOn("processed_emails").filter(
        (q) => !q.sql.includes("count(*)")
      );
      expect(list.sql).toContain('"userId" = $1');
      expect(list.parameters[0]).toBe(USER_ID);
    });

    it("should have email reprocessing functionality (uses the :emailId path param)", async () => {
      enqueueOAuthUser();
      testDb.enqueueRows([
        emailRow({ id: "test-email-id", processed: false, processingStatus: "failed" }),
      ]);
      testDb.enqueueRows([
        emailRow({ id: "test-email-id", processed: false, processingStatus: "pending" }),
      ]);

      // The frontend (history.ts / dashboard.ts) posts with no body.
      const response = await request(app)
        .post("/api/email/test-email-id/retry")
        .set("Authorization", `Bearer ${token()}`);

      // queries[0] is the users lookup done by requireValidOAuth.
      const [, lookup, reset] = testDb.queries;
      expect(lookup.sql).toContain('from "processed_emails"');
      expect(lookup.parameters).toEqual(["test-email-id"]);
      expect(reset.sql).toContain('update "processed_emails"');
      expect(reset.parameters).toContain("test-email-id");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toEqual({
        id: "job-123",
        status: "queued",
        messageId: "msg-1",
        priority: 1,
      });
      expect(services.jobProcessor.addEmailProcessingJob).toHaveBeenCalledWith(
        USER_ID,
        "msg-1",
        1
      );
    });

    it("should have processing statistics endpoint", async () => {
      enqueueOAuthUser();
      enqueueProcessingStats({ total: 10, processed: 8, pending: 1, failed: 1 });
      testDb.enqueueRows([
        { processed: true, processingStatus: "completed", receivedAt: new Date("2026-10-01T08:00:00Z") },
        { processed: false, processingStatus: "failed", receivedAt: new Date("2026-10-01T09:00:00Z") },
      ]);

      const response = await request(app)
        .get("/api/email/statistics")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.period).toBe("30d");
      expect(response.body.overall).toEqual({
        total: 10,
        processed: 8,
        pending: 1,
        failed: 1,
      });
      expect(response.body.periodStats).toEqual({
        total: 2,
        successful: 1,
        failed: 1,
        successRate: 50,
      });
      expect(response.body.chartData).toEqual([
        { date: "2026-10-01", total: 2, successful: 1, successRate: 50 },
      ]);
    });

    it("restricts the statistics period query to a date range", async () => {
      enqueueOAuthUser();
      enqueueProcessingStats({ total: 0, processed: 0, pending: 0, failed: 0 });
      testDb.enqueueRows([]);

      await request(app)
        .get("/api/email/statistics?period=7d")
        .set("Authorization", `Bearer ${token()}`);

      const period = testDb.lastQuery();
      expect(period.sql).toContain('from "processed_emails"');
      expect(period.sql).toContain('"receivedAt" >=');
      expect(period.sql).toContain('"receivedAt" <=');
      // Every bound value must be something Postgres can compare to a column,
      // never a Prisma-style { gte, lte } object.
      for (const p of period.parameters) {
        expect(p === null || typeof p !== "object" || p instanceof Date).toBe(true);
      }
    });

    it("should have monitoring toggle endpoint", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .post("/api/email/monitoring")
        .set("Authorization", `Bearer ${token()}`)
        .send({ enabled: true, intervalMinutes: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.monitoring).toEqual({
        enabled: true,
        intervalMinutes: 5,
      });
      expect(
        services.jobProcessor.schedulePeriodicEmailCheck
      ).toHaveBeenCalledWith(USER_ID, 5);
      expect(services.jobProcessor.cancelPeriodicEmailCheck).not.toHaveBeenCalled();
    });

    it("should have email details endpoint", async () => {
      enqueueOAuthUser();
      testDb.enqueueRows([emailRow({ id: "test-email-id" })]);

      const response = await request(app)
        .get("/api/email/test-email-id")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toMatchObject({
        id: "test-email-id",
        messageId: "msg-1",
        threadId: "thread-1",
        subject: "Shooting schedule day 1",
      });
      expect(testDb.lastQuery().sql).toContain('from "processed_emails"');
      expect(testDb.lastQuery().parameters).toEqual(["test-email-id"]);
    });

    it("denies email details owned by another user (403)", async () => {
      enqueueOAuthUser();
      testDb.enqueueRows([emailRow({ id: "test-email-id", userId: OTHER_USER_ID })]);

      const response = await request(app)
        .get("/api/email/test-email-id")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ACCESS_DENIED");
    });

    it("should have health check endpoint", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .get("/api/email/health")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.service).toBe("email-processing");
    });
  });

  describe("Endpoint Validation", () => {
    it("should validate request parameters for processing trigger", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .post("/api/email/process")
        .set("Authorization", `Bearer ${token()}`)
        .send({ priority: 15 }); // Invalid priority

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(services.jobProcessor.addEmailProcessingJob).not.toHaveBeenCalled();
    });

    it("should validate query parameters for history", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .get("/api/email/history")
        .set("Authorization", `Bearer ${token()}`)
        .query({ page: 0 }); // Invalid page

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
      expect(queriesOn("processed_emails")).toHaveLength(0);
    });

    it("should validate monitoring toggle parameters", async () => {
      enqueueOAuthUser();

      const response = await request(app)
        .post("/api/email/monitoring")
        .set("Authorization", `Bearer ${token()}`)
        .send({ enabled: "invalid" }); // Should be boolean

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
      expect(
        services.jobProcessor.schedulePeriodicEmailCheck
      ).not.toHaveBeenCalled();
    });
  });
});
