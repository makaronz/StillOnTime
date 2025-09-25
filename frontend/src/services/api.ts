import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";

const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string) || "http://localhost:3001";

class ApiService {
  private client: ReturnType<typeof axios.create>;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: any) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          const { isAuthenticated } = useAuthStore.getState();
          if (isAuthenticated) {
            useAuthStore.getState().logout();
            toast.error("Session expired. Please log in again.");
            // Only redirect if not already on login page
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
        } else if (error.response?.status === 403) {
          toast.error(
            "Access denied. You don't have permission for this action."
          );
        } else if (error.response?.status >= 500) {
          toast.error("Server error. Please try again later.");
        } else if (error.code === "NETWORK_ERROR" || !error.response) {
          toast.error("Network error. Please check your connection.");
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic API methods
  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiService = new ApiService();
