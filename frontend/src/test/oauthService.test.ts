/**
 * apiService.get/post/put return the response BODY (T), not an axios response.
 * oauth.service.ts used `response.data` on top of that, so every call threw
 * "Cannot read properties of undefined" (or silently returned undefined).
 * The mock below mirrors the real contract: resolve with the body itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { api } from "../services/api";
import { oauthService } from "../services/oauth.service";

const mocked = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("oauthService unwraps the body returned by apiService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getStatus converts date strings and returns the status", async () => {
    mocked.get.mockResolvedValue({
      success: true,
      status: {
        connected: true,
        accountEmail: "a@example.invalid",
        accountName: "A",
        scopes: ["gmail"],
        tokenExpiry: "2030-01-01T00:00:00.000Z",
        lastSync: null,
        needsReauth: false,
      },
    });
    const status = await oauthService.getStatus();
    expect(status.connected).toBe(true);
    expect(status.tokenExpiry).toBeInstanceOf(Date);
    expect(status.lastSync).toBeNull();
  });

  it("refreshToken returns expiresAt as a Date", async () => {
    mocked.post.mockResolvedValue({
      success: true,
      message: "ok",
      expiresIn: 3600,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    const res = await oauthService.refreshToken();
    expect(res.expiresAt).toBeInstanceOf(Date);
    expect(res.expiresIn).toBe(3600);
  });

  it("disconnect, reconnect and testConnection return the body", async () => {
    mocked.post.mockResolvedValue({ success: true, message: "bye" });
    expect((await oauthService.disconnect()).message).toBe("bye");

    mocked.get.mockResolvedValue({ success: true, authUrl: "https://x", state: "s", message: "m" });
    expect((await oauthService.reconnect()).authUrl).toBe("https://x");

    mocked.get.mockResolvedValue({ success: true, connected: true, message: "fine" });
    expect((await oauthService.testConnection()).connected).toBe(true);
  });

  it("getGmailFolders and getCalendars return the arrays", async () => {
    mocked.get.mockResolvedValueOnce({ folders: ["INBOX"] });
    expect(await oauthService.getGmailFolders()).toEqual(["INBOX"]);
    mocked.get.mockResolvedValueOnce({ calendars: [{ id: "1", name: "Main" }] });
    expect(await oauthService.getCalendars()).toEqual([{ id: "1", name: "Main" }]);
  });
});
