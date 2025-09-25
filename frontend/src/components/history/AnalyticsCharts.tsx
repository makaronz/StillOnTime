import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { ProcessingAnalytics } from '@/services/history'
import { TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

interface AnalyticsChartsProps {
  analytics: ProcessingAnalytics | null
  isLoading: boolean
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6']

export default function AnalyticsCharts({ 
  analytics, 
  isLoading 
}: AnalyticsChartsProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data</h3>
          <p className="text-gray-500">
            Analytics will appear here once you have processing history.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalProcessed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(analytics.successRate)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Processing Time</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.averageProcessingTime.toFixed(1)}s</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Error Types</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.errorBreakdown.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Trends Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Trends</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.processingTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value, name) => [value, name === 'processed' ? 'Processed' : name === 'successful' ? 'Successful' : 'Failed']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="processed" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Total Processed"
              />
              <Line 
                type="monotone" 
                dataKey="successful" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Successful"
              />
              <Line 
                type="monotone" 
                dataKey="failed" 
                stroke="#EF4444" 
                strokeWidth={2}
                name="Failed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Statistics</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalEmails" fill="#3B82F6" name="Total Emails" />
                <Bar dataKey="successfulSchedules" fill="#10B981" name="Successful" />
                <Bar dataKey="failedProcessing" fill="#EF4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Breakdown</h3>
          {analytics.errorBreakdown.length > 0 ? (
            <div className="space-y-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.errorBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.errorBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2">
                {analytics.errorBreakdown.map((error, index) => (
                  <div key={error.error} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 truncate">{error.error}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">{error.count}</span>
                      <span className="text-gray-400">({error.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500">No errors recorded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}