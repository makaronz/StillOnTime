/**
 * config.apiBaseUrl already ends in "/api" (default http://localhost:3001/api,
 * same in .env.example), but systemConfigService appended "/api/config", so it
 * called /api/api/config/... and every config save 404'd. The onboarding wizard
 * only leaves after a successful save, so it got stuck.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios", () => {
  const fn = vi.fn().mockResolvedValue({ data: { success: true } });
  return { default: { get: fn, post: fn, put: fn } };
});

import axios from "axios";
import { config } from "@/config/config";
import { systemConfigService } from "@/services/systemConfig";

describe("systemConfigService URLs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls <apiBaseUrl>/config/... without a duplicated /api segment", async () => {
    await systemConfigService.updateMailParsingConfig({});
    await systemConfigService.getSystemStatus();

    const urls = [
      ...vi.mocked(axios.put).mock.calls,
      ...vi.mocked(axios.get).mock.calls,
    ].map((c) => String(c[0]));

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toContain("/api/api/");
      expect(url.startsWith(`${config.apiBaseUrl}/config/`)).toBe(true);
    }
  });
});
