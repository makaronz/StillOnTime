import React from 'react';
import { AlertTriangle, Wifi, RefreshCw, Home } from 'lucide-react';
import { useConnectionStore } from '@/stores/connectionStore';
import { clsx } from 'clsx';

interface NetworkErrorProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  showHomeButton?: boolean;
  onRetry?: () => void;
  className?: string;
}

const NetworkError: React.FC<NetworkErrorProps> = ({
  title = 'Connection Error',
  message,
  showRetry = true,
  showHomeButton = true,
  onRetry,
  className = ''
}) => {
  const {
    isConnected,
    isConnecting,
    errorMessage,
    connectionAttempts,
    checkConnection,
    maxRetryAttempts
  } = useConnectionStore();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      checkConnection();
    }
  };

  // Don't show if connected
  if (isConnected) {
    return null;
  }

  const displayMessage = message || errorMessage || 'Unable to connect to the server. Please check your internet connection and try again.';

  return (
    <div className={clsx(
      "flex flex-col items-center justify-center p-8 text-center",
      "bg-white rounded-lg shadow-lg border border-gray-200",
      "max-w-md mx-auto",
      className
    )}>
      <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
        <Wifi className="w-8 h-8 text-red-600" />
      </div>

      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h2>

      <p className="text-gray-600 mb-6 leading-relaxed">
        {displayMessage}
      </p>

      {connectionAttempts > 0 && (
        <div className="text-sm text-gray-500 mb-4">
          Connection attempts: {connectionAttempts}/{maxRetryAttempts}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {showRetry && (
          <button
            onClick={handleRetry}
            disabled={isConnecting || connectionAttempts >= maxRetryAttempts}
            className={clsx(
              "inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors",
              "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            )}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </>
            )}
          </button>
        )}

        {showHomeButton && (
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-500">
        {isConnecting && 'Attempting to establish connection...'}
        {!isConnecting && connectionAttempts >= maxRetryAttempts && 'Maximum retry attempts reached. Please refresh the page or check your connection.'}
      </div>
    </div>
  );
};

export default NetworkError;