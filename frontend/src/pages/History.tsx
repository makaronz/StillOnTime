import { useState } from 'react'
import { useHistory } from '@/hooks/useHistory'
import { historyService } from '@/services/history'
import HistoryFilters from '@/components/history/HistoryFilters'
import EmailHistoryTable from '@/components/history/EmailHistoryTable'
import AnalyticsCharts from '@/components/history/AnalyticsCharts'
import EmailDetailsModal from '@/components/history/EmailDetailsModal'
import Pagination from '@/components/history/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'
import { DetailedProcessedEmail } from '@/services/history'
import { ScheduleData } from '@/types'
import { AlertCircle, BarChart3, History as HistoryIcon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function History(): JSX.Element {
  const {
    emails,
    analytics,
    pagination,
    isLoading,
    isLoadingAnalytics,
    error,
    filters,
    setFilters,
    loadPage,
    refreshData,
    retryEmail,
    deleteEmail,
    exportHistory,
    loadAnalytics,
  } = useHistory()

  const [selectedEmail, setSelectedEmail] = useState<DetailedProcessedEmail | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const handleUpdateSchedule = async (scheduleId: string, updates: Partial<ScheduleData>) => {
    try {
      await historyService.updateSchedule(scheduleId, updates)
      toast.success('Schedule updated successfully')
      await refreshData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update schedule'
      toast.error(errorMessage)
      throw err
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processing History</h1>
          <p className="text-gray-600">View your email processing history and analytics</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading history</h3>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processing History</h1>
          <p className="text-gray-600">View your email processing history and analytics</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              showAnalytics
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </button>
        </div>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Analytics Overview</h2>
            <button
              onClick={() => loadAnalytics()}
              disabled={isLoadingAnalytics}
              className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {isLoadingAnalytics ? 'Refreshing...' : 'Refresh Analytics'}
            </button>
          </div>
          
          <AnalyticsCharts 
            analytics={analytics} 
            isLoading={isLoadingAnalytics} 
          />
        </div>
      )}

      {/* Filters */}
      <HistoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        onExport={exportHistory}
        onRefresh={refreshData}
        isLoading={isLoading}
      />

      {/* History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HistoryIcon className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Email Processing History</h2>
          </div>
          
          {pagination && (
            <div className="text-sm text-gray-500">
              {pagination.total} total emails
            </div>
          )}
        </div>

        <EmailHistoryTable
          emails={emails}
          isLoading={isLoading}
          onRetry={retryEmail}
          onDelete={deleteEmail}
          onViewDetails={setSelectedEmail}
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={loadPage}
          />
        )}
      </div>

      {/* Email Details Modal */}
      <EmailDetailsModal
        email={selectedEmail}
        isOpen={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onRetry={retryEmail}
        onUpdateSchedule={handleUpdateSchedule}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
          <LoadingSpinner size="sm" text="Loading..." />
        </div>
      )}
    </div>
  )
}