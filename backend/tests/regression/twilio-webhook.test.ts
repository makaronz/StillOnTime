/**
 * BUG-005: POST /api/sms/webhook was public and unauthenticated. Anyone could
 * forge Twilio delivery callbacks and flip notification statuses. Twilio
 * signs callbacks (X-Twilio-Signature); the handler must verify it.
 */
import express from "express";
import request from "supertest";
import twilio from "twilio";
import { requireTwilioSignature } from "@/middleware/twilio-signature";
import smsRoutes from "@/routes/sms.routes";

const AUTH_TOKEN = "unit-test-twilio-token-00000000";
const WEBHOOK_URL = "https://hooks.example.invalid/api/sms/webhook";
const FORM = { MessageSid: "SM123", MessageStatus: "delivered" };

function stubApp(): express.Application {
  const a = express();
  a.use(express.urlencoded({ extended: true }));
  a.post("/api/sms/webhook", requireTwilioSignature, (_req, res) =>
    res.json({ reached: true })
  );
  return a;
}

describe("requireTwilioSignature", () => {
  const saved = { token: process.env.TWILIO_AUTH_TOKEN, url: process.env.TWILIO_WEBHOOK_URL };

  afterEach(() => {
    if (saved.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = saved.token;
    if (saved.url === undefined) delete process.env.TWILIO_WEBHOOK_URL;
    else process.env.TWILIO_WEBHOOK_URL = saved.url;
  });

  it("fails closed (503) when no Twilio auth token is configured", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const res = await request(stubApp()).post("/api/sms/webhook").type("form").send(FORM);
    expect(res.status).toBe(503);
  });

  describe("with a configured token", () => {
    beforeEach(() => {
      process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
      process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL;
    });

    it("403 when the signature header is missing", async () => {
      const res = await request(stubApp()).post("/api/sms/webhook").type("form").send(FORM);
      expect(res.status).toBe(403);
    });

    it("403 when the signature is wrong", async () => {
      const res = await request(stubApp())
        .post("/api/sms/webhook")
        .set("X-Twilio-Signature", "AAAAAAAAAAAAAAAAAAAAAAAAAAA=")
        .type("form")
        .send(FORM);
      expect(res.status).toBe(403);
    });

    it("403 when the body was tampered with after signing", async () => {
      const sig = twilio.getExpectedTwilioSignature(AUTH_TOKEN, WEBHOOK_URL, FORM);
      const res = await request(stubApp())
        .post("/api/sms/webhook")
        .set("X-Twilio-Signature", sig)
        .type("form")
        .send({ ...FORM, MessageStatus: "failed" });
      expect(res.status).toBe(403);
    });

    it("passes through with a valid signature", async () => {
      const sig = twilio.getExpectedTwilioSignature(AUTH_TOKEN, WEBHOOK_URL, FORM);
      const res = await request(stubApp())
        .post("/api/sms/webhook")
        .set("X-Twilio-Signature", sig)
        .type("form")
        .send(FORM);
      expect(res.status).toBe(200);
      expect(res.body.reached).toBe(true);
    });

    it("is wired into the real /webhook route (unsigned -> 403)", async () => {
      const a = express();
      a.use(express.urlencoded({ extended: true }));
      a.use("/api/sms", smsRoutes);
      const res = await request(a).post("/api/sms/webhook").type("form").send(FORM);
      expect(res.status).toBe(403);
    });
  });
});
