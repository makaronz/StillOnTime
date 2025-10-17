/**
 * OAuth Service Layer
 * Handles all OAuth-related API calls to the backend
 */

import { api } from "./api";

export interface OAuthStatus {
  connected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  scopes: string[];
  tokenExpiry: Date | null;
  lastSync: Date | null;
  needsReauth: boolean;
}

export interface SyncPreferences {
  gmailEnabled: boolean;
  gmailSyncFrequency: number; // minutes
  gmailFolders: string[];
  calendarEnabled: boolean;
  selectedCalendars: string[];
  autoSync: boolean;
}

export interface OAuthStatusResponse {
  success: boolean;
  status: OAuthStatus;
}

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  expiresAt: Date;
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
}

export interface ReconnectResponse {
  success: boolean;
  authUrl: string;
  state: string;
  message: string;
}

export interface TestConnectionResponse {
  success: boolean;
  connected: boolean;
  message: string;
  userInfo?: {
    email: string;
    name: string;
    verified: boolean;
  };
  needsReauth?: boolean;
}

export class OAuthService {
  /**
   * Get current OAuth connection status
   */
  async getStatus(): Promise<OAuthStatus> {
    try {
      const response = await api.get<OAuthStatusResponse>("/api/oauth/status");

      // Convert date strings to Date objects
      const status = response.data.status;
      return {
        ...status,
        tokenExpiry: status.tokenExpiry ? new Date(status.tokenExpiry) : null,
        lastSync: status.lastSync ? new Date(status.lastSync) : null,
      };
    } catch (error) {
      console.error("Failed to get OAuth status:", error);
      throw error;
    }
  }

  /**
   * Manually refresh OAuth access token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const response = await api.post<RefreshTokenResponse>(
        "/api/oauth/refresh"
      );

      // Convert date string to Date object
      return {
        ...response.data,
        expiresAt: new Date(response.data.expiresAt),
      };
    } catch (error) {
      console.error("Failed to refresh OAuth token:", error);
      throw error;
    }
  }

  /**
   * Disconnect OAuth account and revoke tokens
   */
  async disconnect(): Promise<DisconnectResponse> {
    try {
      const response = await api.post<DisconnectResponse>(
        "/api/oauth/disconnect"
      );
      return response.data;
    } catch (error) {
      console.error("Failed to disconnect OAuth account:", error);
      throw error;
    }
  }

  /**
   * Get reconnection URL for re-authentication
   */
  async reconnect(): Promise<ReconnectResponse> {
    try {
      const response = await api.get<ReconnectResponse>(
        "/api/oauth/reconnect"
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get reconnection URL:", error);
      throw error;
    }
  }

  /**
   * Test OAuth connection by making an API call
   */
  async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await api.get<TestConnectionResponse>(
        "/api/oauth/test"
      );
      return response.data;
    } catch (error: any) {
      console.error("OAuth connection test failed:", error);

      // Check if it's a reauth error
      if (error.response?.data?.needsReauth) {
        return {
          success: false,
          connected: false,
          message: error.response.data.message,
          needsReauth: true,
        };
      }

      throw error;
    }
  }

  /**
   * Update sync preferences (future feature - API not yet implemented)
   */
  async updatePreferences(
    preferences: Partial<SyncPreferences>
  ): Promise<void> {
    try {
      await api.put("/api/oauth/preferences", preferences);
    } catch (error) {
      console.error("Failed to update sync preferences:", error);
      throw error;
    }
  }

  /**
   * Get available Gmail folders (future feature)
   */
  async getGmailFolders(): Promise<string[]> {
    try {
      const response = await api.get<{ folders: string[] }>(
        "/api/oauth/folders"
      );
      return response.data.folders;
    } catch (error) {
      console.error("Failed to get Gmail folders:", error);
      throw error;
    }
  }

  /**
   * Get available calendars (future feature)
   */
  async getCalendars(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await api.get<{
        calendars: Array<{ id: string; name: string }>;
      }>("/api/oauth/calendars");
      return response.data.calendars;
    } catch (error) {
      console.error("Failed to get calendars:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
export default oauthService;
