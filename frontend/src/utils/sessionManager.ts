import { useAuthStore } from "@/stores/authStore";

class SessionManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

  /**
   * Start automatic token refresh
   */
  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.scheduleRefresh();
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Schedule the next token refresh
   */
  private scheduleRefresh(): void {
    const { tokenExpiry, isAuthenticated } = useAuthStore.getState();

    if (!isAuthenticated || !tokenExpiry) {
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = tokenExpiry - now;

    // If token is already expired, don't schedule refresh
    if (timeUntilExpiry <= 0) {
      console.warn("Token already expired, skipping refresh schedule");
      return;
    }

    const timeUntilRefresh = Math.max(0, timeUntilExpiry - this.REFRESH_BUFFER);

    // Don't schedule if refresh time is too soon (less than 1 minute)
    if (timeUntilRefresh < 60000) {
      console.warn("Token expires too soon, skipping refresh schedule");
      return;
    }

    this.refreshTimer = setTimeout(async () => {
      try {
        const { isAuthenticated: stillAuthenticated } = useAuthStore.getState();
        if (!stillAuthenticated) {
          return; // User logged out, don't refresh
        }

        await useAuthStore.getState().refreshToken();
        this.scheduleRefresh(); // Schedule next refresh
      } catch (error) {
        console.error("Auto refresh failed:", error);
        // Clear auth state on refresh failure
        useAuthStore.getState().logout();
      }
    }, timeUntilRefresh);
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(): boolean {
    const { tokenExpiry } = useAuthStore.getState();
    if (!tokenExpiry) return false;

    const now = Date.now();
    return tokenExpiry - now <= this.REFRESH_BUFFER;
  }

  /**
   * Get time until token expires
   */
  getTimeUntilExpiry(): number {
    const { tokenExpiry } = useAuthStore.getState();
    if (!tokenExpiry) return 0;

    return Math.max(0, tokenExpiry - Date.now());
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    const { tokenExpiry, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !tokenExpiry) return false;

    return Date.now() < tokenExpiry;
  }
}

export const sessionManager = new SessionManager();

// Auto-start session management when module loads
if (typeof window !== "undefined") {
  // Start session management after auth store is initialized
  setTimeout(() => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      sessionManager.startAutoRefresh();
    }
  }, 100);

  // Listen for auth state changes
  useAuthStore.subscribe((state, prevState) => {
    if (state.isAuthenticated && !prevState.isAuthenticated) {
      sessionManager.startAutoRefresh();
    } else if (!state.isAuthenticated && prevState.isAuthenticated) {
      sessionManager.stopAutoRefresh();
    }
  });
}
