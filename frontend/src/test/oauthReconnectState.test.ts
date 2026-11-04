import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/oauth.service", () => ({
  oauthService: {
    reconnect: vi.fn(),
  },
}));

import { oauthService } from "../services/oauth.service";
import { useOAuthStore } from "../stores/oauthStore";
import { validateState } from "@/utils/oauth";

describe("reconnect flow stores the OAuth state it was issued", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("saves state so the callback's fail-closed validateState accepts it", async () => {
    (oauthService.reconnect as any).mockResolvedValue({
      success: true,
      authUrl: "https://accounts.google.com/o/oauth2/auth?x=1",
      state: "issued-state-value-1234567890",
      message: "ok",
    });

    const url = await useOAuthStore.getState().reconnectAccount();

    expect(url).toContain("accounts.google.com");
    const stored = sessionStorage.getItem("oauth_state");
    expect(stored).toBe("issued-state-value-1234567890");
    expect(validateState("issued-state-value-1234567890", stored)).toBe(true);
  });
});
