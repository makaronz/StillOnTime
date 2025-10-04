import { create } from "zustand";
import { persist } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
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
  lastActivity: number;
  sessionTimeoutWarning: boolean;

  // Actions
  login: (token: string, user: User, expiresIn?: number) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
  updateActivity: () => void;
  clearSessionWarning: () => void;
}

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
const WARNING_TIMEOUT = 25 * 60 * 1000;

export const useAuthStore = create<AuthState>()(subscribeWithSelector(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      tokenExpiry: null,
      lastActivity: Date.now(),
      sessionTimeoutWarning: false,

      login: (token: string, user: User, expiresIn?: number) => {
        const expiry = expiresIn ? Date.now() + expiresIn * 1000 : null;
        const now = Date.now();
        set({
          token,
          user,
          isAuthenticated: true,
          tokenExpiry: expiry,
          isLoading: false,
          lastActivity: now,
          sessionTimeoutWarning: false,
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
            sessionTimeoutWarning: false,
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
              sessionTimeoutWarning: false,
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
            sessionTimeoutWarning: false,
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
            lastActivity: Date.now(),
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
            lastActivity: Date.now(),
            sessionTimeoutWarning: false,
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
            sessionTimeoutWarning: false,
          });
          // Clean up on error
          cleanupOAuthStorage();
          throw error;
        }
      },

      updateActivity: () => {
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          set({ 
            lastActivity: Date.now(),
            sessionTimeoutWarning: false,
          });
        }
      },

      clearSessionWarning: () => {
        set({ sessionTimeoutWarning: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tokenExpiry: state.tokenExpiry,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    }
  ))
);

// Session management - check for inactivity
if (typeof window !== 'undefined') {
  let sessionTimer: NodeJS.Timeout;
  let warningTimer: NodeJS.Timeout;

  const resetSessionTimers = () => {
    clearTimeout(sessionTimer);
    clearTimeout(warningTimer);
    
    const state = useAuthStore.getState();
    if (!state.isAuthenticated) return;

    // Set warning timer
    warningTimer = setTimeout(() => {
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        useAuthStore.setState({ sessionTimeoutWarning: true });
        const toastId = toast('Session will expire in 5 minutes due to inactivity.', {
          duration: 10000,
        });
        
        // Allow user to extend session by clicking anywhere
        const extendSession = () => {
          useAuthStore.getState().updateActivity();
          toast.dismiss(toastId);
        };
        
        document.addEventListener('click', extendSession, { once: true });
      }
    }, WARNING_TIMEOUT);

    // Set logout timer
    sessionTimer = setTimeout(() => {
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        toast.error('Session expired due to inactivity');
        currentState.logout();
      }
    }, SESSION_TIMEOUT);
  };

  // Listen for activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  const throttledUpdate = (() => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        useAuthStore.getState().updateActivity();
      }, 1000); // Throttle to once per second
    };
  })();

  activityEvents.forEach(event => {
    document.addEventListener(event, throttledUpdate, true);
  });

  // Subscribe to auth state changes
  useAuthStore.subscribe(
    (state) => state.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) {
        resetSessionTimers();
      } else {
        clearTimeout(sessionTimer);
        clearTimeout(warningTimer);
      }
    }
  );

  // Subscribe to activity updates
  useAuthStore.subscribe(
    (state) => state.lastActivity,
    () => {
      resetSessionTimers();
    }
  );
}
