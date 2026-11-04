/**
 * SMS endpoints, exercised through the real /api route graph.
 *
 * - App: express + apiRoutes + errorHandler (src/index is NOT imported: it
 *   calls startServer() at import time).
 * - Auth: a real JWT from services.oauth2.generateJWT, checked by the real
 *   authenticateToken middleware. Auth is Google OAuth only; there is no
 *   email/password login to call.
 * - Database: the fake Kysely driver (tests/helpers/kysely-test-db.ts). A small
 *   responder emulates the users / user_configs / notifications tables from the
 *   compiled SQL, so multi-request flows (configure -> verify -> status) see the
 *   rows earlier requests wrote, and tests can assert on what was written.
 * - Twilio: mocked client; the webhook signature is checked by the real
 *   requireTwilioSignature using twilio's own signing helper.
 *
 * The SMS service reads TWILIO_* at construction, and the route module builds
 * it at import time. tests/setup.ts has already imported the route graph
 * before this file runs, so the env is set first and the module registry is
 * reset before the routes are required again.
 */
import express from "express";
import request from "supertest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SMS_NUMBER = "+48123456789";
const MASKED_NUMBER = "+*******6789";
const TWILIO_TOKEN = "unit-test-twilio-token-00000000";
const WEBHOOK_URL = "https://hooks.example.invalid/api/sms/webhook";
const ACCOUNT_INFO = {
  sid: "AC_test_account",
  friendlyName: "Test Account",
  status: "active",
};

const mockMessagesCreate = jest.fn();
const mockAccountFetch = jest.fn();

jest.mock("twilio", () => {
  const actual = jest.requireActual("twilio");
  const Twilio = jest.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockMessagesCreate(...args) },
    api: {
      accounts: jest.fn(() => ({
        fetch: (...args: unknown[]) => mockAccountFetch(...args),
      })),
    },
  }));
  return { ...actual, Twilio };
});

jest.mock("@/config/redis", () => ({
  createRedisClient: jest.fn(),
  getRedisClient: jest.fn(async () => {
    throw new Error("redis is not available in tests");
  }),
  initializeRedis: jest.fn(async () => undefined),
  checkRedisConnection: jest.fn(async () => false),
  closeRedisConnection: jest.fn(async () => undefined),
}));

const savedEnv = {
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM_NUMBER,
  url: process.env.TWILIO_WEBHOOK_URL,
};
process.env.TWILIO_ACCOUNT_SID = ACCOUNT_INFO.sid;
process.env.TWILIO_AUTH_TOKEN = TWILIO_TOKEN;
process.env.TWILIO_FROM_NUMBER = "+15005550006";
process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL;

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
const { services } = require("@/services");
const { errorHandler } = require("@/middleware/errorHandler");
const twilioActual = jest.requireActual("twilio");
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

function messageIdOf(row: Row): unknown {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  return data?.messageId;
}

function respond(q: Query): { rows: Row[] } {
  const { sql, parameters: p } = q;

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
    let rows = table(m[1]).filter((r) => matches(r, conditions(sql, p)));
    // A correct findByMessageId has to filter on the stored message id; the
    // operator it uses is not parsed here, so apply that filter by value.
    if (m[1] === "notifications" && /messageId/.test(whereClause(sql))) {
      rows = rows.filter((r) => p.includes(messageIdOf(r)));
    }
    return { rows: rows.map((r) => ({ ...r })) };
  }

  return { rows: [] };
}

function installDb(): void {
  for (const k of Object.keys(tables)) delete tables[k];
  table("users").push({
    id: USER_ID,
    email: "crew@example.invalid",
    name: "Crew Member",
    googleId: "google-1",
    accessToken: "enc-access",
    refreshToken: "enc-refresh",
    tokenExpiry: new Date(Date.now() + 3600_000),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  });
  for (let i = 0; i < 1000; i++) testDb.enqueueFn(respond);
}

const queries = (): Query[] => testDb.queries as Query[];
const userConfig = (): Row | undefined =>
  table("user_configs").find((c) => c.userId === USER_ID);

// ---------------------------------------------------------------------------

