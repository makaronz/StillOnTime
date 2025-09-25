import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService } from "@/services/auth";
import { User } from "@/types";
import {
  generateSecureState,
  validateState,
  validateAuthCode,
  cleanupOAuthStorage,
} from "@/utils/oauth";
import toast from "react-hot-toast";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  tokenExpiry: number | null;

  // Actions
  login: (token: string, user: User, expiresIn?: number) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      tokenExpiry: null,

      login: (token: string, user: User, expiresIn?: number) => {
        const expiry = expiresIn ? Date.now() + expiresIn * 1000 : null;
        set({
          token,
          user,
          isAuthenticated: true,
          tokenExpiry: expiry,
          isLoading: false,
        });
        toast.success(`Welcome back, ${user.name || user.email}!`);
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            tokenExpiry: null,
            isLoading: false,
          });
          toast.success("Logged out successfully");
        }
      },

      checkAuth: async () => {
        const { token, tokenExpiry } = get();

        if (!token) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        // Check if token is expired
        if (tokenExpiry && Date.now() > tokenExpiry) {
          try {
            await get().refreshToken();
          } catch (error) {
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              tokenExpiry: null,
              isLoading: false,
            });
            return;
          }
        }

        set({ isLoading: true });
        try {
          const response = await authService.validateToken();
          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error("Invalid token");
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            tokenExpiry: null,
            isLoading: false,
          });
        }
      },

      refreshToken: async () => {
        try {
          const response = await authService.refreshToken();
          const expiry = Date.now() + response.expiresIn * 1000;
          set({
            token: response.token,
            user: response.user,
            tokenExpiry: expiry,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error("Token refresh failed:", error);
          throw error;
        }
      },

      startGoogleLogin: async () => {
        set({ isLoading: true });
        try {
          // Generate secure state parameter
          const secureState = generateSecureState();

          const response = await authService.getGoogleAuthUrl();

          // Store state for validation (use our secure state if backend doesn't provide one)
          const stateToStore = response.state || secureState;
          sessionStorage.setItem("oauth_state", stateToStore);

          // Redirect to Google OAuth
          window.location.href = response.authUrl;
        } catch (error) {
          console.error("Failed to start Google login:", error);
          toast.error("Failed to start login process");
          cleanupOAuthStorage();
          set({ isLoading: false });
        }
      },

      handleOAuthCallback: async (code: string, state: string) => {
        set({ isLoading: true });
        try {
          // Validate state parameter using secure comparison
          const storedState = sessionStorage.getItem("oauth_state");
          if (!validateState(state, storedState)) {
            throw new Error("Invalid state parameter - possible CSRF attack");
          }

          // Validate authorization code format
          if (!validateAuthCode(code)) {
            throw new Error("Invalid authorization code format");
          }

          const response = await authService.exchangeCodeForTokens(code, state);
          const expiry = Date.now() + response.expiresIn * 1000;

          set({
            token: response.token,
            user: response.user,
            tokenExpiry: expiry,
            isAuthenticated: true,
            isLoading: false,
          });

          // Clean up OAuth storage
          cleanupOAuthStorage();
          toast.success(
            `Welcome, ${response.user.name || response.user.email}!`
          );
        } catch (error) {
          console.error("OAuth callback failed:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Login failed";
          toast.error(`Authentication error: ${errorMessage}`);
          set({
            isLoading: false,
            token: null,
            user: null,
            isAuthenticated: false,
            tokenExpiry: null,
          });
          // Clean up on error
          cleanupOAuthStorage();
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tokenExpiry: state.tokenExpiry,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
