/**
 * OAuth State Management Store
 * Manages OAuth connection status and sync preferences using Zustand
 */

import { create } from "zustand";
import { oauthService, OAuthStatus, SyncPreferences } from "../services/oauth.service";

interface OAuthStoreState {
  // State
  oauthStatus: OAuthStatus | null;
  syncPreferences: SyncPreferences;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  checkOAuthStatus: () => Promise<void>;
  refreshToken: () => Promise<void>;
  disconnectAccount: () => Promise<void>;
  reconnectAccount: () => Promise<string>; // Returns auth URL
  updateSyncPreferences: (prefs: Partial<SyncPreferences>) => Promise<void>;
  testConnection: () => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

// Default sync preferences
const defaultSyncPreferences: SyncPreferences = {
  gmailEnabled: false,
  gmailSyncFrequency: 15, // 15 minutes
  gmailFolders: [],
  calendarEnabled: false,
  selectedCalendars: [],
  autoSync: false,
};

export const useOAuthStore = create<OAuthStoreState>((set, get) => ({
  // Initial state
  oauthStatus: null,
  syncPreferences: defaultSyncPreferences,
  isLoading: false,
  isRefreshing: false,
  error: null,

  // Check OAuth connection status
  checkOAuthStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await oauthService.getStatus();
      set({ oauthStatus: status, isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to check OAuth status";
      set({
        error: errorMessage,
        isLoading: false,
        oauthStatus: {
          connected: false,
          accountEmail: null,
          accountName: null,
          scopes: [],
          tokenExpiry: null,
          lastSync: null,
          needsReauth: false,
        },
      });
      console.error("Failed to check OAuth status:", error);
    }
  },

  // Manually refresh access token
  refreshToken: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const result = await oauthService.refreshToken();

      // Update token expiry in status
      const currentStatus = get().oauthStatus;
      if (currentStatus) {
        set({
          oauthStatus: {
            ...currentStatus,
            tokenExpiry: result.expiresAt,
            needsReauth: false,
          },
          isRefreshing: false,
        });
      } else {
        set({ isRefreshing: false });
      }

      console.log("OAuth token refreshed successfully");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to refresh token";
      set({ error: errorMessage, isRefreshing: false });
      console.error("Failed to refresh OAuth token:", error);
      throw error;
    }
  },

  // Disconnect OAuth account
  disconnectAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await oauthService.disconnect();
      set({
        oauthStatus: {
          connected: false,
          accountEmail: null,
          accountName: null,
          scopes: [],
          tokenExpiry: null,
          lastSync: null,
          needsReauth: false,
        },
        isLoading: false,
      });
      console.log("OAuth account disconnected successfully");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to disconnect account";
      set({ error: errorMessage, isLoading: false });
      console.error("Failed to disconnect OAuth account:", error);
      throw error;
    }
  },

  // Get reconnection URL
  reconnectAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await oauthService.reconnect();
      set({ isLoading: false });
      return result.authUrl;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to generate reconnection URL";
      set({ error: errorMessage, isLoading: false });
      console.error("Failed to get reconnection URL:", error);
      throw error;
    }
  },

  // Update sync preferences
  updateSyncPreferences: async (prefs: Partial<SyncPreferences>) => {
    set({ isLoading: true, error: null });
    try {
      const newPreferences = { ...get().syncPreferences, ...prefs };
      await oauthService.updatePreferences(newPreferences);
      set({ syncPreferences: newPreferences, isLoading: false });
      console.log("Sync preferences updated successfully");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to update preferences";
      set({ error: errorMessage, isLoading: false });
      console.error("Failed to update sync preferences:", error);
      throw error;
    }
  },

  // Test OAuth connection
  testConnection: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await oauthService.testConnection();

      if (result.needsReauth) {
        // Update status to indicate reauth needed
        const currentStatus = get().oauthStatus;
        if (currentStatus) {
          set({
            oauthStatus: {
              ...currentStatus,
              needsReauth: true,
            },
          });
        }
        set({ isLoading: false });
        return false;
      }

      set({ isLoading: false });
      return result.connected;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Connection test failed";
      set({ error: errorMessage, isLoading: false });
      console.error("OAuth connection test failed:", error);
      return false;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store to initial state
  reset: () => {
    set({
      oauthStatus: null,
      syncPreferences: defaultSyncPreferences,
      isLoading: false,
      isRefreshing: false,
      error: null,
    });
  },
}));

export default useOAuthStore;
