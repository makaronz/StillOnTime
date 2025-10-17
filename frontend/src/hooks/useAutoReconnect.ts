import { useEffect, useRef } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { apiService } from '@/services/api';

interface UseAutoReconnectOptions {
  enabled?: boolean;
  interval?: number;
  maxRetries?: number;
  onReconnect?: () => void;
  onReconnectFailed?: (error: Error) => void;
}

/**
 * Hook for automatic reconnection logic
 *
 * Features:
 * - Periodic connection checks
 * - Automatic reconnection with exponential backoff
 * - Re-authentication after reconnection
 * - Customizable retry logic
 */
export const useAutoReconnect = ({
  enabled = true,
  interval = 30000, // 30 seconds
  maxRetries = 5,
  onReconnect,
  onReconnectFailed
}: UseAutoReconnectOptions = {}) => {
  const {
    isConnected,
    isConnecting,
    connectionAttempts
  } = useConnectionStore();

  const { isAuthenticated, token } = useAuthStore();
  const intervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up periodic connection checks
    intervalRef.current = setInterval(() => {
      if (!isConnected && !isConnecting && connectionAttempts < maxRetries) {
        attemptReconnection();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, isConnected, isConnecting, connectionAttempts, maxRetries]);

  // Attempt reconnection when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && !isConnecting) {
        attemptReconnection();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, isConnecting]);

  // Attempt reconnection when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected && !isConnecting) {
        attemptReconnection();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isConnected, isConnecting]);

  const attemptReconnection = async () => {
    if (isConnecting || isConnected) {
      return;
    }

    reconnectAttemptsRef.current++;

    try {
      // First check basic connectivity
      await retryWithBackoff(
        async () => {
          const isHealthy = await apiService.healthCheck();
          if (!isHealthy) {
            throw new Error('Health check failed');
          }
          return true;
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          onRetry: (attempt, error) => {
            console.log(`Reconnection attempt ${attempt}`, error);
          }
        }
      );

      // If authenticated, verify authentication
      if (isAuthenticated && token) {
        await retryWithBackoff(
          async () => {
            const response = await apiService.get('/api/auth/status', false) as any;
            if (!response.isAuthenticated) {
              throw new Error('Authentication failed');
            }
            return response;
          },
          {
            maxAttempts: 2,
            initialDelay: 500,
            maxDelay: 2000
          }
        );
      }

      // Reset reconnection attempts on success
      reconnectAttemptsRef.current = 0;

      // Call success callback
      if (onReconnect) {
        onReconnect();
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Reconnection failed');

      // Call failure callback
      if (onReconnectFailed) {
        onReconnectFailed(err);
      }

      console.error('Auto-reconnection failed:', err);

      // If we've exceeded max retries, stop trying
      if (reconnectAttemptsRef.current >= maxRetries) {
        console.log('Max reconnection attempts reached, stopping auto-reconnect');
      }
    }
  };

  const manualReconnect = () => {
    reconnectAttemptsRef.current = 0;
    attemptReconnection();
  };

  return {
    attemptReconnection,
    manualReconnect,
    reconnectionAttempts: reconnectAttemptsRef.current,
    canReconnect: !isConnecting && !isConnected && reconnectAttemptsRef.current < maxRetries
  };
};

export default useAutoReconnect;