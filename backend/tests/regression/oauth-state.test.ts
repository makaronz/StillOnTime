/**
 * BUG-008: login CSRF. POST /api/auth/callback only checked that `state` was a
 * string of >= 16 chars, so any value passed. An attacker could finish OAuth
 * with their own Google account and feed the victim's browser the resulting
 * code. State must be a value the server issued (signed, time-limited).
 * Also: GET /auth/login must not accept a caller-chosen state.
 */
import express from "express";
import request from "supertest";
import { issueOAuthState, verifyOAuthState } from "@/utils/oauth-state";
import { authRoutes } from "@/routes/auth.routes";
import { services } from "@/services";

describe("oauth-state util", () => {
  it("round-trips an issued state", () => {
    expect(verifyOAuthState(issueOAuthState())).toBe(true);
  });

  it("issues unique states", () => {
    expect(issueOAuthState()).not.toBe(issueOAuthState());
  });

  it.each([
    ["empty", ""],
    ["random 32 chars", "a".repeat(32)],
    ["non-string", 12345 as any],
    ["undefined", undefined as any],
  ])("rejects %s", (_n, value) => {
    expect(verifyOAuthState(value)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const s = issueOAuthState();
    const tampered = s.slice(0, -1) + (s.endsWith("0") ? "1" : "0");
    expect(verifyOAuthState(tampered)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const [nonce, , sig] = issueOAuthState().split(".");
    expect(verifyOAuthState(`${nonce}.${Date.now() + 10 * 365 * 24 * 3600 * 1000}.${sig}`)).toBe(false);
  });

  it("rejects an expired state", () => {
    const realNow = Date.now;
    try {
      const s = issueOAuthState();
      Date.now = () => realNow() + 11 * 60 * 1000; // TTL is 10 min
      expect(verifyOAuthState(s)).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});

describe("/api/auth OAuth endpoints", () => {
  function app(): express.Application {
    const a = express();
    a.use(express.json());
    a.use("/api/auth", authRoutes);
    return a;
  }

  it("callback rejects a state the server never issued", async () => {
    const res = await request(app())
      .post("/api/auth/callback")
      .send({ code: "4/0AbCdEfGh", state: "x".repeat(40) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_STATE");
  });

  it("callback accepts an issued state (proceeds to the code exchange)", async () => {
    const spy = jest
      .spyOn(services.oauth2, "exchangeCodeForTokens")
      .mockRejectedValue(new Error("exchange stubbed"));
    try {
      const res = await request(app())
        .post("/api/auth/callback")
        .send({ code: "4/0AbCdEfGh", state: issueOAuthState() });
      expect(res.body.code).not.toBe("INVALID_STATE");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("login ignores a caller-supplied state", async () => {
    const res = await request(app()).get("/api/auth/login").query({ state: "attacker-chosen-state-value-0000" });
    expect(res.status).toBe(200);
    expect(res.body.state).not.toBe("attacker-chosen-state-value-0000");
    expect(verifyOAuthState(res.body.state)).toBe(true);
  });
});

describe("other flows that mint a state", () => {
  it("getAuthUrl() with no argument (reconnect) yields a state the callback accepts", async () => {
    const { state } = await services.oauth2.getAuthUrl();
    expect(verifyOAuthState(state)).toBe(true);
  });

  it("requireValidOAuth 403 carries authUrl as a string, not the {authUrl,state} object", async () => {
    const { requireValidOAuth } = await import("@/middleware/auth.middleware");
    // googleapis is auto-mocked in tests/setup.ts, so stub the URL builder.
    const urlSpy = jest
      .spyOn(services.oauth2, "getAuthUrl")
      .mockResolvedValue({ authUrl: "https://accounts.google.com/o/oauth2/auth?x=1", state: "s" });
    const spy = jest
      .spyOn(services.oauth2, "getOAuthStatus")
      .mockResolvedValue({ isAuthenticated: false, needsReauth: false } as any);
    let status = 0;
    let body: any;
    const res: any = {
      status(c: number) { status = c; return this; },
      json(b: any) { body = b; return this; },
    };
    try {
      await requireValidOAuth({ user: { userId: "u" }, path: "/x" }, res, jest.fn());
    } finally {
      spy.mockRestore();
      urlSpy.mockRestore();
    }
    expect(status).toBe(403);
    expect(typeof body.authUrl).toBe("string");
    expect(body.authUrl).toMatch(/^https:\/\/accounts\.google\.com\//);
  });
});
