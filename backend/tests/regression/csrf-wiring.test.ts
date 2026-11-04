/**
 * BUG-001: CSRF protection is unusable in production.
 *  - csurf runs in cookie mode but cookie-parser is never mounted, so every
 *    state-changing request and GET /api/csrf-token fail with
 *    500 "misconfigured csrf".
 *  - CORS does not allow the X-CSRF-Token header the frontend sends, so the
 *    cross-origin preflight is rejected.
 *  - POST /api/sms/webhook (Twilio server-to-server) cannot carry a CSRF
 *    token, so it would always be blocked in production.
 */
import express from "express";
import request from "supertest";
import { installCsrf, shouldSkipCsrf } from "@/middleware/csrf-wiring";
import { corsConfig } from "@/config/security";
import { errorHandler } from "@/middleware/errorHandler";

function buildApp(nodeEnv: string): express.Application {
  const app = express();
  app.use(express.json());
  installCsrf(app, { nodeEnv });
  app.post("/api/things", (_req, res) => res.json({ ok: true }));
  app.post("/api/sms/webhook", (_req, res) => res.json({ reached: true }));
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(err.status || 500).json({ code: err.code, message: err.message });
    }
  );
  return app;
}

describe("CSRF wiring (production mode)", () => {
  it("issues a token from GET /api/csrf-token instead of 500", async () => {
    const res = await request(buildApp("production")).get("/api/csrf-token");
    expect(res.status).toBe(200);
    expect(typeof res.body.csrfToken).toBe("string");
    expect(res.body.csrfToken.length).toBeGreaterThan(10);
  });

  it("rejects a state-changing request without a token with 403, not 500", async () => {
    const res = await request(buildApp("production")).post("/api/things").send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EBADCSRFTOKEN");
  });

  it("accepts a state-changing request that carries the issued token", async () => {
    const app = buildApp("production");
    const tokenRes = await request(app).get("/api/csrf-token");
    // Production cookies are `Secure`; supertest talks plain HTTP, so a cookie
    // jar would drop it. Replay the secret cookie by hand (what a browser does
    // over HTTPS).
    const setCookie = ([] as string[]).concat(
      (tokenRes.headers["set-cookie"] as unknown as string[]) || []
    );
    const secretCookie = setCookie.find((c) => c.startsWith("_csrf="));
    expect(secretCookie).toBeDefined();

    const res = await request(app)
      .post("/api/things")
      .set("Cookie", secretCookie!.split(";")[0])
      .set("X-CSRF-Token", tokenRes.body.csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("lets the Twilio webhook through (it is authenticated by signature instead)", async () => {
    const res = await request(buildApp("production")).post("/api/sms/webhook").send({});
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});

describe("shouldSkipCsrf", () => {
  const req = (method: string, path: string) => ({ method, path });

  it("skips safe methods, health checks and the OAuth callback", () => {
    expect(shouldSkipCsrf(req("GET", "/api/anything"), "production")).toBe(true);
    expect(shouldSkipCsrf(req("POST", "/health"), "production")).toBe(true);
    expect(shouldSkipCsrf(req("POST", "/health/live"), "production")).toBe(true);
    expect(shouldSkipCsrf(req("POST", "/api/auth/callback"), "production")).toBe(true);
  });

  it("does not skip state-changing /api calls in production", () => {
    expect(shouldSkipCsrf(req("POST", "/api/things"), "production")).toBe(false);
    expect(shouldSkipCsrf(req("DELETE", "/api/emails/1"), "production")).toBe(false);
  });

  it("only skips arbitrary /api calls in development", () => {
    expect(shouldSkipCsrf(req("POST", "/api/things"), "development")).toBe(true);
    expect(shouldSkipCsrf(req("POST", "/other"), "development")).toBe(false);
  });

  it("does not let a lookalike path bypass the webhook exemption", () => {
    expect(shouldSkipCsrf(req("POST", "/api/sms/webhook/../configure"), "production")).toBe(false);
    expect(shouldSkipCsrf(req("POST", "/api/sms/webhook-evil"), "production")).toBe(false);
  });
});

describe("CORS config", () => {
  it("allows the CSRF header the frontend sends", () => {
    const allowed = corsConfig.allowedHeaders.map((h) => h.toLowerCase());
    expect(allowed).toContain("x-csrf-token");
  });
});

describe("CSRF failures through the production error handler", () => {
  it("maps a rejected token to 403 INVALID_CSRF_TOKEN, not 500", async () => {
    const app = express();
    app.use(express.json());
    installCsrf(app, { nodeEnv: "production" });
    app.post("/api/things", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler as any);

    const res = await request(app).post("/api/things").send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_CSRF_TOKEN");
  });
});