function buildApp(): express.Application {
  const a = express();
  a.use(express.json());
  a.use(express.urlencoded({ extended: true }));
  a.use("/api", apiRoutes);
  a.use(errorHandler);
  return a;
}

const app = buildApp();
const authToken: string = services.oauth2.generateJWT({
  id: USER_ID,
  email: "crew@example.invalid",
});
const auth = (r: request.Test): request.Test =>
  r.set("Authorization", `Bearer ${authToken}`);

async function configure(enabled = true): Promise<request.Response> {
  return auth(request(app).post("/api/sms/configure")).send({
    smsNumber: SMS_NUMBER,
    enabled,
  });
}

async function configureAndVerify(): Promise<void> {
  expect((await configure()).status).toBe(200);
  const code = userConfig()!.smsVerificationCode;
  const res = await auth(request(app).post("/api/sms/verify")).send({ code });
  expect(res.status).toBe(200);
}

function signedWebhook(form: Record<string, string>): request.Test {
  const sig = twilioActual.getExpectedTwilioSignature(TWILIO_TOKEN, WEBHOOK_URL, form);
  return request(app)
    .post("/api/sms/webhook")
    .set("X-Twilio-Signature", sig)
    .type("form")
    .send(form);
}

let sidCounter = 0;
beforeEach(() => {
  installDb();
  mockMessagesCreate.mockImplementation(async () => ({
    sid: `SM_sent_${++sidCounter}`,
    status: "queued",
  }));
  mockAccountFetch.mockResolvedValue(ACCOUNT_INFO);
});

afterAll(() => {
  const restore = (k: string, v: string | undefined): void => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  restore("TWILIO_ACCOUNT_SID", savedEnv.sid);
  restore("TWILIO_AUTH_TOKEN", savedEnv.token);
  restore("TWILIO_FROM_NUMBER", savedEnv.from);
  restore("TWILIO_WEBHOOK_URL", savedEnv.url);
});

