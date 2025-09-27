import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";

const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string) || "http://localhost:3001";

interface AxiosErrorLike {
  response?: {
    status?: number;
  } | null;
  code?: string;
}

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const potentialError = error as Partial<AxiosErrorLike>;
  return (
    typeof potentialError.response === "object" ||
    typeof potentialError.code === "string"
  );
};

class ApiService {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  constructor() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (!isAxiosErrorLike(error)) {
          return Promise.reject(error);
        }

        const { response, code } = error;

        if (response?.status === 401) {
          const { isAuthenticated } = useAuthStore.getState();
          if (isAuthenticated) {
            useAuthStore.getState().logout();
            toast.error("Session expired. Please log in again.");
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
        } else if (response?.status === 403) {
          toast.error(
            "Access denied. You don't have permission for this action."
          );
        } else if (response?.status && response.status >= 500) {
          toast.error("Server error. Please try again later.");
        } else if (code === "NETWORK_ERROR" || !response) {
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

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiService = new ApiService();
export const api = apiService;
