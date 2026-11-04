import crypto from "crypto";
import { config } from "@/config/config";

/**
 * Stateless, server-issued OAuth `state` values.
 *
 * Format: `<nonce hex>.<expiry ms>.<hmac hex>`; the HMAC covers nonce+expiry.
 * It proves the value was minted by this server recently. It does not by
 * itself bind the flow to one browser - the frontend additionally compares it
 * with the value it stored in sessionStorage before calling the callback.
 */
const TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", `${config.jwtSecret}:oauth-state`)
    .update(payload)
    .digest("hex");
}

export function issueOAuthState(): string {
  const payload = `${crypto.randomBytes(16).toString("hex")}.${Date.now() + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: unknown): boolean {
  if (typeof state !== "string" || state.length > 256) return false;

  const parts = state.split(".");
  if (parts.length !== 3) return false;

  const [nonce, expiry, signature] = parts;
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^\d{1,16}$/.test(expiry)) return false;

  const expected = Buffer.from(sign(`${nonce}.${expiry}`), "hex");
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(provided, expected)) return false;

  return Number(expiry) > Date.now();
}
