import { apiService } from "./api";
import { UserConfig, ApiResponse } from "@/types";

export interface ApiConnectionStatus {
  gmail: {
    connected: boolean;
    lastCheck: Date | null;
    error?: string;
  };
  calendar: {
    connected: boolean;
    lastCheck: Date | null;
    error?: string;
  };
  maps: {
    connected: boolean;
    lastCheck: Date | null;
    error?: string;
  };
  weather: {
    connected: boolean;
    lastCheck: Date | null;
    error?: string;
  };
}

export interface AddressValidationResult {
  isValid: boolean;
  formattedAddress?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  error?: string;
}

class ConfigurationService {
  /**
   * Get user configuration
   */
  async getUserConfig(): Promise<UserConfig> {
    const response = await apiService.get<ApiResponse<UserConfig>>(
      "/api/user/config"
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get user configuration");
    }
    return response.data;
  }

  /**
   * Update user configuration
   */
  async updateUserConfig(config: Partial<UserConfig>): Promise<UserConfig> {
    const response = await apiService.put<ApiResponse<UserConfig>>(
      "/api/user/config",
      config
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to update user configuration");
    }
    return response.data;
  }

  /**
   * Validate address using Google Maps
   */
  async validateAddress(address: string): Promise<AddressValidationResult> {
    try {
      const response = await apiService.post<
        ApiResponse<AddressValidationResult>
      >("/api/maps/validate-address", { address });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to validate address");
      }
      return response.data;
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : "Address validation failed",
      };
    }
  }

  /**
   * Get API connection status
   */
  async getApiConnectionStatus(): Promise<ApiConnectionStatus> {
    const response = await apiService.get<
      ApiResponse<{
        gmail: { connected: boolean; lastCheck: string | null; error?: string };
        calendar: {
          connected: boolean;
          lastCheck: string | null;
          error?: string;
        };
        maps: { connected: boolean; lastCheck: string | null; error?: string };
        weather: {
          connected: boolean;
          lastCheck: string | null;
          error?: string;
        };
      }>
    >("/api/system/connections");

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get API connection status");
    }

    // Convert string dates to Date objects
    return {
      gmail: {
        ...response.data.gmail,
        lastCheck: response.data.gmail.lastCheck
          ? new Date(response.data.gmail.lastCheck)
          : null,
      },
      calendar: {
        ...response.data.calendar,
        lastCheck: response.data.calendar.lastCheck
          ? new Date(response.data.calendar.lastCheck)
          : null,
      },
      maps: {
        ...response.data.maps,
        lastCheck: response.data.maps.lastCheck
          ? new Date(response.data.maps.lastCheck)
          : null,
      },
      weather: {
        ...response.data.weather,
        lastCheck: response.data.weather.lastCheck
          ? new Date(response.data.weather.lastCheck)
          : null,
      },
    };
  }

  /**
   * Test API connection
   */
  async testApiConnection(
    service: "gmail" | "calendar" | "maps" | "weather"
  ): Promise<boolean> {
    const response = await apiService.post<ApiResponse<{ success: boolean }>>(
      `/api/system/test-connection/${service}`
    );
    return response.success && response.data?.success === true;
  }

  /**
   * Reset user configuration to defaults
   */
  async resetConfiguration(): Promise<UserConfig> {
    const response = await apiService.post<ApiResponse<UserConfig>>(
      "/api/user/config/reset"
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to reset configuration");
    }
    return response.data;
  }
}

export const configurationService = new ConfigurationService();
