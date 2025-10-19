import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useWebVitals } from "./PerformanceOptimizer";
import { performanceMonitoringService } from "@/services/performance-monitoring.service";

interface PerformanceData {
  timestamp: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
}

interface WebVitalsData {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
  timestamp: number;
}

interface AlertData {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  timestamp: number;
  resolved: boolean;
}

export const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [webVitalsData, setWebVitalsData] = useState<WebVitalsData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");
  const currentWebVitals = useWebVitals();

  // Fetch performance data from backend
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/performance/dashboard");
        const data = await response.json();

        if (data.success) {
          setPerformanceData(data.data.hourlyStats || []);
          setAlerts(data.data.recentAlerts || []);
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
    const interval = setInterval(fetchPerformanceData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  // Collect current Web Vitals
  useEffect(() => {
    if (currentWebVitals.lcp > 0) {
      setWebVitalsData(prev => [
        ...prev.slice(-19), // Keep last 20 entries
        {
          ...currentWebVitals,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [currentWebVitals]);

  // Calculate performance scores
  const performanceScores = useMemo(() => {
    if (performanceData.length === 0) return null;

    const latest = performanceData[performanceData.length - 1];
    const average = performanceData.reduce((acc, curr) => ({
      responseTime: acc.responseTime + curr.responseTime / performanceData.length,
      throughput: acc.throughput + curr.throughput / performanceData.length,
      errorRate: acc.errorRate + curr.errorRate / performanceData.length,
      memoryUsage: acc.memoryUsage + curr.memoryUsage / performanceData.length,
      cpuUsage: acc.cpuUsage + curr.cpuUsage / performanceData.length,
      cacheHitRate: acc.cacheHitRate + curr.cacheHitRate / performanceData.length,
    }), { responseTime: 0, throughput: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0, cacheHitRate: 0 });

    const scores = {
      responseTime: getScore(latest.responseTime, { good: 200, poor: 500 }),
      throughput: getScore(latest.throughput, { good: 100, poor: 50 }, true),
      errorRate: getScore(latest.errorRate * 100, { good: 1, poor: 5 }, true),
      memoryUsage: getScore(latest.memoryUsage, { good: 70, poor: 90 }, true),
      cacheHitRate: getScore(latest.cacheHitRate * 100, { good: 80, poor: 60 }, true),
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

    return { ...scores, overall: overallScore, current: latest, average };
  }, [performanceData]);

  // Get Web Vitals score
  const webVitalsScore = useMemo(() => {
    if (currentWebVitals.lcp === 0) return null;

    const scores = {
      lcp: getScore(currentWebVitals.lcp, { good: 2500, poor: 4000 }),
      fid: getScore(currentWebVitals.fid, { good: 100, poor: 300 }),
      cls: getScore(currentWebVitals.cls * 100, { good: 10, poor: 25 }, true),
      fcp: getScore(currentWebVitals.fcp, { good: 1800, poor: 3000 }),
      ttfb: getScore(currentWebVitals.ttfb, { good: 800, poor: 1800 }),
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

    return { ...scores, overall: overallScore };
  }, [currentWebVitals]);

  // Helper function to calculate performance scores
  function getScore(value: number, thresholds: { good: number; poor: number }, reverse: boolean = false): number {
    if (reverse) {
      if (value >= thresholds.good) return 100;
      if (value <= thresholds.poor) return 0;
      return ((value - thresholds.poor) / (thresholds.good - thresholds.poor)) * 100;
    } else {
      if (value <= thresholds.good) return 100;
      if (value >= thresholds.poor) return 0;
      return ((thresholds.poor - value) / (thresholds.poor - thresholds.good)) * 100;
    }
  }

  // Format time for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Get alert icon
  const getAlertIcon = (type: AlertData["type"]) => {
    switch (type) {
      case "error":
        return "🚨";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📊";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex space-x-2">
          {(["1h", "6h", "24h", "7d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-3 py-1 rounded ${
                selectedTimeRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Score Overview */}
      {performanceScores && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.overall)}`}>
                {performanceScores.overall.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.responseTime)}`}>
                {performanceScores.current.responseTime.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-500">
                Score: {performanceScores.responseTime.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.throughput)}`}>
                {performanceScores.current.throughput.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">req/min</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Error Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.errorRate)}`}>
                {(performanceScores.current.errorRate * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                Score: {performanceScores.errorRate.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Memory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.memoryUsage)}`}>
                {performanceScores.current.memoryUsage.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">
                Score: {performanceScores.memoryUsage.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cache Hit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(performanceScores.cacheHitRate)}`}>
                {(performanceScores.current.cacheHitRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                Score: {performanceScores.cacheHitRate.toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Web Vitals */}
      {webVitalsScore && (
        <Card>
          <CardHeader>
            <CardTitle>Web Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-gray-500">LCP</div>
                <div className={`text-lg font-semibold ${getScoreColor(webVitalsScore.lcp)}`}>
                  {currentWebVitals.lcp.toFixed(0)}ms
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">FID</div>
                <div className={`text-lg font-semibold ${getScoreColor(webVitalsScore.fid)}`}>
                  {currentWebVitals.fid.toFixed(0)}ms
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">CLS</div>
                <div className={`text-lg font-semibold ${getScoreColor(webVitalsScore.cls)}`}>
                  {currentWebVitals.cls.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">FCP</div>
                <div className={`text-lg font-semibold ${getScoreColor(webVitalsScore.fcp)}`}>
                  {currentWebVitals.fcp.toFixed(0)}ms
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">TTFB</div>
                <div className={`text-lg font-semibold ${getScoreColor(webVitalsScore.ttfb)}`}>
                  {currentWebVitals.ttfb.toFixed(0)}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatTime(value)}
                  formatter={(value: any) => [`${value}ms`, "Response Time"]}
                />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Throughput Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Throughput & Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => formatTime(value)}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="throughput"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={(data) => data.errorRate * 100}
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Memory Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>System Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatTime(value)}
                />
                <Line
                  type="monotone"
                  dataKey={(data) => data.memoryUsage}
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Memory %"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={(data) => data.cpuUsage}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="CPU %"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cache Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(value) => formatTime(value)}
                  formatter={(value: any) => [`${value}%`, "Cache Hit Rate"]}
                />
                <Area
                  type="monotone"
                  dataKey={(data) => data.cacheHitRate * 100}
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent alerts</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    alert.type === "error"
                      ? "bg-red-50 border border-red-200"
                      : alert.type === "warning"
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {alert.resolved && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Resolved
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;