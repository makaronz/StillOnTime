import { apiService } from "./api";
import {
  ProcessedEmail,
  ScheduleData,
  ApiResponse,
  PaginatedResponse,
} from "@/types";

export interface ProcessingHistoryFilters {
  status?: "pending" | "processing" | "completed" | "failed";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ProcessingAnalytics {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  processingTrends: {
    date: string;
    processed: number;
    successful: number;
    failed: number;
  }[];
  errorBreakdown: {
    error: string;
    count: number;
    percentage: number;
  }[];
  monthlyStats: {
    month: string;
    totalEmails: number;
    successfulSchedules: number;
    failedProcessing: number;
  }[];
}

export interface DetailedProcessedEmail extends ProcessedEmail {
  schedule?: ScheduleData;
  processingTime?: number;
  retryCount?: number;
}

class HistoryService {
  /**
   * Get paginated processing history
   */
  async getProcessingHistory(
    page: number = 1,
    limit: number = 20,
    filters: ProcessingHistoryFilters = {}
  ): Promise<PaginatedResponse<DetailedProcessedEmail>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(
          ([_, value]) => value !== undefined && value !== ""
        )
      ),
    });

    const response = await apiService.get<
      PaginatedResponse<DetailedProcessedEmail>
    >(`/api/emails/history?${params}`);

    if (!response.success) {
      throw new Error(response.error || "Failed to get processing history");
    }

    return response;
  }

  /**
   * Get processing analytics
   */
  async getProcessingAnalytics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<ProcessingAnalytics> {
    const params = new URLSearchParams();
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    const response = await apiService.get<ApiResponse<ProcessingAnalytics>>(
      `/api/analytics/processing?${params}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get processing analytics");
    }

    return response.data;
  }

  /**
   * Get detailed email information
   */
  async getEmailDetails(emailId: string): Promise<DetailedProcessedEmail> {
    const response = await apiService.get<ApiResponse<DetailedProcessedEmail>>(
      `/api/emails/${emailId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get email details");
    }

    return response.data;
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
   * Delete email from history
   */
  async deleteEmail(emailId: string): Promise<void> {
    const response = await apiService.delete<ApiResponse>(
      `/api/emails/${emailId}`
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to delete email");
    }
  }

  /**
   * Export processing history
   */
  async exportHistory(
    format: "csv" | "json",
    filters: ProcessingHistoryFilters = {}
  ): Promise<Blob> {
    const params = new URLSearchParams({
      format,
      ...Object.fromEntries(
        Object.entries(filters).filter(
          ([_, value]) => value !== undefined && value !== ""
        )
      ),
    });

    const response = await fetch(`/api/emails/export?${params}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to export history");
    }

    return response.blob();
  }

  /**
   * Get schedule details
   */
  async getScheduleDetails(scheduleId: string): Promise<ScheduleData> {
    const response = await apiService.get<ApiResponse<ScheduleData>>(
      `/api/schedules/${scheduleId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get schedule details");
    }

    return response.data;
  }

  /**
   * Update schedule data
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<ScheduleData>
  ): Promise<ScheduleData> {
    const response = await apiService.put<ApiResponse<ScheduleData>>(
      `/api/schedules/${scheduleId}`,
      updates
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to update schedule");
    }

    return response.data;
  }
}

export const historyService = new HistoryService();