describe("SMS Endpoints Integration", () => {
  describe("POST /api/sms/configure", () => {
    it("should configure SMS settings successfully", async () => {
      const response = await configure();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verificationSent).toBe(true);

      // The row written for the caller (and only the caller).
      const cfg = userConfig();
      expect(cfg).toBeDefined();
      expect(cfg!.smsNumber).toBe(SMS_NUMBER);
      expect(cfg!.notificationSMS).toBe(true);
      expect(cfg!.smsVerified).toBe(false);
      expect(cfg!.smsVerificationCode).toMatch(/^\d{6}$/);
      expect(cfg!.smsVerificationExpiry).toBeInstanceOf(Date);
      expect(cfg!.smsVerificationExpiry.getTime()).toBeGreaterThan(Date.now());
      expect(table("user_configs")).toHaveLength(1);

      const writes = queries().filter((q) =>
        /^(insert into|update) "user_configs"/.test(q.sql)
      );
      expect(writes.length).toBeGreaterThan(0);
      for (const w of writes) expect(w.parameters).toContain(USER_ID);

      // The verification code went out by SMS to the configured number.
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      const sent = mockMessagesCreate.mock.calls[0][0];
      expect(sent.to).toBe(SMS_NUMBER);
      expect(sent.body).toContain(cfg!.smsVerificationCode);
    });

    it("should disable SMS when enabled is false", async () => {
      await configure(true);
      mockMessagesCreate.mockClear();

      const response = await configure(false);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("disabled");
      expect(response.body.verificationSent).toBe(false);

      const cfg = userConfig()!;
      expect(cfg.smsNumber).toBeNull();
      expect(cfg.notificationSMS).toBe(false);
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid phone number", async () => {
      const response = await auth(request(app).post("/api/sms/configure")).send({
        smsNumber: "invalid-number",
        enabled: true,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "Invalid phone number format" }),
        ])
      );
      expect(queries().some((q) => q.sql.includes('"user_configs"'))).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/sms/configure").send({
        smsNumber: SMS_NUMBER,
        enabled: true,
      });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("MISSING_TOKEN");
      expect(queries()).toHaveLength(0);
    });
  });

  describe("POST /api/sms/verify", () => {
    beforeEach(async () => {
      expect((await configure()).status).toBe(200);
    });

    it("should verify SMS code successfully", async () => {
      const code = userConfig()!.smsVerificationCode;

      const response = await auth(request(app).post("/api/sms/verify")).send({ code });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);

      const cfg = userConfig()!;
      expect(cfg.smsVerified).toBe(true);
      expect(cfg.smsVerificationCode).toBeNull();
      expect(cfg.smsVerificationExpiry).toBeNull();
    });

    it("should return error for wrong verification code", async () => {
      const response = await auth(request(app).post("/api/sms/verify")).send({
        code: "000000",
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_CODE");
      expect(userConfig()!.smsVerified).toBe(false);
    });

    it("should return error for expired verification code", async () => {
      const cfg = userConfig()!;
      cfg.smsVerificationExpiry = new Date(Date.now() - 1000);

      // Even the correct code is refused once it has expired.
      const response = await auth(request(app).post("/api/sms/verify")).send({
        code: cfg.smsVerificationCode,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("CODE_EXPIRED");
      expect(userConfig()!.smsVerified).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/sms/verify").send({ code: "123456" });
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/sms/resend-code", () => {
    beforeEach(async () => {
      expect((await configure()).status).toBe(200);
      mockMessagesCreate.mockClear();
    });

    it("should resend verification code successfully", async () => {
      userConfig()!.smsVerificationExpiry = new Date(Date.now() + 1000);

      const response = await auth(request(app).post("/api/sms/resend-code"));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const cfg = userConfig()!;
      expect(cfg.smsVerificationCode).toMatch(/^\d{6}$/);
      expect(cfg.smsVerificationExpiry.getTime()).toBeGreaterThan(Date.now() + 60_000);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate.mock.calls[0][0].to).toBe(SMS_NUMBER);
      expect(mockMessagesCreate.mock.calls[0][0].body).toContain(cfg.smsVerificationCode);
    });

    it("should return error when no SMS number is configured", async () => {
      userConfig()!.smsNumber = null;

      const response = await auth(request(app).post("/api/sms/resend-code"));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("NO_SMS_NUMBER");
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/sms/resend-code");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/sms/status", () => {
    const expectedAccountInfo = {
      accountSid: ACCOUNT_INFO.sid,
      friendlyName: ACCOUNT_INFO.friendlyName,
      status: ACCOUNT_INFO.status,
    };

    it("should return SMS status for unconfigured user", async () => {
      const response = await auth(request(app).get("/api/sms/status"));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: false,
        configured: false,
        verified: false,
        hasPhoneNumber: false,
        phoneNumber: null,
        serviceConfigured: true,
        pendingVerification: false,
        accountInfo: expectedAccountInfo,
      });
    });

    it("should return SMS status for configured but unverified user", async () => {
      await configure();

      const response = await auth(request(app).get("/api/sms/status"));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        configured: false, // Not configured until verified
        verified: false,
        hasPhoneNumber: true,
        phoneNumber: MASKED_NUMBER,
        serviceConfigured: true,
        pendingVerification: true,
        accountInfo: expectedAccountInfo,
      });
    });

    it("should return SMS status for fully configured user", async () => {
      await configureAndVerify();

      const response = await auth(request(app).get("/api/sms/status"));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        configured: true,
        verified: true,
        hasPhoneNumber: true,
        phoneNumber: MASKED_NUMBER,
        serviceConfigured: true,
        pendingVerification: false,
        accountInfo: expectedAccountInfo,
      });
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/sms/status");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/sms/test", () => {
    it("should send test SMS for verified user", async () => {
      await configureAndVerify();
      mockMessagesCreate.mockClear();

      const response = await auth(request(app).post("/api/sms/test"));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationIds).toHaveLength(1);

      const notification = table("notifications").find(
        (n) => n.id === response.body.notificationIds[0]
      );
      expect(notification).toBeDefined();
      expect(notification).toMatchObject({
        userId: USER_ID,
        channel: "sms",
        template: "system_alert",
        status: "sent",
      });
      expect(notification!.message).toContain("Test wiadomości SMS");

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate.mock.calls[0][0].to).toBe(SMS_NUMBER);
      expect(mockMessagesCreate.mock.calls[0][0].body).toContain("Test wiadomości SMS");
    });

    it("should return error for unverified user", async () => {
      await configure();
      mockMessagesCreate.mockClear();

      const response = await auth(request(app).post("/api/sms/test"));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("SMS_NOT_CONFIGURED");
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/sms/test");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/sms/webhook", () => {
    const notificationRow = (id: string, userId: string, messageId: string, status: string): Row => ({
      id,
      userId,
      channel: "sms",
      template: "system_alert",
      subject: "",
      message: "Test message",
      status,
      data: { messageId },
      retryCount: 0,
      error: null,
      sentAt: null,
      scheduledFor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it("should handle delivery status webhook", async () => {
      // Another user's notification sits in the table as well; only the one
      // carrying this MessageSid may be touched.
      table("notifications").push(
        notificationRow("n-other", OTHER_USER_ID, "SM_other", "pending"),
        notificationRow("n-target", USER_ID, "SM_target", "pending")
      );

      const response = await signedWebhook({
        MessageSid: "SM_target",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const lookup = queries().find((q) => /^select .* from "notifications"/.test(q.sql));
      expect(lookup).toBeDefined();
      expect(lookup!.parameters).toContain("SM_target");

      const byId = Object.fromEntries(table("notifications").map((n) => [n.id, n]));
      expect(byId["n-target"].status).toBe("sent"); // delivered -> markAsSent
      expect(byId["n-other"].status).toBe("pending");
    });

    it("should handle webhook for unknown message", async () => {
      table("notifications").push(
        notificationRow("n-other", OTHER_USER_ID, "SM_other", "pending")
      );

      const response = await signedWebhook({
        MessageSid: "SM_unknown",
        MessageStatus: "delivered",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(queries().some((q) => /^update "notifications"/.test(q.sql))).toBe(false);
      expect(table("notifications")[0].status).toBe("pending");
    });

    it("should return error for invalid webhook data", async () => {
      const response = await signedWebhook({ MessageSid: "SM_target" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid webhook data");
      expect(queries()).toHaveLength(0);
    });

    it("should reject an unsigned webhook", async () => {
      const response = await request(app)
        .post("/api/sms/webhook")
        .type("form")
        .send({ MessageSid: "SM_target", MessageStatus: "delivered" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INVALID_TWILIO_SIGNATURE");
      expect(queries()).toHaveLength(0);
    });
  });

  describe("End-to-end SMS workflow", () => {
    it("should complete full SMS configuration and verification workflow", async () => {
      // Step 1: Check initial status
      let response = await auth(request(app).get("/api/sms/status"));
      expect(response.body.enabled).toBe(false);
      expect(response.body.configured).toBe(false);

      // Step 2: Configure SMS
      response = await configure();
      expect(response.status).toBe(200);
      expect(response.body.verificationSent).toBe(true);

      // Step 3: Check status after configuration
      response = await auth(request(app).get("/api/sms/status"));
      expect(response.body.enabled).toBe(true);
      expect(response.body.configured).toBe(false); // Not yet verified
      expect(response.body.pendingVerification).toBe(true);

      // Step 4: Verify SMS
      response = await auth(request(app).post("/api/sms/verify")).send({
        code: userConfig()!.smsVerificationCode,
      });
      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);

      // Step 5: Check final status
      response = await auth(request(app).get("/api/sms/status"));
      expect(response.body.enabled).toBe(true);
      expect(response.body.configured).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.pendingVerification).toBe(false);

      // Step 6: Send test SMS
      response = await auth(request(app).post("/api/sms/test"));
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Step 7: Verification SMS + test SMS were recorded for this user
      const notifications = table("notifications").filter(
        (n) => n.userId === USER_ID && n.channel === "sms"
      );
      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => n.template === "system_alert")).toBe(true);
      expect(notifications[0].message).toContain("kod weryfikacyjny");
      expect(notifications[1].message).toContain("Test wiadomości SMS");
    });
  });
});
