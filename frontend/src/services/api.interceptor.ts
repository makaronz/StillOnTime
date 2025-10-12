/**
 * API Request Interceptor
 * Adds CSRF tokens to all non-GET requests automatically
 */

import { addCsrfTokenToHeaders } from "@/utils/csrf";

/**
 * Enhance fetch with CSRF token injection
 * This wrapper automatically adds CSRF tokens to POST, PUT, DELETE, PATCH requests
 */
export const secureFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const method = options.method?.toUpperCase() || "GET";

  // Only add CSRF token for state-changing methods
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const headers = options.headers as Record<string, string> || {};
    const enhancedHeaders = await addCsrfTokenToHeaders(headers);

    options.headers = {
      ...enhancedHeaders,
      "Content-Type": "application/json",
      ...options.headers, // Allow override
    };
  }

  // Always include credentials for cookies
  options.credentials = options.credentials || "include";

  return fetch(url, options);
};

/**
 * Example API service using secure fetch
 */
export const apiService = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API GET error: ${response.statusText}`);
    }

    return response.json();
  },

  post: async <T>(url: string, data: unknown): Promise<T> => {
    const response = await secureFetch(url, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("CSRF token validation failed. Please refresh the page.");
      }
      throw new Error(`API POST error: ${response.statusText}`);
    }

    return response.json();
  },

  put: async <T>(url: string, data: unknown): Promise<T> => {
    const response = await secureFetch(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("CSRF token validation failed. Please refresh the page.");
      }
      throw new Error(`API PUT error: ${response.statusText}`);
    }

    return response.json();
  },

  delete: async <T>(url: string): Promise<T> => {
    const response = await secureFetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("CSRF token validation failed. Please refresh the page.");
      }
      throw new Error(`API DELETE error: ${response.statusText}`);
    }

    return response.json();
  },
};

