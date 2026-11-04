import { randomUUID } from "crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Returns the client-supplied request id only when it is short and made of
 * safe characters; otherwise generates a fresh one. Prevents log injection
 * (newlines) and unbounded values via the X-Request-ID header.
 */
export function resolveRequestId(headerValue: unknown): string {
  if (typeof headerValue === "string" && SAFE_REQUEST_ID.test(headerValue)) {
    return headerValue;
  }
  return `req_${randomUUID()}`;
}
