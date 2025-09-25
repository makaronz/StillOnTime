import { ProcessedEmail } from '@/types'
import { Mail, CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '@/components/LoadingSpinner'

interface RecentActivityCardProps {
  recentActivity: ProcessedEmail[]
  isLoading: boolean
  onRetryEmail: (emailId: string) => void
}

export default function RecentActivityCard({ 
  recentActivity, 
  isLoading, 
  onRetryEmail 
}: RecentActivityCardProps): JSX.Element {
  const getStatusIcon = (status: ProcessedEmail['processingStatus']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Mail className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: ProcessedEmail['processingStatus']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'processing':
        return 'text-blue-600'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = (status: ProcessedEmail['processingStatus']) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'processing':
        return 'Processing'
      case 'pending':
        return 'Pending'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>

      {isLoading ? (
        <LoadingSpinner size="sm" text="Loading activity..." />
      ) : recentActivity.length > 0 ? (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {recentActivity.map((email) => (
            <div key={email.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(email.processingStatus)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {email.subject}
                  </p>
                  <span className={`text-xs font-medium ${getStatusColor(email.processingStatus)}`}>
                    {getStatusText(email.processingStatus)}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 truncate">
                  From: {email.sender}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </p>
                  
                  {email.processingStatus === 'failed' && (
                    <button
                      onClick={() => onRetryEmail(email.id)}
                      className="flex items-center text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </button>
                  )}
                </div>
                
                {email.error && (
                  <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                    {email.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">No recent email processing activity</p>
        </div>
      )}
    </div>
  )
}