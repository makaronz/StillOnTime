import { useState, useEffect, useCallback } from "react";
import {
  historyService,
  ProcessingHistoryFilters,
  ProcessingAnalytics,
  DetailedProcessedEmail,
} from "@/services/history";
import { PaginatedResponse } from "@/types";
import toast from "react-hot-toast";

interface UseHistoryReturn {
  // Data
  emails: DetailedProcessedEmail[];
  analytics: ProcessingAnalytics | null;
  pagination: PaginatedResponse<DetailedProcessedEmail>["pagination"] | null;

  // State
  isLoading: boolean;
  isLoadingAnalytics: boolean;
  error: string | null;

  // Filters
  filters: ProcessingHistoryFilters;
  setFilters: (filters: ProcessingHistoryFilters) => void;

  // Actions
  loadPage: (page: number) => Promise<void>;
  refreshData: () => Promise<void>;
  retryEmail: (emailId: string) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  exportHistory: (format: "csv" | "json") => Promise<void>;
  loadAnalytics: (dateFrom?: string, dateTo?: string) => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [emails, setEmails] = useState<DetailedProcessedEmail[]>([]);
  const [analytics, setAnalytics] = useState<ProcessingAnalytics | null>(null);
  const [pagination, setPagination] = useState<
    PaginatedResponse<DetailedProcessedEmail>["pagination"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProcessingHistoryFilters>({});

  const loadEmails = useCallback(
    async (page: number = 1) => {
      try {
        setError(null);
        setIsLoading(true);

        const response = await historyService.getProcessingHistory(
          page,
          20,
          filters
        );

        setEmails(response.data || []);
        setPagination(response.pagination);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load processing history";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [filters]
  );

  const loadAnalytics = useCallback(
    async (dateFrom?: string, dateTo?: string) => {
      try {
        setIsLoadingAnalytics(true);
        const analyticsData = await historyService.getProcessingAnalytics(
          dateFrom,
          dateTo
        );
        setAnalytics(analyticsData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load analytics";
        toast.error(errorMessage);
      } finally {
        setIsLoadingAnalytics(false);
      }
    },
    []
  );

  const loadPage = useCallback(
    async (page: number) => {
      await loadEmails(page);
    },
    [loadEmails]
  );

  const refreshData = useCallback(async () => {
    await Promise.all([loadEmails(1), loadAnalytics()]);
  }, [loadEmails, loadAnalytics]);

  const retryEmail = useCallback(
    async (emailId: string) => {
      try {
        await historyService.retryEmailProcessing(emailId);
        toast.success("Email processing retry initiated");
        await refreshData();
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to retry email processing";
        toast.error(errorMessage);
      }
    },
    [refreshData]
  );

  const deleteEmail = useCallback(
    async (emailId: string) => {
      try {
        await historyService.deleteEmail(emailId);
        toast.success("Email deleted successfully");
        await refreshData();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete email";
        toast.error(errorMessage);
      }
    },
    [refreshData]
  );

  const exportHistory = useCallback(
    async (format: "csv" | "json") => {
      try {
        const blob = await historyService.exportHistory(format, filters);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `processing-history.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`History exported as ${format.toUpperCase()}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to export history";
        toast.error(errorMessage);
      }
    },
    [filters]
  );

  // Load initial data
  useEffect(() => {
    refreshData();
  }, []);

  // Reload emails when filters change
  useEffect(() => {
    loadEmails(1);
  }, [loadEmails]);

  return {
    emails,
    analytics,
    pagination,
    isLoading,
    isLoadingAnalytics,
    error,
    filters,
    setFilters,
    loadPage,
    refreshData,
    retryEmail,
    deleteEmail,
    exportHistory,
    loadAnalytics,
  };
}
