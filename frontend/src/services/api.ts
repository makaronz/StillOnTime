import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { retryWithBackoff } from "@/utils/retryWithBackoff";
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
    // Request interceptor to add auth token and update connection status
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Update connection status when making requests
        const connectionStore = useConnectionStore.getState();
        if (!connectionStore.isConnected && !connectionStore.isConnecting) {
          connectionStore.checkConnection();
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and connection status
    this.client.interceptors.response.use(
      (response) => {
        // Mark as connected on successful response
        useConnectionStore.getState().setConnected(true);
        return response;
      },
      async (error: unknown) => {
        if (!isAxiosErrorLike(error)) {
          useConnectionStore.getState().setError('An unexpected error occurred');
          return Promise.reject(error);
        }

        const { response, code } = error;

        // Update connection status based on error
        if (code === "NETWORK_ERROR" || !response) {
          useConnectionStore.getState().setError('Network error. Please check your connection.');
        } else if (response?.status && response.status >= 500) {
          useConnectionStore.getState().setError('Server is temporarily unavailable.');
        } else if (response?.status === 401) {
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
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic API methods with retry logic
  async get<T>(url: string, retry = true): Promise<T> {
    const makeRequest = () => this.client.get<T>(url);

    if (retry) {
      const response = await retryWithBackoff(async () => {
        const result = await makeRequest();
        return result;
      }, {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED', 'ECONNREFUSED'],
        onRetry: (attempt, error) => {
          console.log(`Retrying GET request to ${url} (attempt ${attempt})`, error);
        }
      });
      return response.data;
    }

    const response = await makeRequest();
    return response.data;
  }

  async post<T>(url: string, data?: unknown, retry = true): Promise<T> {
    const makeRequest = () => this.client.post<T>(url, data);

    if (retry) {
      const response = await retryWithBackoff(async () => {
        const result = await makeRequest();
        return result;
      }, {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED', 'ECONNREFUSED'],
        onRetry: (attempt, error) => {
          console.log(`Retrying POST request to ${url} (attempt ${attempt})`, error);
        }
      });
      return response.data;
    }

    const response = await makeRequest();
    return response.data;
  }

  async put<T>(url: string, data?: unknown, retry = true): Promise<T> {
    const makeRequest = () => this.client.put<T>(url, data);

    if (retry) {
      const response = await retryWithBackoff(async () => {
        const result = await makeRequest();
        return result;
      }, {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED', 'ECONNREFUSED'],
        onRetry: (attempt, error) => {
          console.log(`Retrying PUT request to ${url} (attempt ${attempt})`, error);
        }
      });
      return response.data;
    }

    const response = await makeRequest();
    return response.data;
  }

  async delete<T>(url: string, retry = true): Promise<T> {
    const makeRequest = () => this.client.delete<T>(url);

    if (retry) {
      const response = await retryWithBackoff(async () => {
        const result = await makeRequest();
        return result;
      }, {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED', 'ECONNREFUSED'],
        onRetry: (attempt, error) => {
          console.log(`Retrying DELETE request to ${url} (attempt ${attempt})`, error);
        }
      });
      return response.data;
    }

    const response = await makeRequest();
    return response.data;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export both the class instance and the service
export const apiService = new ApiService();
export { apiService as api };
export default apiService;
