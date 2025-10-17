import React from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

const ConnectionStatus: React.FC = () => {
  const {
    isConnected,
    isConnecting,
    connectionAttempts,
    checkConnection,
    maxRetryAttempts
  } = useConnectionStore();

  const handleRetry = () => {
    checkConnection();
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-sm">
        <Wifi className="w-4 h-4" />
        <span className="hidden sm:inline">Connected</span>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Connecting...</span>
        <span className="text-xs text-blue-600">
          ({connectionAttempts}/{maxRetryAttempts})
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-md text-sm">
      <WifiOff className="w-4 h-4" />
      <span className="hidden sm:inline">Disconnected</span>
      <button
        onClick={handleRetry}
        className={clsx(
          "p-1 hover:bg-red-100 rounded transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title="Retry connection"
        disabled={connectionAttempts >= maxRetryAttempts}
      >
        <RefreshCw className="w-3 h-3" />
      </button>
      {connectionAttempts >= maxRetryAttempts && (
        <span className="text-xs text-red-600">Max retries reached</span>
      )}
    </div>
  );
};

export default ConnectionStatus;