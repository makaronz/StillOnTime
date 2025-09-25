import { apiService } from "./api";
import { User, ApiResponse } from "@/types";

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface OAuthUrlResponse {
  authUrl: string;
  state: string;
}

class AuthService {
  /**
   * Get Google OAuth 2.0 authorization URL
   */
  async getGoogleAuthUrl(): Promise<OAuthUrlResponse> {
    return apiService.get<OAuthUrlResponse>("/api/auth/google/url");
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<AuthResponse> {
    return apiService.post<AuthResponse>("/api/auth/google/callback", {
      code,
      state,
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthResponse> {
    return apiService.post<AuthResponse>("/api/auth/refresh");
  }

  /**
   * Validate current token
   */
  async validateToken(): Promise<ApiResponse<User>> {
    return apiService.get<ApiResponse<User>>("/api/auth/me");
  }

  /**
   * Logout and revoke tokens
   */
  async logout(): Promise<ApiResponse> {
    return apiService.post<ApiResponse>("/api/auth/logout");
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<User> {
    const response = await apiService.get<ApiResponse<User>>("/api/auth/me");
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get user profile");
    }
    return response.data;
  }
}

export const authService = new AuthService();
