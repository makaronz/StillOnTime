/**
 * API integration tests against the real route graph.
 *
 * - App: express + /health + /api routes + errorHandler, as wired in
 *   src/index.ts. src/index is NOT imported (it calls startServer() at import
 *   time: Redis connect, then process.exit(1) or app.listen(3001)).
 *   The "production stack" app adds helmet(helmetConfig) and installCsrf()
 *   in production mode, which are the exported pieces index.ts mounts.
 * - Auth: a real JWT from services.oauth2.generateJWT. requireValidOAuth is
 *   satisfied through its real dependency (getOAuthStatus -> users row with
 *   Google tokens) in the emulated database.
 * - Database: the fake Kysely driver; a small responder emulates the tables
 *   from the compiled SQL so tests can assert on rows and SQL written.
 * - Redis: @/config/redis is mocked with an in-memory client.
 *
 * tests/setup.ts imports the route graph before this file runs, so the module
 * registry is reset and the graph required again, so the mocks below apply to
 * every module in it (e.g. CacheService's Redis client).
 */
import express from "express";
import request from "supertest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NO_GOOGLE_USER_ID = "33333333-3333-4333-8333-333333333333";

const mockRedisStore = new Map<string, string>();
jest.mock("@/config/redis", () => {
  const client = {
    setEx: jest.fn(async (k: string, _ttl: number, v: string) => {
      mockRedisStore.set(k, v);
      return "OK";
    }),
    get: jest.fn(async (k: string) => mockRedisStore.get(k) ?? null),
    del: jest.fn(async (k: string) => (mockRedisStore.delete(k) ? 1 : 0)),
  };
  return {
    createRedisClient: jest.fn(() => client),
    getRedisClient: jest.fn(async () => client),
    initializeRedis: jest.fn(async () => undefined),
    checkRedisConnection: jest.fn(async () => true),
    closeRedisConnection: jest.fn(async () => undefined),
  };
});

// Services built at import time start setInterval loops (MonitoringService,
// ErrorHandlerService). Unref the ones this file's fresh module graph creates
// so they cannot keep the Jest worker alive.
const realSetInterval = global.setInterval;
const intervalSpy = jest
  .spyOn(global, "setInterval")
  .mockImplementation(((fn: any, ms?: number, ...args: any[]) =>
    realSetInterval(fn, ms, ...args).unref()) as any);

jest.resetModules();
/* eslint-disable @typescript-eslint/no-var-requires */
const { testDb } = require("../helpers/kysely-test-db");
const { apiRoutes } = require("@/routes");
const healthRoutes = require("@/routes/health.routes").default;
const { services } = require("@/services");
const { errorHandler } = require("@/middleware/errorHandler");
const { installCsrf } = require("@/middleware/csrf-wiring");
const { helmetConfig, securityConfig } = require("@/config/security");
const helmet = require("helmet");
/* eslint-enable @typescript-eslint/no-var-requires */
intervalSpy.mockRestore();

// ---------------------------------------------------------------------------
// Minimal table emulation over the fake Kysely driver
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
interface Query {
  sql: string;
  parameters: readonly unknown[];
}
const tables: Record<string, Row[]> = {};
const table = (name: string): Row[] => (tables[name] ??= []);
let databaseDown = false;

function whereClause(sql: string): string {
  const i = sql.indexOf(" where ");
  if (i < 0) return "";
  const rest = sql.slice(i + 7);
  const end = rest.search(/ order by | limit | offset | returning /);
  return end < 0 ? rest : rest.slice(0, end);
}

function conditions(sql: string, params: readonly unknown[]) {
  const out: Array<{ col: string; op: string; value: unknown }> = [];
  const re = /"(?:\w+"\.")?(\w+)"\s*(=|>=|<=|<|>)\s*\$(\d+)/g;
  let m: RegExpExecArray | null;
  const where = whereClause(sql);
  while ((m = re.exec(where))) {
    out.push({ col: m[1], op: m[2], value: params[Number(m[3]) - 1] });
  }
  return out;
}

function matches(row: Row, conds: ReturnType<typeof conditions>): boolean {
  return conds.every(({ col, op, value }) => {
    const a = row[col] instanceof Date ? row[col].getTime() : row[col];
    const b = value instanceof Date ? value.getTime() : value;
    switch (op) {
      case "=":
        return a === b;
      case ">=":
        return a >= (b as any);
      case "<=":
        return a <= (b as any);
      case "<":
        return a < (b as any);
      case ">":
        return a > (b as any);
      default:
        return false;
    }
  });
}

