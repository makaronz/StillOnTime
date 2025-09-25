import { useState, useEffect, useCallback } from "react";
import {
  configurationService,
  ApiConnectionStatus,
  AddressValidationResult,
} from "@/services/configuration";
import { UserConfig } from "@/types";
import toast from "react-hot-toast";

interface UseConfigurationReturn {
  config: UserConfig | null;
  connectionStatus: ApiConnectionStatus | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
  validateAddress: (address: string) => Promise<AddressValidationResult>;
  testConnection: (
    service: "gmail" | "calendar" | "maps" | "weather"
  ) => Promise<boolean>;
  refreshConnectionStatus: () => Promise<void>;
  resetConfig: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useConfiguration(): UseConfigurationReturn {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ApiConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [userConfig, apiStatus] = await Promise.all([
        configurationService.getUserConfig(),
        configurationService.getApiConnectionStatus(),
      ]);

      setConfig(userConfig);
      setConnectionStatus(apiStatus);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load configuration";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(
    async (updates: Partial<UserConfig>) => {
      if (!config) return;

      setIsSaving(true);
      try {
        const updatedConfig = await configurationService.updateUserConfig(
          updates
        );
        setConfig(updatedConfig);
        toast.success("Configuration updated successfully");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update configuration";
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [config]
  );

  const validateAddress = useCallback(
    async (address: string): Promise<AddressValidationResult> => {
      try {
        return await configurationService.validateAddress(address);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Address validation failed";
        toast.error(errorMessage);
        return {
          isValid: false,
          error: errorMessage,
        };
      }
    },
    []
  );

  const testConnection = useCallback(
    async (
      service: "gmail" | "calendar" | "maps" | "weather"
    ): Promise<boolean> => {
      try {
        const result = await configurationService.testApiConnection(service);
        if (result) {
          toast.success(
            `${
              service.charAt(0).toUpperCase() + service.slice(1)
            } connection successful`
          );
        } else {
          toast.error(
            `${
              service.charAt(0).toUpperCase() + service.slice(1)
            } connection failed`
          );
        }

        // Refresh connection status after test
        await refreshConnectionStatus();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : `Failed to test ${service} connection`;
        toast.error(errorMessage);
        return false;
      }
    },
    []
  );

  const refreshConnectionStatus = useCallback(async () => {
    try {
      const apiStatus = await configurationService.getApiConnectionStatus();
      setConnectionStatus(apiStatus);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to refresh connection status";
      toast.error(errorMessage);
    }
  }, []);

  const resetConfig = useCallback(async () => {
    setIsSaving(true);
    try {
      const resetConfig = await configurationService.resetConfiguration();
      setConfig(resetConfig);
      toast.success("Configuration reset to defaults");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reset configuration";
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    config,
    connectionStatus,
    isLoading,
    isSaving,
    error,
    updateConfig,
    validateAddress,
    testConnection,
    refreshConnectionStatus,
    resetConfig,
    refreshData,
  };
}
