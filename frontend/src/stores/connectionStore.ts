import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiService } from '@/services/api';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected: number | null;
  connectionAttempts: number;
  maxRetryAttempts: number;
  errorMessage: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  incrementConnectionAttempts: () => void;
  resetConnectionAttempts: () => void;
  checkConnection: () => Promise<void>;
}

const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 5;

export const useConnectionStore = create<ConnectionState>()(subscribeWithSelector(
  (set, get) => ({
    isConnected: false,
    isConnecting: false,
    lastConnected: null,
    connectionAttempts: 0,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    errorMessage: null,

    setConnected: (connected: boolean) => {
      set({
        isConnected: connected,
        isConnecting: false,
        lastConnected: connected ? Date.now() : null,
        errorMessage: connected ? null : get().errorMessage,
      });

      if (connected) {
        get().resetConnectionAttempts();
      }
    },

    setConnecting: (connecting: boolean) => {
      set({ isConnecting: connecting });
    },

    setError: (error: string | null) => {
      set({
        errorMessage: error,
        isConnected: false,
        isConnecting: false
      });
    },

    incrementConnectionAttempts: () => {
      const currentAttempts = get().connectionAttempts;
      set({ connectionAttempts: currentAttempts + 1 });
    },

    resetConnectionAttempts: () => {
      set({ connectionAttempts: 0 });
    },

    checkConnection: async () => {
      const { isConnected, isConnecting, connectionAttempts } = get();

      // Don't check if already connected or currently checking
      if (isConnected || isConnecting) {
        return;
      }

      // Don't exceed max retry attempts
      if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
        set({
          errorMessage: 'Unable to connect to server after multiple attempts. Please check your connection.',
          isConnecting: false
        });
        return;
      }

      set({ isConnecting: true, errorMessage: null });
      get().incrementConnectionAttempts();

      try {
        const isHealthy = await apiService.healthCheck();

        if (isHealthy) {
          get().setConnected(true);
        } else {
          throw new Error('Server health check failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to connect to server';

        get().setError(errorMessage);
      }
    },
  })
));

// Auto-check connection when the app starts
if (typeof window !== 'undefined') {
  // Initial connection check
  setTimeout(() => {
    useConnectionStore.getState().checkConnection();
  }, 1000);

  // Periodic connection checks
  setInterval(() => {
    const state = useConnectionStore.getState();
    if (!state.isConnected && !state.isConnecting) {
      state.checkConnection();
    }
  }, CONNECTION_CHECK_INTERVAL);

  // Check connection when window gains focus
  window.addEventListener('focus', () => {
    const state = useConnectionStore.getState();
    if (!state.isConnected && !state.isConnecting) {
      state.checkConnection();
    }
  });

  // Check connection when network comes back online
  window.addEventListener('online', () => {
    const state = useConnectionStore.getState();
    if (!state.isConnected && !state.isConnecting) {
      state.checkConnection();
    }
  });
}