function respond(q: Query): { rows: Row[] } {
  const { sql, parameters: p } = q;

  if (/^select 1$/i.test(sql.trim())) {
    if (databaseDown) throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    return { rows: [{ "?column?": 1 }] };
  }

  let m = /^insert into "(\w+)" \(([^)]*)\) values \(([^)]*)\)/.exec(sql);
  if (m) {
    const cols = m[2].split(",").map((c) => c.trim().replace(/"/g, ""));
    const vals = m[3].split(",").map((v) => p[Number(v.trim().slice(1)) - 1]);
    const row: Row = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    table(m[1]).push(row);
    return { rows: [{ ...row }] };
  }

  m = /^update "(\w+)" set (.*?) where /.exec(sql);
  if (m) {
    const set: Row = {};
    const re = /"(\w+)" = \$(\d+)/g;
    let s: RegExpExecArray | null;
    while ((s = re.exec(m[2]))) set[s[1]] = p[Number(s[2]) - 1];
    const conds = conditions(sql, p);
    const hit = table(m[1]).filter((r) => matches(r, conds));
    hit.forEach((r) => Object.assign(r, set));
    return { rows: hit.map((r) => ({ ...r })) };
  }

  m = /^delete from "(\w+)"/.exec(sql);
  if (m) {
    const conds = conditions(sql, p);
    const hit = table(m[1]).filter((r) => matches(r, conds));
    tables[m[1]] = table(m[1]).filter((r) => !hit.includes(r));
    return { rows: hit };
  }

  // userRepository.getUserStats: count sub-selects per user.
  if (/count\(\*\)/.test(sql) && /from "users" where "users"\."id" = \$\d+$/.test(sql)) {
    return {
      rows: [{ totalEmails: 0, processedEmails: 0, totalSchedules: 0, upcomingSchedules: 0 }],
    };
  }

  if (/^select .* from "users" left join "user_configs"/.test(sql)) {
    const conds = conditions(sql, p);
    return {
      rows: table("users")
        .filter((u) => matches(u, conds))
        .map((u) => {
          const c = table("user_configs").find((x) => x.userId === u.id);
          const { id: cId, userId: cUserId, ...cfg } = c || {};
          return {
            ...u,
            ...cfg,
            userConfigId: c ? cId : null,
            userConfigUserId: c ? cUserId : null,
          };
        }),
    };
  }

  m = /^select .*? from "(\w+)"/.exec(sql);
  if (m) {
    const rows = table(m[1]).filter((r) => matches(r, conditions(sql, p)));
    return { rows: rows.map((r) => ({ ...r })) };
  }

  return { rows: [] };
}

const user = (id: string, google: boolean): Row => ({
  id,
  email: `${id}@example.invalid`,
  name: "Crew Member",
  googleId: `google-${id}`,
  accessToken: google ? "enc-access" : null,
  refreshToken: google ? "enc-refresh" : null,
  tokenExpiry: google ? new Date(Date.now() + 3600_000) : null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
});

const schedule = (id: string, userId: string, shootingDate: string): Row => ({
  id,
  userId,
  emailId: `email-${id}`,
  shootingDate: new Date(shootingDate),
  callTime: "08:00",
  location: "Studio A",
  baseLocation: null,
  sceneType: "INT",
  scenes: ["1", "2A"],
  safetyNotes: null,
  equipment: null,
  contacts: null,
  notes: null,
  createdAt: new Date("2024-12-01T00:00:00Z"),
  updatedAt: new Date("2024-12-01T00:00:00Z"),
});

function installDb(): void {
  for (const k of Object.keys(tables)) delete tables[k];
  databaseDown = false;
  table("users").push(
    user(USER_ID, true),
    user(OTHER_USER_ID, true),
    user(NO_GOOGLE_USER_ID, false)
  );
  table("processed_emails").push({
    id: "email-1",
    userId: USER_ID,
    messageId: "gmail-msg-1",
    subject: "Call sheet",
    sender: "production@example.invalid",
    receivedAt: new Date("2025-01-10T00:00:00Z"),
    threadId: null,
    processed: true,
    processingStatus: "completed",
    pdfHash: null,
    error: null,
    createdAt: new Date("2025-01-10T00:00:00Z"),
    updatedAt: new Date("2025-01-10T00:00:00Z"),
  });
  table("schedule_data").push(
    schedule("sched-jan", USER_ID, "2025-01-15T08:00:00Z"),
    schedule("sched-mar", USER_ID, "2025-03-02T08:00:00Z"),
    schedule("sched-other", OTHER_USER_ID, "2025-01-20T08:00:00Z")
  );
  for (let i = 0; i < 1000; i++) testDb.enqueueFn(respond);
}

const queries = (): Query[] => testDb.queries as Query[];
const queriesOn = (re: RegExp): Query[] => queries().filter((q) => re.test(q.sql));

// ---------------------------------------------------------------------------

function routeApp(): express.Application {
  const a = express();
  a.use(express.json());
  a.use(express.urlencoded({ extended: true }));
  a.use("/health", healthRoutes);
  a.use("/api", apiRoutes);
  a.use(errorHandler);
  return a;
}

function productionStackApp(): express.Application {
  const a = express();
  a.use(helmet(helmetConfig));
  a.use(express.json());
  a.use(express.urlencoded({ extended: true }));
  installCsrf(a, { nodeEnv: "production" });
  a.use("/health", healthRoutes);
  a.use("/api", apiRoutes);
  a.use(errorHandler);
  return a;
}

const app = routeApp();
const tokenFor = (id: string): string =>
  services.oauth2.generateJWT({ id, email: `${id}@example.invalid` });
const authToken = tokenFor(USER_ID);
const auth = (r: request.Test, token = authToken): request.Test =>
  r.set("Authorization", `Bearer ${token}`);

beforeEach(() => {
  installDb();
  mockRedisStore.clear();
});

describe("API Integration Tests", () => {
  describe("Authentication Endpoints", () => {
    // POST /api/auth/register and POST /api/auth/login (email + password) no
    // longer exist: authentication is Google OAuth only. The token check the
    // old GET /api/auth/verify did is now GET /api/auth/profile.
    describe("GET /api/auth/profile", () => {
      it("should return the profile for a valid token", async () => {
        const response = await auth(request(app).get("/api/auth/profile"));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.profile).toMatchObject({
          id: USER_ID,
          email: `${USER_ID}@example.invalid`,
        });
      });

      it("should return 401 for invalid token", async () => {
        const response = await auth(request(app).get("/api/auth/profile"), "invalid-token");

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("INVALID_TOKEN");
        expect(response.body.message).toContain("Invalid or expired token");
      });

      it("should return 401 for missing token", async () => {
        const response = await request(app).get("/api/auth/profile");

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("MISSING_TOKEN");
        expect(response.body.message).toContain("Access token is required");
      });
    });
  });

  describe("Schedule Endpoints", () => {
    beforeEach(() => {
      jest.spyOn(services.jobProcessor, "addRouteRecalculationJob").mockResolvedValue({});
      jest.spyOn(services.jobProcessor, "addWeatherUpdateJob").mockResolvedValue({});
    });

    describe("POST /api/schedules", () => {
      it("should create a new schedule", async () => {
        const scheduleData = {
          emailId: "email-1",
          shootingDate: "2025-01-15T08:00:00Z",
          callTime: "08:00",
          location: "Studio A",
          sceneType: "EXT",
        };

        const response = await auth(request(app).post("/api/schedules")).send(scheduleData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toEqual(expect.any(String));
        expect(response.body.data).toMatchObject({
          userId: USER_ID,
          emailId: "email-1",
          callTime: "08:00",
          location: "Studio A",
          sceneType: "EXT",
        });

        const stored = table("schedule_data").find((s) => s.id === response.body.data.id);
        expect(stored).toBeDefined();
        expect(stored!.userId).toBe(USER_ID);
        expect(stored!.shootingDate).toEqual(new Date("2025-01-15T08:00:00Z"));
      });

      it("should return 400 for invalid schedule data", async () => {
        const response = await auth(request(app).post("/api/schedules")).send({
          location: "",
          shootingDate: "invalid-date",
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Validation failed");
        expect(queriesOn(/"schedule_data"/)).toHaveLength(0);
      });

      it("should return 401 for unauthorized request", async () => {
        const response = await request(app).post("/api/schedules").send({
          emailId: "email-1",
          shootingDate: "2025-01-15T08:00:00Z",
          callTime: "08:00",
          location: "Studio A",
        });

        expect(response.status).toBe(401);
        expect(queries()).toHaveLength(0);
      });
    });

    describe("GET /api/schedules", () => {
      it("should get all schedules for authenticated user", async () => {
        const response = await auth(request(app).get("/api/schedules"));

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.schedules)).toBe(true);
        expect(response.body.schedules.map((s: Row) => s.id).sort()).toEqual([
          "sched-jan",
          "sched-mar",
        ]);
        const [q] = queriesOn(/^select \* from "schedule_data"/);
        expect(q.parameters).toContain(USER_ID);
      });

      it("should filter schedules by date range", async () => {
        const response = await auth(
          request(app).get("/api/schedules?dateFrom=2025-01-01&dateTo=2025-01-31")
        );

        expect(response.status).toBe(200);
        expect(response.body.schedules.map((s: Row) => s.id)).toEqual(["sched-jan"]);
        response.body.schedules.forEach((s: Row) => {
          const d = new Date(s.shootingDate);
          expect(d >= new Date("2025-01-01")).toBe(true);
          expect(d <= new Date("2025-01-31")).toBe(true);
        });
        const [q] = queriesOn(/^select \* from "schedule_data"/);
        expect(q.sql).toContain('"shootingDate" >= ');
        expect(q.sql).toContain('"shootingDate" <= ');
        expect(q.parameters).toEqual([
          USER_ID,
          new Date("2025-01-01"),
          new Date("2025-01-31"),
        ]);
      });

      it("should paginate results", async () => {
        const response = await auth(request(app).get("/api/schedules?page=1&limit=10"));

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({ page: 1, limit: 10, type: "all" });
        const [q] = queriesOn(/^select \* from "schedule_data"/);
        expect(q.sql).toMatch(/ limit \$\d+/);
        expect(q.parameters.slice(0, 2)).toEqual([USER_ID, 10]);
        // Page 1 starts at the first row: no offset, or offset 0.
        expect(q.parameters.slice(2).every((v) => v === 0)).toBe(true);
      });

      it("should skip the earlier pages when page > 1", async () => {
        const response = await auth(request(app).get("/api/schedules?page=3&limit=10"));

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({ page: 3, limit: 10, type: "all" });
        const [q] = queriesOn(/^select \* from "schedule_data"/);
        expect(q.sql).toMatch(/ offset \$\d+/);
        expect(q.parameters).toEqual([USER_ID, 10, 20]);
      });

      it("should return 401 without a token", async () => {
        const response = await request(app).get("/api/schedules");
        expect(response.status).toBe(401);
      });
    });

    describe("GET /api/schedules/:id", () => {
      it("should get schedule by ID", async () => {
        const response = await auth(request(app).get("/api/schedules/sched-jan"));

        expect(response.status).toBe(200);
        expect(response.body.schedule).toMatchObject({
          id: "sched-jan",
          location: "Studio A",
          callTime: "08:00",
          scenes: ["1", "2A"],
        });
      });

      it("should return 404 for non-existent schedule", async () => {
        const response = await auth(request(app).get("/api/schedules/non-existent-id"));

        expect(response.status).toBe(404);
        expect(response.body.message).toContain("Schedule not found");
      });
    });

    describe("PUT /api/schedules/:id", () => {
      it("should update existing schedule", async () => {
        const updateData = { location: "Studio B", callTime: "09:00" };

        const response = await auth(request(app).put("/api/schedules/sched-jan")).send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.schedule.location).toBe(updateData.location);
        expect(response.body.schedule.callTime).toBe(updateData.callTime);

        const [u] = queriesOn(/^update "schedule_data"/);
        expect(u.parameters).toEqual(
          expect.arrayContaining(["Studio B", "09:00", "sched-jan"])
        );
        expect(table("schedule_data").find((s) => s.id === "sched-jan")).toMatchObject(updateData);
        expect(services.jobProcessor.addRouteRecalculationJob).toHaveBeenCalledWith("sched-jan");
      });

      it("should return 404 when updating non-existent schedule", async () => {
        const response = await auth(request(app).put("/api/schedules/non-existent-id")).send({
          location: "Studio B",
        });

        expect(response.status).toBe(404);
        expect(queriesOn(/^update /)).toHaveLength(0);
      });
    });

    describe("DELETE /api/schedules/:id", () => {
      it("should delete existing schedule", async () => {
        const response = await auth(request(app).delete("/api/schedules/sched-jan"));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        const [d] = queriesOn(/^delete from "schedule_data"/);
        expect(d.parameters).toEqual(["sched-jan"]);

        // Verify schedule is deleted
        const after = await auth(request(app).get("/api/schedules/sched-jan"));
        expect(after.status).toBe(404);
      });

      it("should return 404 when deleting non-existent schedule", async () => {
        const response = await auth(request(app).delete("/api/schedules/non-existent-id"));

        expect(response.status).toBe(404);
        expect(queriesOn(/^delete /)).toHaveLength(0);
      });
    });
  });

  describe("Email Integration Endpoints", () => {
    // POST /api/emails/fetch no longer exists; Gmail fetching is queued through
    // POST /api/emails/process (without a messageId it queues monitoring).
    describe("POST /api/emails/process", () => {
      beforeEach(() => {
        jest
          .spyOn(services.jobProcessor, "addEmailProcessingJob")
          .mockResolvedValue({ id: "job-1" });
      });

      it("should process email attachments", async () => {
        const response = await auth(request(app).post("/api/emails/process")).send({
          messageId: "test-message-id",
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.job).toEqual({
          id: "job-1",
          status: "queued",
          messageId: "test-message-id",
          priority: 0,
        });
        expect(services.jobProcessor.addEmailProcessingJob).toHaveBeenCalledWith(
          USER_ID,
          "test-message-id",
          0
        );
      });

      it("should reject an invalid bearer token with 401", async () => {
        const response = await auth(request(app).post("/api/emails/process"), "invalid-oauth-token");

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("INVALID_TOKEN");
        expect(services.jobProcessor.addEmailProcessingJob).not.toHaveBeenCalled();
      });

      it("should require Google OAuth for a user without Google tokens", async () => {
        const response = await auth(
          request(app).post("/api/emails/process"),
          tokenFor(NO_GOOGLE_USER_ID)
        ).send({ messageId: "test-message-id" });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("OAUTH_REQUIRED");
        expect(response.body.message).toContain("Google OAuth authentication required");
        expect(services.jobProcessor.addEmailProcessingJob).not.toHaveBeenCalled();
      });
    });
  });

  describe("Notification Endpoints", () => {
    describe("GET /api/notifications", () => {
      it("should get user notifications", async () => {
        const response = await auth(request(app).get("/api/notifications"));

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it("should return 401 without a token", async () => {
        const response = await request(app).get("/api/notifications");
        expect(response.status).toBe(401);
      });
    });

    describe("PATCH /api/notifications/:id/read", () => {
      it("should mark notification as read", async () => {
        const response = await auth(request(app).patch("/api/notifications/notif-1/read"));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain("notif-1");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/api/auth/callback")
        .set("Content-Type", "application/json")
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it("should handle rate limiting", async () => {
      const max = securityConfig.rateLimiting.auth.login.max;
      const responses = [];
      for (let i = 0; i <= max; i++) {
        responses.push(await request(app).get("/api/auth/login"));
      }

      expect(responses.slice(0, max).every((r) => r.status !== 429)).toBe(true);
      const limited = responses[max];
      expect(limited.status).toBe(429);
      expect(limited.body.code).toBe("IP_RATE_LIMIT_EXCEEDED");
      expect(limited.body.message).toContain("Too many authentication attempts");
    });

    it("should handle CSRF protection", async () => {
      const response = await auth(request(productionStackApp()).post("/api/schedules")).send({
        emailId: "email-1",
        shootingDate: "2025-01-15T08:00:00Z",
        callTime: "08:00",
        location: "Studio A",
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INVALID_CSRF_TOKEN");
      expect(response.body.message).toContain("CSRF token");
      expect(queriesOn(/"schedule_data"/)).toHaveLength(0);
    });
  });

  describe("Security Headers", () => {
    it("should include security headers", async () => {
      const response = await request(productionStackApp()).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-xss-protection"]).toBe("0");
      expect(response.headers["strict-transport-security"]).toBe(
        "max-age=31536000; includeSubDomains; preload"
      );
      expect(response.headers["content-security-policy"]).toContain("object-src 'none'");
    });
  });

  describe("Health Check", () => {
    // GET /health/database and GET /health/redis no longer exist; GET /health
    // reports both as entries in `services`.
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
    });

    it("should check database and Redis connection", async () => {
      const response = await request(app).get("/health");

      const byName = Object.fromEntries(
        response.body.services.map((s: Row) => [s.name, s])
      );
      expect(byName.database.status).toBe("healthy");
      expect(byName.cache.status).toBe("healthy");
      expect(byName.cache.details.testPassed).toBe(true);
      expect(queries().some((q) => /^select 1$/i.test(q.sql.trim()))).toBe(true);
    });

    it("should report unhealthy (503) when the database is down", async () => {
      databaseDown = true;

      const response = await request(app).get("/health");

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("unhealthy");
      const db = response.body.services.find((s: Row) => s.name === "database");
      expect(db.status).toBe("unhealthy");
      expect(db.error).toContain("ECONNREFUSED");
    });
  });
});
