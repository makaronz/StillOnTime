import { useState } from 'react'
import { ApiConnectionStatus } from '@/services/configuration'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  TestTube,
  Mail,
  Calendar,
  Map,
  Cloud
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '@/components/LoadingSpinner'

interface ApiConnectionCardProps {
  connectionStatus: ApiConnectionStatus | null
  isLoading: boolean
  onTestConnection: (service: 'gmail' | 'calendar' | 'maps' | 'weather') => Promise<boolean>
  onRefresh: () => Promise<void>
}

export default function ApiConnectionCard({
  connectionStatus,
  isLoading,
  onTestConnection,
  onRefresh,
}: ApiConnectionCardProps): JSX.Element {
  const [testingServices, setTestingServices] = useState<Set<string>>(new Set())

  const handleTestConnection = async (service: 'gmail' | 'calendar' | 'maps' | 'weather') => {
    setTestingServices(prev => new Set(prev).add(service))
    try {
      await onTestConnection(service)
    } finally {
      setTestingServices(prev => {
        const newSet = new Set(prev)
        newSet.delete(service)
        return newSet
      })
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'gmail':
        return <Mail className="h-5 w-5" />
      case 'calendar':
        return <Calendar className="h-5 w-5" />
      case 'maps':
        return <Map className="h-5 w-5" />
      case 'weather':
        return <Cloud className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  const getStatusIcon = (connected: boolean) => {
    return connected ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  }

  const getStatusColor = (connected: boolean) => {
    return connected ? 'text-green-600' : 'text-red-600'
  }

  const getServiceName = (service: string) => {
    switch (service) {
      case 'gmail':
        return 'Gmail API'
      case 'calendar':
        return 'Google Calendar'
      case 'maps':
        return 'Google Maps'
      case 'weather':
        return 'Weather API'
      default:
        return service
    }
  }

  const getServiceDescription = (service: string) => {
    switch (service) {
      case 'gmail':
        return 'Email monitoring and processing'
      case 'calendar':
        return 'Calendar event creation and management'
      case 'maps':
        return 'Route calculation and address validation'
      case 'weather':
        return 'Weather forecasts and warnings'
      default:
        return 'Service connection'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">API Connection Status</h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" text="Checking connections..." />
      ) : connectionStatus ? (
        <div className="space-y-4">
          {Object.entries(connectionStatus).map(([service, status]) => (
            <div key={service} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 mt-0.5 ${getStatusColor(status.connected)}`}>
                    {getServiceIcon(service)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {getServiceName(service)}
                      </h4>
                      {getStatusIcon(status.connected)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {getServiceDescription(service)}
                    </p>
                    
                    {status.lastCheck && (
                      <p className="text-xs text-gray-400 mt-2">
                        Last checked: {formatDistanceToNow(status.lastCheck, { addSuffix: true })}
                      </p>
                    )}
                    
                    {status.error && (
                      <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded">
                        {status.error}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleTestConnection(service as 'gmail' | 'calendar' | 'maps' | 'weather')}
                  disabled={testingServices.has(service)}
                  className="flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded transition-colors disabled:opacity-50"
                >
                  {testingServices.has(service) ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-1" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-3 w-3 mr-1" />
                      Test
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Overall Status Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Overall Status:</span>
              <div className="flex items-center space-x-2">
                {Object.values(connectionStatus).every(status => status.connected) ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600">All services connected</span>
                  </>
                ) : Object.values(connectionStatus).some(status => status.connected) ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-600">Some services disconnected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">All services disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Unable to load connection status</p>
        </div>
      )}
    </div>
  )
}