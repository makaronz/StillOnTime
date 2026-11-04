import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/services/systemConfig", () => ({
  systemConfigService: {
    updateMailParsingConfig: vi.fn().mockResolvedValue({}),
    updateLLMConfig: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));

import { useSetupStore } from "@/stores/setupStore";
import { useSetupManager } from "@/hooks/setup/useSetupManager";

describe("useSetupManager.isSetupRequired", () => {
  beforeEach(() => useSetupStore.setState({ currentStep: 0, isCompleted: false }));

  it("stays required on the Completion step until the setup is actually saved", () => {
    useSetupStore.setState({ currentStep: 5, isCompleted: false });
    const { result } = renderHook(() => useSetupManager());
    expect(result.current.isSetupRequired()).toBe(true);
  });

  it("is not required once setup is completed", () => {
    useSetupStore.setState({ currentStep: 5, isCompleted: true });
    const { result } = renderHook(() => useSetupManager());
    expect(result.current.isSetupRequired()).toBe(false);
  });
});
