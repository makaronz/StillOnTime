import { useDashboard } from '@/hooks/useDashboard'
import SystemStatusCard from '@/components/dashboard/SystemStatusCard'
import RecentActivityCard from '@/components/dashboard/RecentActivityCard'
import UpcomingSchedulesCard from '@/components/dashboard/UpcomingSchedulesCard'
import ProcessingControlCard from '@/components/dashboard/ProcessingControlCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { SetupStatusWidget } from '@/components/dashboard/SetupStatusWidget'
import { InitializationCheck } from '@/components/setup/InitializationCheck'
import { AlertCircle } from 'lucide-react'

export default function Dashboard(): JSX.Element {
  const {
    systemStatus,
    recentActivity,
    upcomingSchedules,
    processingStats,
    isLoading,
    error,
    refreshData,
    triggerProcessing,
    retryEmail,
  } = useDashboard()

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Monitor your film schedule automation system</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
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
    <InitializationCheck showSetupPrompt={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Monitor your film schedule automation system</p>
        </div>

        {/* Setup Status Widget */}
        <SetupStatusWidget />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <SystemStatusCard
          systemStatus={systemStatus}
          isLoading={isLoading}
          onRefresh={refreshData}
        />

        {/* Processing Control */}
        <ProcessingControlCard
          processingStats={processingStats}
          isLoading={isLoading}
          onTriggerProcessing={triggerProcessing}
          onRefresh={refreshData}
        />

        {/* Upcoming Schedules Preview */}
        <div className="lg:row-span-2">
          <UpcomingSchedulesCard
            upcomingSchedules={upcomingSchedules}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Recent Activity - Full Width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <RecentActivityCard
            recentActivity={recentActivity}
            isLoading={isLoading}
            onRetryEmail={retryEmail}
          />
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
          <LoadingSpinner size="sm" text="Refreshing..." />
        </div>
      )}
      </div>
    </InitializationCheck>
  )
}