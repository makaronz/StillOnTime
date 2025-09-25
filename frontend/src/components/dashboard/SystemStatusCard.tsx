import { SystemStatus } from '@/types'
import { CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

interface SystemStatusCardProps {
  systemStatus: SystemStatus | null
  isLoading: boolean
  onRefresh: () => void
}

export default function SystemStatusCard({ 
  systemStatus, 
  isLoading, 
  onRefresh 
}: SystemStatusCardProps): JSX.Element {
  const getStatusIcon = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'All systems operational'
      case 'degraded':
        return 'Some services degraded'
      case 'down':
        return 'System issues detected'
      default:
        return 'Status unknown'
    }
  }

  const getStatusColor = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" text="Checking status..." />
      ) : systemStatus ? (
        <div className="space-y-4">
          <div className="flex items-center">
            {getStatusIcon(systemStatus.status)}
            <span className={`ml-2 text-sm font-medium ${getStatusColor(systemStatus.status)}`}>
              {getStatusText(systemStatus.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Database</span>
              <div className={`h-2 w-2 rounded-full ${systemStatus.services.database ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Redis</span>
              <div className={`h-2 w-2 rounded-full ${systemStatus.services.redis ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Gmail</span>
              <div className={`h-2 w-2 rounded-full ${systemStatus.services.gmail ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Calendar</span>
              <div className={`h-2 w-2 rounded-full ${systemStatus.services.calendar ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Weather</span>
              <div className={`h-2 w-2 rounded-full ${systemStatus.services.weather ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Last checked: {new Date(systemStatus.lastCheck).toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          Unable to load system status
        </div>
      )}
    </div>
  )
}