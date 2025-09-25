export default function Dashboard(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Monitor your film schedule automation system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">System Status</h3>
          <div className="flex items-center">
            <div className="h-3 w-3 bg-green-400 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">All systems operational</span>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Recent Activity</h3>
          <p className="text-sm text-gray-600">No recent email processing</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upcoming Schedules</h3>
          <p className="text-sm text-gray-600">No upcoming shoots</p>
        </div>
      </div>
    </div>
  )
}