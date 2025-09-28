import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  MemoryStick,
  Database,
  Wifi,
  TrendingUp,
  RefreshCw,
  Bell,
  BarChart3,
} from "lucide-react";
import {
  monitoringService,
  type AlertSeverity,
  type HealthStatus,
  type MonitoringDashboard,
} from "../services/monitoring";
import { LoadingSpinner } from "../components/LoadingSpinner";

const REFRESH_INTERVAL = 30000;

const REFRESH_INTERVAL = 30000;

export const Monitoring: React.FC = () => {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await monitoringService.getDashboard();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5" />;
      case 'unhealthy': return <XCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'text-red-800 bg-red-100 border-red-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await monitoringService.resolveAlert(alertId);
      await fetchDashboard(); // Refresh data
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <XCircle className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Monitoring Error</h3>
                <p className="text-red-600 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchDashboard}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <p className="text-gray-600 mt-1">Real-time application performance and health monitoring</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Auto-refresh:</label>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <button
              onClick={fetchDashboard}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <div className={`flex items-center mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dashboard.systemOverview.status)}`}>
                  {getStatusIcon(dashboard.systemOverview.status)}
                  <span className="ml-2 capitalize">{dashboard.systemOverview.status}</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatUptime(dashboard.systemOverview.uptime)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Requests</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {dashboard.systemOverview.totalRequests.toLocaleString()}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.systemOverview.errorRate > 5 ? 'text-red-600' : 
                  dashboard.systemOverview.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {dashboard.systemOverview.errorRate.toFixed(2)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.systemOverview.averageResponseTime > 2000 ? 'text-red-600' : 
                  dashboard.systemOverview.averageResponseTime > 1000 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {dashboard.systemOverview.averageResponseTime.toFixed(0)}ms
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {dashboard.alerts.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-red-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
                <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {dashboard.alerts.length}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboard.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="ml-3 text-sm text-gray-500">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 mt-2">
                          {alert.message}
                        </h3>
                        {(() => {
                          const metadata = alert.metadata as Record<
                            string,
                            unknown
                          > & {
                            currentValue?: unknown;
                            threshold?: unknown;
                          };
                          const { currentValue, threshold } = metadata;
                          const isRenderable = (value: unknown): value is
                            | number
                            | string =>
                            typeof value === "number" ||
                            typeof value === "string";

                          return isRenderable(currentValue) &&
                            isRenderable(threshold) ? (
                            <p className="text-sm text-gray-600 mt-1">
                              Current value: {currentValue} (threshold: {threshold})
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="ml-4 bg-white text-gray-700 border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* APM Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Application Performance */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Application Performance</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">APDEX Score</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    dashboard.apmMetrics.applicationPerformance.apdex >= 0.8 ? 'text-green-600' :
                    dashboard.apmMetrics.applicationPerformance.apdex >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {dashboard.apmMetrics.applicationPerformance.apdex.toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Throughput</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {dashboard.apmMetrics.applicationPerformance.throughput}/min
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">P99 Response Time</p>
                  <p className={`text-lg font-semibold mt-1 ${
                    dashboard.apmMetrics.applicationPerformance.responseTimeP99 > 5000 ? 'text-red-600' :
                    dashboard.apmMetrics.applicationPerformance.responseTimeP99 > 2000 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {dashboard.apmMetrics.applicationPerformance.responseTimeP99.toFixed(0)}ms
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Error Rate</p>
                  <p className={`text-lg font-semibold mt-1 ${
                    dashboard.apmMetrics.applicationPerformance.errorRate > 5 ? 'text-red-600' :
                    dashboard.apmMetrics.applicationPerformance.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {dashboard.apmMetrics.applicationPerformance.errorRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Utilization */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Resource Utilization</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Cpu className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">CPU Usage</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    dashboard.apmMetrics.resourceUtilization.cpuUsagePercent > 80 ? 'text-red-600' :
                    dashboard.apmMetrics.resourceUtilization.cpuUsagePercent > 60 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {dashboard.apmMetrics.resourceUtilization.cpuUsagePercent.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MemoryStick className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Memory Usage</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    dashboard.apmMetrics.resourceUtilization.memoryUsagePercent > 80 ? 'text-red-600' :
                    dashboard.apmMetrics.resourceUtilization.memoryUsagePercent > 60 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {dashboard.apmMetrics.resourceUtilization.memoryUsagePercent.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">DB Connections</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {dashboard.apmMetrics.resourceUtilization.databaseConnectionsActive}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Wifi className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Network I/O</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatBytes(dashboard.apmMetrics.resourceUtilization.networkIOBytes)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Business Metrics */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Business Metrics</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Emails/Hour</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {dashboard.apmMetrics.businessMetrics.emailsProcessedPerHour}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Schedule Success</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.apmMetrics.businessMetrics.scheduleCreationSuccessRate >= 95 ? 'text-green-600' :
                  dashboard.apmMetrics.businessMetrics.scheduleCreationSuccessRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {dashboard.apmMetrics.businessMetrics.scheduleCreationSuccessRate.toFixed(1)}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Calendar Events</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.apmMetrics.businessMetrics.calendarEventCreationRate >= 95 ? 'text-green-600' :
                  dashboard.apmMetrics.businessMetrics.calendarEventCreationRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {dashboard.apmMetrics.businessMetrics.calendarEventCreationRate.toFixed(1)}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.apmMetrics.businessMetrics.notificationDeliveryRate >= 95 ? 'text-green-600' :
                  dashboard.apmMetrics.businessMetrics.notificationDeliveryRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {dashboard.apmMetrics.businessMetrics.notificationDeliveryRate.toFixed(1)}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">OAuth Refresh</p>
                <p className={`text-2xl font-bold mt-2 ${
                  dashboard.apmMetrics.businessMetrics.oauthTokenRefreshRate >= 95 ? 'text-green-600' :
                  dashboard.apmMetrics.businessMetrics.oauthTokenRefreshRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {dashboard.apmMetrics.businessMetrics.oauthTokenRefreshRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Services Health */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Services Health</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboard.services.map((service) => (
                <div
                  key={service.serviceName}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 capitalize">
                      {service.serviceName.replace('_', ' ')}
                    </h3>
                    <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                      {getStatusIcon(service.status)}
                      <span className="ml-1 capitalize">{service.status}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {service.responseTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Response Time:</span>
                        <span className="font-medium">{service.responseTime}ms</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Check:</span>
                      <span className="font-medium">
                        {new Date(service.lastCheck).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {service.error && (
                      <div className="text-red-600 text-xs mt-2 p-2 bg-red-50 rounded">
                        {service.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};