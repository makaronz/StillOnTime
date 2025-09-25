import { useAuthStore } from "@/stores/authStore";
import { User } from "@/types";

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User, expiresIn?: number) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
}

/**
 * Custom hook for authentication state and actions
 */
export function useAuth(): UseAuthReturn {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
    refreshToken,
    startGoogleLogin,
    handleOAuthCallback,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
    refreshToken,
    startGoogleLogin,
    handleOAuthCallback,
  };
}

/**
 * Hook to check if user has specific permissions
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuthStore();

  const hasPermission = (_permission: string): boolean => {
    if (!isAuthenticated || !user) return false;
    // Add permission logic here if needed
    return true;
  };

  const isAdmin = (): boolean => {
    if (!isAuthenticated || !user) return false;
    // Add admin check logic here if needed
    return false;
  };

  return {
    hasPermission,
    isAdmin,
  };
}
