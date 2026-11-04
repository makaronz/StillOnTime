import { Response, NextFunction } from "express";
import twilio from "twilio";
import { logger } from "@/utils/logger";

/**
 * Verifies the X-Twilio-Signature header on Twilio webhook callbacks.
 *
 * The signature is an HMAC of the exact public URL Twilio called plus the
 * sorted POST parameters, keyed with the account auth token. Behind a proxy
 * the URL the app sees differs from the public one, so set
 * TWILIO_WEBHOOK_URL to the full public URL of the webhook in that case.
 *
 * Fails closed: without TWILIO_AUTH_TOKEN the endpoint is disabled (503)
 * rather than open.
 */
export const requireTwilioSignature = (
  req: any,
  res: Response,
  next: NextFunction
): void => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    logger.warn("Twilio webhook rejected: TWILIO_AUTH_TOKEN not configured", {
      path: req.path,
    });
    res.status(503).json({
      error: "Service Unavailable",
      message: "SMS webhook is not configured",
      code: "TWILIO_NOT_CONFIGURED",
    });
    return;
  }

  const signature = req.get("X-Twilio-Signature");
  const url =
    process.env.TWILIO_WEBHOOK_URL ||
    `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const valid =
    typeof signature === "string" &&
    signature.length > 0 &&
    twilio.validateRequest(authToken, signature, url, req.body || {});

  if (!valid) {
    logger.warn("Twilio webhook rejected: invalid signature", {
      path: req.path,
      ip: req.ip,
    });
    res.status(403).json({
      error: "Forbidden",
      message: "Invalid Twilio signature",
      code: "INVALID_TWILIO_SIGNATURE",
    });
    return;
  }

  next();
};
