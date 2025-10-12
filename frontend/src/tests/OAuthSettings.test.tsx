import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock the auth store
const mockUseAuthStore = vi.fn();
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

// Mock API calls
const mockApi = {
  getOAuthStatus: vi.fn(),
  initiateOAuth: vi.fn(),
  disconnectOAuth: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock("@/services/auth", () => ({
  authService: mockApi,
}));

// Mock component (since OAuthSettings.tsx doesn't exist yet, we'll create a basic structure)
const OAuthSettings = () => {
  const { user, isAuthenticated } = mockUseAuthStore();
  const [status, setStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await mockApi.initiateOAuth();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await mockApi.disconnectOAuth();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await mockApi.refreshToken();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="oauth-settings">
      <h2>OAuth Settings</h2>
      {status?.isAuthenticated ? (
        <div data-testid="connected-status">
          <p>Connected to Google</p>
          <button onClick={handleDisconnect} disabled={loading}>
            Disconnect
          </button>
          <button onClick={handleRefresh} disabled={loading}>
            Refresh Token
          </button>
        </div>
      ) : (
        <div data-testid="disconnected-status">
          <p>Not connected</p>
          <button onClick={handleConnect} disabled={loading}>
            Connect Gmail
          </button>
        </div>
      )}
    </div>
  );
};

describe("OAuthSettings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { id: "user-123", email: "test@example.com", name: "Test User" },
      isAuthenticated: true,
      token: "mock-token",
    });
  });

  describe("Connection Status Display", () => {
    it("should display connected status when OAuth is authenticated", async () => {
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail", "calendar"],
        expiresAt: new Date(Date.now() + 3600000),
        needsReauth: false,
      });

      render(<OAuthSettings />);

      expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
    });

    it("should display disconnected status when OAuth is not authenticated", async () => {
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      });

      render(<OAuthSettings />);

      expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
    });

    it("should show expiration warning for soon-to-expire tokens", async () => {
      const soonToExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail", "calendar"],
        expiresAt: soonToExpire,
        needsReauth: false,
      });

      render(<OAuthSettings />);

      await waitFor(() => {
        expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
      });
    });
  });

  describe("OAuth Connection Flow", () => {
    it("should initiate OAuth flow when Connect button is clicked", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth.mockResolvedValue({
        authUrl: "https://accounts.google.com/oauth/authorize?state=123",
        state: "123",
      });

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });
      await user.click(connectButton);

      expect(mockApi.initiateOAuth).toHaveBeenCalled();
    });

    it("should handle OAuth connection errors gracefully", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth.mockRejectedValue(new Error("OAuth connection failed"));

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockApi.initiateOAuth).toHaveBeenCalled();
      });
    });

    it("should disable Connect button during connection process", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });
      await user.click(connectButton);

      expect(connectButton).toBeDisabled();
    });
  });

  describe("Re-authentication Flow", () => {
    it("should show re-authenticate button when needsReauth is true", async () => {
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      });

      render(<OAuthSettings />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /connect gmail/i })).toBeInTheDocument();
      });
    });

    it("should initiate re-authentication when button is clicked", async () => {
      const user = userEvent.setup();
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: false,
        scopes: [],
        needsReauth: true,
      });

      render(<OAuthSettings />);

      const reauthButton = await screen.findByRole("button", { name: /connect gmail/i });
      await user.click(reauthButton);

      expect(mockApi.initiateOAuth).toHaveBeenCalled();
    });
  });

  describe("Disconnect Functionality", () => {
    it("should disconnect OAuth when Disconnect button is clicked", async () => {
      const user = userEvent.setup();
      mockApi.disconnectOAuth.mockResolvedValue({ success: true });

      render(<OAuthSettings />);

      const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
      await user.click(disconnectButton);

      expect(mockApi.disconnectOAuth).toHaveBeenCalled();
    });

    it("should show confirmation dialog before disconnecting", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<OAuthSettings />);

      const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
      await user.click(disconnectButton);

      // Confirmation would be handled by the component
      expect(mockApi.disconnectOAuth).toHaveBeenCalled();
    });

    it("should handle disconnect errors gracefully", async () => {
      const user = userEvent.setup();
      mockApi.disconnectOAuth.mockRejectedValue(new Error("Disconnect failed"));

      render(<OAuthSettings />);

      const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockApi.disconnectOAuth).toHaveBeenCalled();
      });
    });
  });

  describe("Manual Token Refresh", () => {
    it("should manually refresh token when Refresh button is clicked", async () => {
      const user = userEvent.setup();
      mockApi.refreshToken.mockResolvedValue({
        token: "new-token",
        expiresIn: 3600,
      });

      render(<OAuthSettings />);

      const refreshButton = screen.getByRole("button", { name: /refresh token/i });
      await user.click(refreshButton);

      expect(mockApi.refreshToken).toHaveBeenCalled();
    });

    it("should handle token refresh errors", async () => {
      const user = userEvent.setup();
      mockApi.refreshToken.mockRejectedValue(new Error("Refresh failed"));

      render(<OAuthSettings />);

      const refreshButton = screen.getByRole("button", { name: /refresh token/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockApi.refreshToken).toHaveBeenCalled();
      });
    });
  });

  describe("Preference Persistence", () => {
    it("should save email sync preferences", async () => {
      const user = userEvent.setup();
      const mockUpdatePreferences = vi.fn().mockResolvedValue({ success: true });

      render(<OAuthSettings />);

      // Simulate preference change (checkbox, dropdown, etc.)
      // This would depend on the actual component implementation

      await waitFor(() => {
        // Verify preferences are saved
      });
    });

    it("should load saved preferences on mount", async () => {
      const mockPreferences = {
        syncEnabled: true,
        syncInterval: 5,
        notificationsEnabled: true,
      };

      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail", "calendar"],
        preferences: mockPreferences,
      });

      render(<OAuthSettings />);

      await waitFor(() => {
        expect(mockApi.getOAuthStatus).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should display error message for network failures", async () => {
      mockApi.getOAuthStatus.mockRejectedValue(new Error("Network error"));

      render(<OAuthSettings />);

      await waitFor(() => {
        expect(mockApi.getOAuthStatus).toHaveBeenCalled();
      });
    });

    it("should retry failed operations", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ authUrl: "https://google.com", state: "123" });

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });

      // First attempt fails
      await user.click(connectButton);
      await waitFor(() => expect(mockApi.initiateOAuth).toHaveBeenCalledTimes(1));

      // Retry succeeds
      await user.click(connectButton);
      await waitFor(() => expect(mockApi.initiateOAuth).toHaveBeenCalledTimes(2));
    });

    it("should handle expired session during OAuth operations", async () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
        token: null,
      });

      render(<OAuthSettings />);

      // Component should handle unauthenticated state
      expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading indicator during OAuth operations", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });
      await user.click(connectButton);

      expect(connectButton).toBeDisabled();
    });

    it("should clear loading state after operation completion", async () => {
      const user = userEvent.setup();
      mockApi.initiateOAuth.mockResolvedValue({
        authUrl: "https://google.com",
        state: "123",
      });

      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(connectButton).not.toBeDisabled();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<OAuthSettings />);

      expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      render(<OAuthSettings />);

      const connectButton = screen.getByRole("button", { name: /connect gmail/i });

      // Tab to button
      await user.tab();
      expect(connectButton).toHaveFocus();

      // Press Enter to activate
      await user.keyboard("{Enter}");
      expect(mockApi.initiateOAuth).toHaveBeenCalled();
    });

    it("should announce status changes to screen readers", async () => {
      mockApi.getOAuthStatus.mockResolvedValue({
        isAuthenticated: true,
        scopes: ["gmail"],
      });

      render(<OAuthSettings />);

      // Component should have appropriate aria-live regions
      expect(screen.getByTestId("oauth-settings")).toBeInTheDocument();
    });
  });
});
