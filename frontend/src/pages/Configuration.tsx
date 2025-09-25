import { useConfiguration } from '@/hooks/useConfiguration'
import AddressConfigCard from '@/components/configuration/AddressConfigCard'
import TimeBufferConfigCard from '@/components/configuration/TimeBufferConfigCard'
import NotificationConfigCard from '@/components/configuration/NotificationConfigCard'
import ApiConnectionCard from '@/components/configuration/ApiConnectionCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function Configuration(): JSX.Element {
  const {
    config,
    connectionStatus,
    isLoading,
    isSaving,
    error,
    updateConfig,
    validateAddress,
    testConnection,
    refreshConnectionStatus,
    resetConfig,
    refreshData,
  } = useConfiguration()

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
          <p className="text-gray-600">Manage your system settings and preferences</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading configuration</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={refreshData}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
          <p className="text-gray-600">Manage your system settings and preferences</p>
        </div>

        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading configuration..." />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
          <p className="text-gray-600">Manage your system settings and preferences</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={resetConfig}
            disabled={isSaving}
            className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </button>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Address Configuration */}
        <div className="lg:col-span-2">
          <AddressConfigCard
            homeAddress={config.homeAddress}
            panavisionAddress={config.panavisionAddress}
            onUpdate={updateConfig}
            onValidateAddress={validateAddress}
            isSaving={isSaving}
          />
        </div>

        {/* Time Buffer Configuration */}
        <TimeBufferConfigCard
          buffers={config.buffers}
          onUpdate={updateConfig}
          isSaving={isSaving}
        />

        {/* Notification Configuration */}
        <NotificationConfigCard
          notifications={config.notifications}
          onUpdate={updateConfig}
          isSaving={isSaving}
        />

        {/* API Connection Status */}
        <div className="lg:col-span-2">
          <ApiConnectionCard
            connectionStatus={connectionStatus}
            isLoading={isLoading}
            onTestConnection={testConnection}
            onRefresh={refreshConnectionStatus}
          />
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Configuration Help</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Addresses:</strong> Used to calculate optimal routes. The system calculates: Home → Panavision → Shooting Location.
          </p>
          <p>
            <strong>Time Buffers:</strong> Added to travel time to calculate wake-up time. Adjust based on your preferences and typical conditions.
          </p>
          <p>
            <strong>Notifications:</strong> Choose how you want to receive alerts and summaries. Email is recommended for detailed information.
          </p>
          <p>
            <strong>API Connections:</strong> All services must be connected for full functionality. Test connections if you experience issues.
          </p>
        </div>
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
          <LoadingSpinner size="sm" text="Saving..." />
        </div>
      )}
    </div>
  )
}