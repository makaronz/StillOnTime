/**
 * BUG-047  Mounting /api/monitoring (BUG-002) exposed state-changing
 *          operations to every logged-in user: resetting circuit breakers,
 *          rewriting alerting rules, resolving alerts, recording custom
 *          metrics and (outside production) firing test alerts.
 *
 * Fix: those routes require the caller's e-mail to be listed in ADMIN_EMAILS
 * (comma-separated, case-insensitive). If ADMIN_EMAILS is unset or empty they
 * fail closed with 403. Read-only monitoring routes stay available to any
 * authenticated user.
 *
 * Runs against the real route graph; nothing touches live infrastructure
 * (circuit breakers and alerts are in-memory registries).
 */
import express from "express";
import request from "supertest";
import { apiRoutes } from "@/routes";
import { services } from "@/services";

const ADMIN = "Ops.Admin@Example.invalid";
const USER = "crew.member@example.invalid";

function app(): express.Application {
  const a = express();
  a.use(express.json());
  a.use("/api", apiRoutes);
  return a;
}

function tokenFor(email: string): string {
  return services.oauth2.generateJWT({
    id: "11111111-1111-4111-8111-111111111111",
    email,
  } as any);
}

const mutatingCalls: Array<[string, string]> = [
  ["post", "/api/monitoring/circuit-breakers/reset"],
  ["put", "/api/monitoring/alerts/rules/some-rule"],
  ["post", "/api/monitoring/alerts/some-alert/resolve"],
  ["post", "/api/monitoring/metrics/custom"],
  ["post", "/api/monitoring/test/alert"],
];

describe("BUG-047 monitoring mutations are admin-only", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  describe("with ADMIN_EMAILS configured", () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = ` other@example.invalid , ${ADMIN.toLowerCase()} `;
    });

    it.each(mutatingCalls)("%s %s as a non-admin -> 403 ADMIN_REQUIRED", async (method, url) => {
      const res = await (request(app()) as any)[method](url)
        .set("Authorization", `Bearer ${tokenFor(USER)}`)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ADMIN_REQUIRED");
    });

    it.each(mutatingCalls)("%s %s without a token -> 401", async (method, url) => {
      const res = await (request(app()) as any)[method](url).send({});
      expect(res.status).toBe(401);
    });

    it("lets an admin through (matched case-insensitively)", async () => {
      const res = await request(app())
        .post("/api/monitoring/alerts/no-such-alert/resolve")
        .set("Authorization", `Bearer ${tokenFor(ADMIN)}`)
        .send({});
      // Reaches the controller: unknown alert, not a permission error.
      expect(res.status).toBe(404);
    });

    it("lets an admin reset circuit breakers", async () => {
      const res = await request(app())
        .post("/api/monitoring/circuit-breakers/reset")
        .set("Authorization", `Bearer ${tokenFor(ADMIN)}`)
        .send({ serviceName: "no-such-service" });
      expect(res.status).toBe(404);
    });

    it("keeps read-only routes open to any authenticated user", async () => {
      const res = await request(app())
        .get("/api/monitoring/circuit-breakers")
        .set("Authorization", `Bearer ${tokenFor(USER)}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("fails closed when ADMIN_EMAILS is not configured", () => {
    it.each(["", "  ,  ", undefined])("ADMIN_EMAILS=%p -> 403 for everyone", async (value) => {
      if (value === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = value;

      const res = await request(app())
        .post("/api/monitoring/circuit-breakers/reset")
        .set("Authorization", `Bearer ${tokenFor(ADMIN)}`)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ADMIN_NOT_CONFIGURED");
    });
  });
});
