import React from 'react';
import { Loader2, Wifi, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface ReconnectingScreenProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
  className?: string;
}

const ReconnectingScreen: React.FC<ReconnectingScreenProps> = ({
  message = 'Reconnecting to server...',
  showProgress = false,
  progress = 0,
  className = ''
}) => {
  return (
    <div className={clsx(
      "flex flex-col items-center justify-center min-h-screen p-8",
      "bg-gradient-to-br from-blue-50 to-indigo-100",
      className
    )}>
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* Animated Icons */}
        <div className="relative flex justify-center mb-6">
          <div className="animate-pulse">
            <Wifi className="w-16 h-16 text-blue-500" />
          </div>
          <div className="absolute -top-2 -right-2">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Reconnecting
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {message}
        </p>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {Math.round(progress)}% Complete
            </p>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex justify-center space-x-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Network Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span>Connecting</span>
          </div>
        </div>

        {/* Helpful Tips */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-left text-sm text-blue-800">
              <p className="font-semibold mb-1">Connection Tips:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Check your internet connection</li>
                <li>• Wait a moment and try again</li>
                <li>• Refresh the page if needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconnectingScreen;