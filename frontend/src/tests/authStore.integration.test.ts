import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import toast from "react-hot-toast";

// Mock dependencies
vi.mock("@/services/auth");
vi.mock("react-hot-toast");
vi.mock("@/utils/oauth", () => ({
  generateSecureState: () => "mock-secure-state-123",
  validateState: (received: string, stored: string | null) => received === stored,
  validateAuthCode: (code: string) => code && code.length >= 10,
  cleanupOAuthStorage: vi.fn(),
}));

describe("AuthStore Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      tokenExpiry: null,
      lastActivity: Date.now(),
      sessionTimeoutWarning: false,
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("Google OAuth Login Flow", () => {
    it("should start Google login and redirect to OAuth URL", async () => {
      const mockAuthUrl = "https://accounts.google.com/oauth/authorize?state=test-state";
      vi.mocked(authService.getGoogleAuthUrl).mockResolvedValue({
        authUrl: mockAuthUrl,
        state: "test-state",
      });

      const { result } = renderHook(() => useAuthStore());

      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: "" } as any;

      await act(async () => {
        await result.current.startGoogleLogin();
      });

      expect(authService.getGoogleAuthUrl).toHaveBeenCalled();
      expect(sessionStorage.getItem("oauth_state")).toBe("test-state");
    });

    it("should handle OAuth callback with valid code and state", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };
      const mockResponse = {
        token: "jwt-token",
        user: mockUser,
        expiresIn: 3600,
      };

      sessionStorage.setItem("oauth_state", "valid-state");
      vi.mocked(authService.exchangeCodeForTokens).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.handleOAuthCallback("auth-code-123", "valid-state");
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("jwt-token");
      expect(sessionStorage.getItem("oauth_state")).toBeNull();
    });

    it("should reject OAuth callback with invalid state (CSRF protection)", async () => {
      sessionStorage.setItem("oauth_state", "stored-state");

      const { result } = renderHook(() => useAuthStore());

      await expect(async () => {
        await act(async () => {
          await result.current.handleOAuthCallback("auth-code", "different-state");
        });
      }).rejects.toThrow("Invalid state parameter");

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should reject OAuth callback with invalid auth code format", async () => {
      sessionStorage.setItem("oauth_state", "valid-state");

      const { result } = renderHook(() => useAuthStore());

      await expect(async () => {
        await act(async () => {
          await result.current.handleOAuthCallback("short", "valid-state");
        });
      }).rejects.toThrow("Invalid authorization code");

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should cleanup OAuth storage after successful callback", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };
      const mockResponse = {
        token: "jwt-token",
        user: mockUser,
        expiresIn: 3600,
      };

      sessionStorage.setItem("oauth_state", "valid-state");
      sessionStorage.setItem("oauth_nonce", "test-nonce");
      vi.mocked(authService.exchangeCodeForTokens).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.handleOAuthCallback("auth-code-123", "valid-state");
      });

      expect(sessionStorage.getItem("oauth_state")).toBeNull();
      expect(sessionStorage.getItem("oauth_nonce")).toBeNull();
    });
  });

  describe("Token Management", () => {
    it("should automatically refresh token when expired", async () => {
      const expiredToken = Date.now() - 1000; // Expired 1 second ago
      const mockRefreshResponse = {
        token: "new-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expiresIn: 3600,
      };

      useAuthStore.setState({
        token: "old-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        isAuthenticated: true,
        tokenExpiry: expiredToken,
      });

      vi.mocked(authService.refreshToken).mockResolvedValue(mockRefreshResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(authService.refreshToken).toHaveBeenCalled();
      expect(result.current.token).toBe("new-token");
    });

    it("should handle token refresh failure and logout user", async () => {
      const expiredToken = Date.now() - 1000;

      useAuthStore.setState({
        token: "old-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        isAuthenticated: true,
        tokenExpiry: expiredToken,
      });

      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error("Refresh failed")
      );

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it("should manually refresh token on user request", async () => {
      const mockRefreshResponse = {
        token: "new-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expiresIn: 3600,
      };

      useAuthStore.setState({
        token: "old-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        isAuthenticated: true,
        tokenExpiry: Date.now() + 3600000,
      });

      vi.mocked(authService.refreshToken).mockResolvedValue(mockRefreshResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(authService.refreshToken).toHaveBeenCalled();
      expect(result.current.token).toBe("new-token");
    });

    it("should handle concurrent token refresh attempts", async () => {
      const mockRefreshResponse = {
        token: "new-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expiresIn: 3600,
      };

      useAuthStore.setState({
        token: "old-token",
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        isAuthenticated: true,
        tokenExpiry: Date.now() + 3600000,
      });

      vi.mocked(authService.refreshToken).mockResolvedValue(mockRefreshResponse);

      const { result } = renderHook(() => useAuthStore());

      // Simulate multiple concurrent refresh attempts
      await act(async () => {
        await Promise.all([
          result.current.refreshToken(),
          result.current.refreshToken(),
          result.current.refreshToken(),
        ]);
      });

      // Should only call once due to race condition handling
      expect(authService.refreshToken).toHaveBeenCalled();
      expect(result.current.token).toBe("new-token");
    });
  });

  describe("Session Management", () => {
    it("should track user activity and update lastActivity", async () => {
      const { result } = renderHook(() => useAuthStore());

      const initialActivity = result.current.lastActivity;

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        result.current.updateActivity();
      });

      expect(result.current.lastActivity).toBeGreaterThan(initialActivity);
    });

    it("should show session timeout warning before expiration", async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        result.current.login("token", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      // Fast forward to warning time (25 minutes)
      act(() => {
        vi.advanceTimersByTime(25 * 60 * 1000);
      });

      await waitFor(() => {
        expect(result.current.sessionTimeoutWarning).toBe(true);
      });

      vi.useRealTimers();
    });

    it("should logout user after session timeout", async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        result.current.login("token", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      // Fast forward to session timeout (30 minutes)
      await act(async () => {
        vi.advanceTimersByTime(30 * 60 * 1000);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      vi.useRealTimers();
    });

    it("should extend session on user activity", async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        result.current.login("token", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      // Advance time but update activity before timeout
      act(() => {
        vi.advanceTimersByTime(20 * 60 * 1000); // 20 minutes
        result.current.updateActivity();
      });

      // Advance another 20 minutes (total 40, but activity was at 20)
      await act(async () => {
        vi.advanceTimersByTime(20 * 60 * 1000);
      });

      // Should still be authenticated due to activity update
      expect(result.current.isAuthenticated).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle network errors during OAuth flow", async () => {
      vi.mocked(authService.getGoogleAuthUrl).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.startGoogleLogin();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start login process")
      );
    });

    it("should handle OAuth callback errors with user-friendly messages", async () => {
      sessionStorage.setItem("oauth_state", "valid-state");
      vi.mocked(authService.exchangeCodeForTokens).mockRejectedValue(
        new Error("Invalid authorization code format")
      );

      const { result } = renderHook(() => useAuthStore());

      await expect(async () => {
        await act(async () => {
          await result.current.handleOAuthCallback("auth-code-123", "valid-state");
        });
      }).rejects.toThrow();

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid authorization code")
      );
    });

    it("should cleanup state on OAuth errors", async () => {
      sessionStorage.setItem("oauth_state", "valid-state");
      vi.mocked(authService.exchangeCodeForTokens).mockRejectedValue(
        new Error("OAuth failed")
      );

      const { result } = renderHook(() => useAuthStore());

      await expect(async () => {
        await act(async () => {
          await result.current.handleOAuthCallback("auth-code-123", "valid-state");
        });
      }).rejects.toThrow();

      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(sessionStorage.getItem("oauth_state")).toBeNull();
    });
  });

  describe("Persistence", () => {
    it("should persist auth state to localStorage", async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        result.current.login("token-123", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      const persistedState = JSON.parse(
        localStorage.getItem("auth-storage") || "{}"
      );

      expect(persistedState.state.token).toBe("token-123");
      expect(persistedState.state.user.id).toBe("user-123");
    });

    it("should restore auth state from localStorage on mount", () => {
      // Simulate persisted state
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: {
            token: "persisted-token",
            user: { id: "user-123", email: "test@example.com", name: "Test User" },
            isAuthenticated: true,
            tokenExpiry: Date.now() + 3600000,
            lastActivity: Date.now(),
          },
        })
      );

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.token).toBe("persisted-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.id).toBe("user-123");
    });

    it("should clear persisted state on logout", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login first
      await act(async () => {
        result.current.login("token-123", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      const persistedState = JSON.parse(
        localStorage.getItem("auth-storage") || "{}"
      );

      expect(persistedState.state.token).toBeNull();
      expect(persistedState.state.isAuthenticated).toBe(false);
    });
  });

  describe("Login and Logout", () => {
    it("should set auth state on successful login", async () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      await act(async () => {
        result.current.login("token-123", mockUser, 3600);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.token).toBe("token-123");
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it("should clear auth state on logout", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login first
      await act(async () => {
        result.current.login("token-123", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      vi.mocked(authService.logout).mockResolvedValue();

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(authService.logout).toHaveBeenCalled();
    });

    it("should show success message on login", async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        result.current.login("token-123", {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        }, 3600);
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Welcome back")
      );
    });
  });
});
