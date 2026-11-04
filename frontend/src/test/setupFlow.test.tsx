import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

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

const setupManager = { isSetupRequired: () => false, isCompleted: false };
vi.mock("@/hooks/setup/useSetupManager", () => ({
  useSetupManager: () => setupManager,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));

import { useSetupStore } from "@/stores/setupStore";
import { systemConfigService } from "@/services/systemConfig";
import { InitializationCheck } from "@/components/setup/InitializationCheck";
import { SystemConfigStep } from "@/components/onboarding/SystemConfigStep";

describe("setup wizard navigation", () => {
  beforeEach(() => useSetupStore.setState({ currentStep: 4, isCompleted: false }));

  it("nextStep moves from System Configuration to the Completion step (index 5)", () => {
    useSetupStore.getState().nextStep();
    expect(useSetupStore.getState().currentStep).toBe(5);
  });

  it("skipStep also reaches the Completion step, and neither goes past it", () => {
    useSetupStore.getState().skipStep();
    expect(useSetupStore.getState().currentStep).toBe(5);
    useSetupStore.getState().nextStep();
    useSetupStore.getState().skipStep();
    expect(useSetupStore.getState().currentStep).toBe(5);
  });
});

describe("completeSetup", () => {
  it("sends the enableEnhanced* keys the config API expects", async () => {
    useSetupStore.getState().updateSetupData({
      systemConfig: {
        ...useSetupStore.getState().setupData.systemConfig,
        enhancedServices: {
          pdf: true,
          email: false,
          routing: true,
          calendar: false,
          aiClassification: true,
        },
      },
    });

    await useSetupStore.getState().completeSetup();

    expect(systemConfigService.updateLLMConfig).toHaveBeenCalledWith({
      enhancedServices: {
        enableEnhancedPDF: true,
        enableEnhancedEmail: false,
        enableEnhancedRouting: true,
        enableEnhancedCalendar: false,
        enableAIClassification: true,
      },
    });
  });
});

describe("InitializationCheck", () => {
  it("renders children without the setup overlay when setup is not required", () => {
    setupManager.isSetupRequired = () => false;
    render(
      <MemoryRouter>
        <InitializationCheck>
          <div>dashboard content</div>
        </InitializationCheck>
      </MemoryRouter>
    );
    expect(screen.getByText("dashboard content")).toBeTruthy();
    expect(screen.queryByText("Welcome to StillOnTime!")).toBeNull();
  });

  it("shows the overlay when setup is required", () => {
    setupManager.isSetupRequired = () => true;
    render(
      <MemoryRouter>
        <InitializationCheck>
          <div>dashboard content</div>
        </InitializationCheck>
      </MemoryRouter>
    );
    expect(screen.getByText("Welcome to StillOnTime!")).toBeTruthy();
  });
});

describe("SystemConfigStep", () => {
  it("loads and renders every feature row (RoutePlanning icon was undefined)", () => {
    const data = useSetupStore.getState().setupData;
    render(
      <SystemConfigStep
        data={data}
        updateData={vi.fn()}
        validation={{ isValid: true, errors: [], warnings: [] }}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSkip={vi.fn()}
        isFirstStep={false}
        isLastStep={false}
        isLoading={false}
      />
    );
    expect(screen.getAllByText("Enhanced Route Planning").length).toBeGreaterThan(0);
  });
});

describe("OnboardingFlow completion", () => {
  it("does not navigate to the dashboard when saving the configuration failed", async () => {
    const { default: OnboardingFlow } = await import("@/pages/Onboarding/OnboardingFlow");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    vi.mocked(systemConfigService.updateMailParsingConfig).mockRejectedValueOnce(new Error("save failed"));
    useSetupStore.setState({ currentStep: 5, isCompleted: false });

    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route path="*" element={<div>dashboard content</div>} />
        </Routes>
      </MemoryRouter>
    );
    const completeBtn = await screen.findByRole("button", { name: /complete|go to dashboard|finish|start/i });
    // Drop calls made by earlier tests so the assertion below proves this click saved.
    vi.mocked(systemConfigService.updateMailParsingConfig).mockClear();
    fireEvent.click(completeBtn);

    await waitFor(() => expect(systemConfigService.updateMailParsingConfig).toHaveBeenCalled());
    // let the failed save settle, then check we were NOT sent to the dashboard
    await new Promise((r) => setTimeout(r, 50));
    expect(useSetupStore.getState().isCompleted).toBe(false);
    expect(screen.queryByText("dashboard content")).toBeNull();
  });
});
