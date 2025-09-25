import { useState } from 'react'
import { Play, RefreshCw, BarChart3 } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

interface ProcessingStats {
  totalProcessed: number
  successRate: number
  lastProcessed: Date | null
  pendingCount: number
}

interface ProcessingControlCardProps {
  processingStats: ProcessingStats | null
  isLoading: boolean
  onTriggerProcessing: () => Promise<void>
  onRefresh: () => void
}

export default function ProcessingControlCard({ 
  processingStats, 
  isLoading, 
  onTriggerProcessing,
  onRefresh
}: ProcessingControlCardProps): JSX.Element {
  const [isTriggering, setIsTriggering] = useState(false)

  const handleTriggerProcessing = async () => {
    setIsTriggering(true)
    try {
      await onTriggerProcessing()
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Processing Control</h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" text="Loading stats..." />
      ) : (
        <div className="space-y-4">
          {/* Processing Statistics */}
          {processingStats && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {processingStats.totalProcessed}
                </div>
                <div className="text-xs text-gray-500">Total Processed</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(processingStats.successRate)}%
                </div>
                <div className="text-xs text-gray-500">Success Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {processingStats.pendingCount}
                </div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-600">
                  {processingStats.lastProcessed 
                    ? processingStats.lastProcessed.toLocaleString()
                    : 'Never'
                  }
                </div>
                <div className="text-xs text-gray-500">Last Processed</div>
              </div>
            </div>
          )}

          {/* Manual Processing Trigger */}
          <div className="space-y-3">
            <button
              onClick={handleTriggerProcessing}
              disabled={isTriggering}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTriggering ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger Email Processing
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Manually check for new schedule emails and process them
            </p>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Actions</h4>
            <div className="grid grid-cols-1 gap-2">
              <button className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Detailed Analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}