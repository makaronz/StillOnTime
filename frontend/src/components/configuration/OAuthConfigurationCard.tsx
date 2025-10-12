/**
 * OAuth Configuration Card Component
 * Comprehensive OAuth settings management for Google OAuth2 integration
 */

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Unlink,
  TestTube,
  Mail,
  Calendar,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useOAuthStore } from "../../stores/oauthStore";
import { formatDistanceToNow } from "date-fns";

interface OAuthConfigurationCardProps {
  className?: string;
  onConnectionChange?: (connected: boolean) => void;
}

export const OAuthConfigurationCard: React.FC<
  OAuthConfigurationCardProps
> = ({ className = "", onConnectionChange }) => {
  const {
    oauthStatus,
    isLoading,
    isRefreshing,
    error,
    checkOAuthStatus,
    refreshToken,
    disconnectAccount,
    reconnectAccount,
    testConnection,
    clearError,
  } = useOAuthStore();

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load OAuth status on mount
  useEffect(() => {
    checkOAuthStatus();
  }, [checkOAuthStatus]);

  // Notify parent of connection changes
  useEffect(() => {
    if (onConnectionChange && oauthStatus) {
      onConnectionChange(oauthStatus.connected);
    }
  }, [oauthStatus?.connected, onConnectionChange]);

  // Handle manual token refresh
  const handleRefreshToken = async () => {
    try {
      await refreshToken();
      setTestResult({
        success: true,
        message: "Token refreshed successfully",
      });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      // Error is already set in store
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnectAccount();
      setShowDisconnectConfirm(false);
      setTestResult({
        success: true,
        message: "Account disconnected successfully",
      });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setShowDisconnectConfirm(false);
    }
  };

  // Handle reconnect
  const handleReconnect = async () => {
    try {
      const authUrl = await reconnectAccount();
      // Redirect to OAuth URL
      window.location.href = authUrl;
    } catch (error) {
      // Error is already set in store
    }
  };

  // Handle test connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const isConnected = await testConnection();
      setTestResult({
        success: isConnected,
        message: isConnected
          ? "Connection is working correctly"
          : "Connection test failed - please reconnect",
      });
      setTimeout(() => setTestResult(null), 5000);
    } catch (error) {
      setTestResult({
        success: false,
        message: "Connection test failed",
      });
      setTimeout(() => setTestResult(null), 5000);
    } finally {
      setTestingConnection(false);
    }
  };

  // Get status badge info
  const getStatusBadge = () => {
    if (!oauthStatus)
      return {
        icon: AlertCircle,
        color: "text-gray-600 bg-gray-50 border-gray-200",
        text: "Unknown",
      };

    if (oauthStatus.needsReauth) {
      return {
        icon: AlertCircle,
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
        text: "Re-authentication Required",
      };
    }

    if (oauthStatus.connected) {
      return {
        icon: CheckCircle,
        color: "text-green-600 bg-green-50 border-green-200",
        text: "Connected",
      };
    }

    return {
      icon: XCircle,
      color: "text-red-600 bg-red-50 border-red-200",
      text: "Disconnected",
    };
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  // Loading state
  if (isLoading && !oauthStatus) {
    return (
      <div
        className={`bg-white rounded-lg shadow p-6 flex items-center justify-center ${className}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-3 text-gray-600">Loading OAuth status...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 space-y-6 ${className}`}>
      {/* Header with Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Google OAuth Connection
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage your Google account integration for email and calendar access
          </p>
        </div>
        <div
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusBadge.color}`}
        >
          <StatusIcon className="h-4 w-4 mr-2" />
          {statusBadge.text}
        </div>
      </div>

      {/* Last Sync Time */}
      {oauthStatus?.lastSync && (
        <div className="text-xs text-gray-500">
          Last synced {formatDistanceToNow(oauthStatus.lastSync, { addSuffix: true })}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-800">Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800 text-sm ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Test Result Display */}
      {testResult && (
        <div
          className={`${
            testResult.success
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          } border rounded-lg p-4 flex items-start`}
        >
          {testResult.success ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          )}
          <p
            className={`text-sm ${
              testResult.success ? "text-green-700" : "text-yellow-700"
            }`}
          >
            {testResult.message}
          </p>
        </div>
      )}

      <div className="border-t border-gray-200 my-6" />

      {/* Account Information */}
      {oauthStatus?.connected && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Account Details</h4>
          <div className="flex items-start space-x-4">
            {/* Account Avatar */}
            <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="h-6 w-6 text-primary-600" />
            </div>

            {/* Account Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {oauthStatus.accountEmail || "No email"}
              </div>
              {oauthStatus.accountName && (
                <div className="text-xs text-gray-500 truncate">
                  {oauthStatus.accountName}
                </div>
              )}

              {/* Scopes */}
              {oauthStatus.scopes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {oauthStatus.scopes.some((s) => s.includes("gmail")) && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                      <Mail className="h-3 w-3 mr-1" />
                      Gmail
                    </span>
                  )}
                  {oauthStatus.scopes.some((s) => s.includes("calendar")) && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                      <Calendar className="h-3 w-3 mr-1" />
                      Calendar
                    </span>
                  )}
                  {oauthStatus.scopes.some((s) => s.includes("drive")) && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Drive
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Token Expiry */}
          {oauthStatus.tokenExpiry && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Token expires:</span>
                <span
                  className={`text-sm font-medium ${
                    new Date(oauthStatus.tokenExpiry).getTime() -
                      Date.now() <
                    24 * 60 * 60 * 1000
                      ? "text-yellow-600"
                      : "text-gray-900"
                  }`}
                >
                  {formatDistanceToNow(oauthStatus.tokenExpiry, {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className="text-sm text-primary-600 hover:text-primary-800 underline mt-2 disabled:opacity-50"
              >
                {isRefreshing ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Refreshing...
                  </span>
                ) : (
                  "Manually refresh token"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-gray-200 my-6" />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {oauthStatus?.connected ? (
          <>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || isLoading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 inline-flex items-center"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </button>

            {oauthStatus.needsReauth ? (
              <button
                onClick={handleReconnect}
                disabled={isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 inline-flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-authenticate
              </button>
            ) : null}

            <button
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={isLoading}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 inline-flex items-center"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleReconnect}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 inline-flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Connect Google Account
          </button>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Disconnect Google Account?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to disconnect your Google account? This will
              stop all email monitoring and calendar syncing. You can reconnect
              at any time.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Preferences Section (Future Feature - Disabled) */}
      <div className="border-t border-gray-200 my-6" />
      <div className="opacity-50 cursor-not-allowed">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Sync Preferences
          <span className="ml-2 text-xs text-gray-500 font-normal">
            (Coming Soon)
          </span>
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Gmail Sync</span>
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed opacity-50">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Calendar Integration</span>
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed opacity-50">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthConfigurationCard;
