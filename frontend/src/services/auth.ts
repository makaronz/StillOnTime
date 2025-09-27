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
    const response = await apiService.get<{
      success: boolean;
      authUrl: string;
    }>("/api/auth/login");
    return {
      authUrl: response.authUrl,
      state: "", // State is handled by backend
    };
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<AuthResponse> {
    const response = await apiService.post<{
      success: boolean;
      user: User;
      token: string;
    }>("/api/auth/callback", {
      code,
      state,
    });
    return {
      token: response.token,
      user: response.user,
      expiresIn: 3600, // Default 1 hour
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthResponse> {
    const response = await apiService.post<{
      success: boolean;
      user: User;
      token: string;
    }>("/api/auth/refresh");
    return {
      token: response.token,
      user: response.user,
      expiresIn: 3600, // Default 1 hour
    };
  }

  /**
   * Validate current token
   */
  async validateToken(): Promise<ApiResponse<User>> {
    const response = await apiService.get<{
      isAuthenticated: boolean;
      user: User | null;
    }>("/api/auth/status");
    return {
      success: response.isAuthenticated,
      data: response.user ?? undefined,
      error: response.isAuthenticated ? undefined : "Not authenticated",
    };
  }

  /**
   * Logout and revoke tokens
   */
  async logout(): Promise<ApiResponse> {
    const response = await apiService.post<{
      success: boolean;
      message: string;
    }>("/api/auth/logout");
    return {
      success: response.success,
      message: response.message,
    };
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<User> {
    const response = await apiService.get<{ success: boolean; profile: User }>(
      "/api/auth/profile"
    );
    if (!response.success || !response.profile) {
      throw new Error("Failed to get user profile");
    }
    return response.profile;
  }
}

export const authService = new AuthService();
