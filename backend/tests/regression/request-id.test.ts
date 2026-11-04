/**
 * BUG-006: structuredLogger kept the request id in one process-wide field.
 * Under concurrent requests, request B overwrote A's id mid-flight (and any
 * request finishing called clearRequestId() for all), so logs were attributed
 * to the wrong request.
 * BUG-007: a client-supplied X-Request-ID was copied verbatim into logs and
 * response headers (log injection / unbounded size).
 */
import { StructuredLogger } from "@/utils/logger";
import { resolveRequestId } from "@/utils/request-id";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
// Each simulated request starts in its own async context, like Node's HTTP server does.
const asRequest = <T>(fn: () => Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => setImmediate(() => fn().then(resolve, reject)));

describe("StructuredLogger request id isolation", () => {
  it("keeps each concurrent request's id separate", async () => {
    const log = StructuredLogger.getInstance();

    const a = asRequest(async () => {
      log.setRequestId("req-A");
      await sleep(30);
      return log.getRequestId();
    });
    const b = asRequest(async () => {
      await sleep(5);
      log.setRequestId("req-B");
      await sleep(40);
      return log.getRequestId();
    });

    expect(await a).toBe("req-A");
    expect(await b).toBe("req-B");
  });

  it("clearRequestId in one request does not wipe another's id", async () => {
    const log = StructuredLogger.getInstance();

    const a = asRequest(async () => {
      log.setRequestId("req-A");
      await sleep(30);
      return log.getRequestId();
    });
    const b = asRequest(async () => {
      log.setRequestId("req-B");
      await sleep(5);
      log.clearRequestId();
      return log.getRequestId();
    });

    expect(await b).toBeNull();
    expect(await a).toBe("req-A");
  });
});

describe("resolveRequestId", () => {
  it("keeps a well-formed id", () => {
    expect(resolveRequestId("req_1700000000_ab12cd34e")).toBe("req_1700000000_ab12cd34e");
  });

  it.each([
    ["newline injection", "abc\nINFO forged log line"],
    ["spaces", "a b"],
    ["too long", "x".repeat(65)],
    ["empty", ""],
    ["undefined", undefined],
    ["non-string", ["a", "b"]],
  ])("replaces %s with a generated id", (_name, value) => {
    const id = resolveRequestId(value);
    expect(id).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
    expect(id).not.toBe(value);
  });
});
