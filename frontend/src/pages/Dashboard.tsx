import { useDashboard } from '@/hooks/useDashboard'
import SystemStatusCard from '@/components/dashboard/SystemStatusCard'
import RecentActivityCard from '@/components/dashboard/RecentActivityCard'
import UpcomingSchedulesCard from '@/components/dashboard/UpcomingSchedulesCard'
import ProcessingControlCard from '@/components/dashboard/ProcessingControlCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { SetupStatusWidget } from '@/components/dashboard/SetupStatusWidget'
import { InitializationCheck } from '@/components/setup/InitializationCheck'
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Clock3,
  MailCheck,
  RefreshCw,
} from 'lucide-react'

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

  const healthyServicesCount = systemStatus
    ? Object.values(systemStatus.services).filter(Boolean).length
    : 0

  const totalServices = systemStatus
    ? Object.values(systemStatus.services).length
    : 5

  const statusTone =
    systemStatus?.status === 'healthy'
      ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-200/30'
      : systemStatus?.status === 'degraded'
        ? 'bg-amber-500/20 text-amber-100 ring-amber-200/30'
        : 'bg-rose-500/20 text-rose-100 ring-rose-200/30'

  const kpis = [
    {
      label: 'Upcoming Schedules',
      value: upcomingSchedules.length,
      hint: upcomingSchedules[0]
        ? new Date(upcomingSchedules[0].shootingDate).toLocaleDateString()
        : 'No upcoming dates',
      icon: CalendarDays,
    },
    {
      label: 'Processed Emails',
      value: processingStats?.totalProcessed ?? 0,
      hint: `Pending: ${processingStats?.pendingCount ?? 0}`,
      icon: MailCheck,
    },
    {
      label: 'Success Rate',
      value: `${Math.round(processingStats?.successRate ?? 0)}%`,
      hint: processingStats?.lastProcessed
        ? `Last run: ${new Date(processingStats.lastProcessed).toLocaleTimeString()}`
        : 'No runs yet',
      icon: Activity,
    },
    {
      label: 'System Health',
      value: `${healthyServicesCount}/${totalServices}`,
      hint: systemStatus ? systemStatus.status : 'Unknown',
      icon: Clock3,
    },
  ]

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Monitor your film schedule automation system</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
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
      <div className="relative space-y-6 overflow-hidden rounded-3xl">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_45%)]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100 ring-1 ring-white/15">
                StillOnTime Operations
              </p>
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                Dashboard
              </h1>
              <p className="max-w-2xl text-sm text-slate-200 md:text-base">
                Live command center for schedule processing, service reliability,
                and recent automation activity.
              </p>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                System status: {systemStatus?.status ?? 'unknown'}
              </div>
            </div>

            <button
              onClick={refreshData}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh now
            </button>
          </div>
        </div>

        {/* Setup Status Widget */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
          <SetupStatusWidget />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {kpi.label}
                </span>
                <kpi.icon className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
              </div>
              <p className="text-3xl font-semibold text-slate-900">{kpi.value}</p>
              <p className="mt-2 text-xs text-slate-500">{kpi.hint}</p>
            </div>
          ))}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* System Status */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
            <SystemStatusCard
              systemStatus={systemStatus}
              isLoading={isLoading}
              onRefresh={refreshData}
            />
          </div>

          {/* Processing Control */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
            <ProcessingControlCard
              processingStats={processingStats}
              isLoading={isLoading}
              onTriggerProcessing={triggerProcessing}
              onRefresh={refreshData}
            />
          </div>

          {/* Upcoming Schedules Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm lg:row-span-2">
            <UpcomingSchedulesCard
              upcomingSchedules={upcomingSchedules}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Recent Activity - Full Width */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm lg:col-span-2">
            <RecentActivityCard
              recentActivity={recentActivity}
              isLoading={isLoading}
              onRetryEmail={retryEmail}
            />
          </div>
        </div>

        {/* Auto-refresh indicator */}
        {isLoading && (
          <div className="fixed bottom-4 right-4 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
            <LoadingSpinner size="sm" text="Refreshing..." />
          </div>
        )}
      </div>
    </InitializationCheck>
  )
}
