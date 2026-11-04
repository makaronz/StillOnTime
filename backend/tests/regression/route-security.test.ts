/**
 * Route-level security regressions (run against the real route graph).
 *
 * BUG-002  /api/monitoring/* is never mounted (initializeMonitoringRoutes is
 *          defined but never called) -> every frontend call 404s.
 * BUG-003  /api/codenet/* has no authentication, including POST /generate
 *          (spends LLM quota) and POST /initialize (mutates Qdrant).
 * BUG-004  /api/enhanced/* trusts a userId supplied in the URL/body (IDOR):
 *          any logged-in user can run another user's Gmail monitoring.
 */
import express from "express";
import request from "supertest";
import { apiRoutes } from "@/routes";
import { services } from "@/services";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function app(): express.Application {
  const a = express();
  a.use(express.json());
  a.use("/api", apiRoutes);
  return a;
}

function tokenFor(id: string): string {
  return services.oauth2.generateJWT({ id, email: `${id}@example.invalid` } as any);
}

describe("BUG-002 monitoring routes are mounted", () => {
  it("protects /api/monitoring/dashboard with auth (401, not 404)", async () => {
    const res = await request(app()).get("/api/monitoring/dashboard");
    expect(res.status).toBe(401);
  });
});

describe("BUG-003 codenet requires authentication", () => {
  const protectedCalls: Array<[string, string]> = [
    ["get", "/api/codenet/search?query=x"],
    ["post", "/api/codenet/generate"],
    ["get", "/api/codenet/patterns?codeContext=x"],
    ["get", "/api/codenet/stats"],
    ["post", "/api/codenet/initialize"],
  ];

  it.each(protectedCalls)("%s %s without a token -> 401", async (method, url) => {
    const res = await (request(app()) as any)[method](url).send({});
    expect(res.status).toBe(401);
  });

  it("keeps the health probe public", async () => {
    const res = await request(app()).get("/api/codenet/health");
    expect(res.status).not.toBe(401);
  });
});

describe("BUG-004 enhanced routes cannot act for another user", () => {
  it("403 when :userId in the path is not the caller", async () => {
    const res = await request(app())
      .post(`/api/enhanced/emails/${USER_B}/monitor`)
      .set("Authorization", `Bearer ${tokenFor(USER_A)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("403 when body.userId is not the caller (checked before validation)", async () => {
    const res = await request(app())
      .post("/api/enhanced/routes/calculate")
      .set("Authorization", `Bearer ${tokenFor(USER_A)}`)
      .send({ userId: USER_B });
    expect(res.status).toBe(403);
  });

  it("does not block the caller acting on their own id", async () => {
    const res = await request(app())
      .post(`/api/enhanced/emails/${USER_A}/monitor`)
      .set("Authorization", `Bearer ${tokenFor(USER_A)}`)
      .send({});
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it("401 without a token", async () => {
    const res = await request(app()).post(`/api/enhanced/emails/${USER_A}/monitor`).send({});
    expect(res.status).toBe(401);
  });
});
