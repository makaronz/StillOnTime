import { apiService } from "./api";
import {
  SystemStatus,
  ProcessedEmail,
  ScheduleData,
  ApiResponse,
} from "@/types";

class DashboardService {
  /**
   * Get system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await apiService.get<ApiResponse<SystemStatus>>(
      "/api/system/status"
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get system status");
    }
    return response.data;
  }

  /**
   * Get recent email processing activity
   */
  async getRecentActivity(limit: number = 10): Promise<ProcessedEmail[]> {
    const response = await apiService.get<ApiResponse<ProcessedEmail[]>>(
      `/api/emails/recent?limit=${limit}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get recent activity");
    }
    return response.data;
  }

  /**
   * Get upcoming schedules
   */
  async getUpcomingSchedules(limit: number = 5): Promise<ScheduleData[]> {
    const response = await apiService.get<ApiResponse<ScheduleData[]>>(
      `/api/schedules/upcoming?limit=${limit}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get upcoming schedules");
    }
    return response.data;
  }

  /**
   * Trigger manual email processing
   */
  async triggerEmailProcessing(): Promise<void> {
    const response = await apiService.post<ApiResponse>("/api/emails/process");
    if (!response.success) {
      throw new Error(response.error || "Failed to trigger email processing");
    }
  }

  /**
   * Retry failed email processing
   */
  async retryEmailProcessing(emailId: string): Promise<void> {
    const response = await apiService.post<ApiResponse>(
      `/api/emails/${emailId}/retry`
    );
    if (!response.success) {
      throw new Error(response.error || "Failed to retry email processing");
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalProcessed: number;
    successRate: number;
    lastProcessed: Date | null;
    pendingCount: number;
  }> {
    const response = await apiService.get<
      ApiResponse<{
        totalProcessed: number;
        successRate: number;
        lastProcessed: string | null;
        pendingCount: number;
      }>
    >("/api/emails/stats");

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get processing stats");
    }

    return {
      ...response.data,
      lastProcessed: response.data.lastProcessed
        ? new Date(response.data.lastProcessed)
        : null,
    };
  }
}

export const dashboardService = new DashboardService();
