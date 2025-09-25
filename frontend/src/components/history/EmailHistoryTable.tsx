import { useState } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  MoreVertical,
  Eye,
  RotateCcw,
  Trash2,
  Calendar,
  MapPin
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { DetailedProcessedEmail } from '@/services/history'
import LoadingSpinner from '@/components/LoadingSpinner'

interface EmailHistoryTableProps {
  emails: DetailedProcessedEmail[]
  isLoading: boolean
  onRetry: (emailId: string) => void
  onDelete: (emailId: string) => void
  onViewDetails: (email: DetailedProcessedEmail) => void
}

export default function EmailHistoryTable({
  emails,
  isLoading,
  onRetry,
  onDelete,
  onViewDetails,
}: EmailHistoryTableProps): JSX.Element {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const getStatusIcon = (status: DetailedProcessedEmail['processingStatus']) => {
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

  const getStatusBadge = (status: DetailedProcessedEmail['processingStatus']) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full"
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`
      case 'processing':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const handleDropdownToggle = (emailId: string) => {
    setActiveDropdown(activeDropdown === emailId ? null : emailId)
  }

  const handleAction = (action: string, email: DetailedProcessedEmail) => {
    setActiveDropdown(null)
    
    switch (action) {
      case 'view':
        onViewDetails(email)
        break
      case 'retry':
        onRetry(email.id)
        break
      case 'delete':
        if (window.confirm('Are you sure you want to delete this email from history?')) {
          onDelete(email.id)
        }
        break
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingSpinner size="lg" text="Loading email history..." />
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
          <p className="text-gray-500">
            No email processing history matches your current filters.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Processed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(email.processingStatus)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {email.subject}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        From: {email.sender}
                      </p>
                      <p className="text-xs text-gray-400">
                        Received: {format(new Date(email.receivedAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <span className={getStatusBadge(email.processingStatus)}>
                      {email.processingStatus}
                    </span>
                    {email.processingTime && (
                      <p className="text-xs text-gray-500">
                        {email.processingTime}s processing time
                      </p>
                    )}
                    {email.retryCount && email.retryCount > 0 && (
                      <p className="text-xs text-yellow-600">
                        {email.retryCount} retries
                      </p>
                    )}
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  {email.schedule ? (
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(email.schedule.shootingDate), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {email.schedule.callTime}
                      </div>
                      <div className="flex items-center text-sm text-gray-500 truncate">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{email.schedule.location}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">No schedule data</span>
                  )}
                </td>
                
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </p>
                  {email.error && (
                    <p className="text-xs text-red-600 mt-1 truncate" title={email.error}>
                      Error: {email.error}
                    </p>
                  )}
                </td>
                
                <td className="px-6 py-4">
                  <div className="relative">
                    <button
                      onClick={() => handleDropdownToggle(email.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    
                    {activeDropdown === email.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleAction('view', email)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </button>
                          
                          {email.processingStatus === 'failed' && (
                            <button
                              onClick={() => handleAction('retry', email)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Retry Processing
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleAction('delete', email)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}