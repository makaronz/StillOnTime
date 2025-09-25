import { useState, useEffect, useCallback } from "react";
import { dashboardService } from "@/services/dashboard";
import { SystemStatus, ProcessedEmail, ScheduleData } from "@/types";
import toast from "react-hot-toast";

interface DashboardData {
  systemStatus: SystemStatus | null;
  recentActivity: ProcessedEmail[];
  upcomingSchedules: ScheduleData[];
  processingStats: {
    totalProcessed: number;
    successRate: number;
    lastProcessed: Date | null;
    pendingCount: number;
  } | null;
}

interface UseDashboardReturn extends DashboardData {
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  triggerProcessing: () => Promise<void>;
  retryEmail: (emailId: string) => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardData>({
    systemStatus: null,
    recentActivity: [],
    upcomingSchedules: [],
    processingStats: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [systemStatus, recentActivity, upcomingSchedules, processingStats] =
        await Promise.all([
          dashboardService.getSystemStatus(),
          dashboardService.getRecentActivity(),
          dashboardService.getUpcomingSchedules(),
          dashboardService.getProcessingStats(),
        ]);

      setData({
        systemStatus,
        recentActivity,
        upcomingSchedules,
        processingStats,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  const triggerProcessing = useCallback(async () => {
    try {
      await dashboardService.triggerEmailProcessing();
      toast.success("Email processing triggered successfully");
      // Refresh data after triggering
      await refreshData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to trigger processing";
      toast.error(errorMessage);
    }
  }, [refreshData]);

  const retryEmail = useCallback(
    async (emailId: string) => {
      try {
        await dashboardService.retryEmailProcessing(emailId);
        toast.success("Email processing retry initiated");
        // Refresh data after retry
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        fetchData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, isLoading]);

  return {
    ...data,
    isLoading,
    error,
    refreshData,
    triggerProcessing,
    retryEmail,
  };
}
