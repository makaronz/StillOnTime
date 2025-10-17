import React, { useEffect } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import ConnectionStatus from './ConnectionStatus';
import { AlertTriangle, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';

interface NetworkAwareAppProps {
  children: React.ReactNode;
}

const NetworkAwareApp: React.FC<NetworkAwareAppProps> = ({ children }) => {
  const {
    isConnected,
    isConnecting,
    errorMessage,
    checkConnection
  } = useConnectionStore();

  useEffect(() => {
    // Show toast notification when connection is lost
    if (!isConnected && !isConnecting && errorMessage) {
      toast.error(
        () => (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        ),
        {
          duration: 5000,
          id: 'connection-error', // Prevent duplicate toasts
        }
      );
    }

    // Show success notification when connection is restored
    if (isConnected) {
      toast.dismiss('connection-error');
      toast.success(
        () => (
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>Connection restored</span>
          </div>
        ),
        {
          duration: 3000,
          id: 'connection-restored',
        }
      );
    }
  }, [isConnected, isConnecting, errorMessage]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      toast.error('You are offline. Please check your internet connection.', {
        duration: 5000,
        id: 'offline-notification',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return (
    <div className="relative">
      {/* Connection Status Banner */}
      <div className="fixed top-4 right-4 z-50">
        <ConnectionStatus />
      </div>

      {/* Main Content */}
      <div className={clsx(
        "transition-opacity duration-300",
        !isConnected && !isConnecting && "opacity-75"
      )}>
        {children}
      </div>

      {/* Connection Overlay */}
      {!isConnected && !isConnecting && (
        <div className="fixed inset-0 bg-black bg-opacity-10 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4 text-center pointer-events-auto">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Connection Lost
            </h3>
            <p className="text-gray-600 mb-4">
              {errorMessage || 'Unable to connect to the server. Some features may not work properly.'}
            </p>
            <button
              onClick={checkConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for className conditional logic
function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default NetworkAwareApp;