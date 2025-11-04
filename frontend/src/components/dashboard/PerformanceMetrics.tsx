import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  BarChart3,
  CpuIcon,
  ServerIcon,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUpIcon,
  TrendingDownIcon
} from 'lucide-react';

interface Metric {
  label: string;
  value: number | string;
  unit?: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down';
  trendValue?: number;
}

interface PerformanceMetricsProps {
  className?: string;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  className
}) => {
  const [metrics, setMetrics] = useState<{
    system: Metric[];
    api: Metric[];
    database: Metric[];
  }>({
    system: [],
    api: [],
    database: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      // Mock API call - replace with actual metrics API
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockMetrics = {
        system: [
          {
            label: 'CPU Usage',
            value: 45,
            unit: '%',
            status: 'good' as const,
            trend: 'down' as const,
            trendValue: 5
          },
          {
            label: 'Memory',
            value: 68,
            unit: '%',
            status: 'good' as const,
            trend: 'up' as const,
            trendValue: 2
          },
          {
            label: 'Disk I/O',
            value: 125,
            unit: 'MB/s',
            status: 'good' as const
          }
        ],
        api: [
          {
            label: 'Response Time',
            value: 145,
            unit: 'ms',
            status: 'good' as const,
            trend: 'down' as const,
            trendValue: 12
          },
          {
            label: 'Requests/min',
            value: 234,
            status: 'good' as const,
            trend: 'up' as const,
            trendValue: 8
          },
          {
            label: 'Error Rate',
            value: 0.2,
            unit: '%',
            status: 'good' as const
          }
        ],
        database: [
          {
            label: 'Connections',
            value: 12,
            unit: '/20',
            status: 'good' as const
          },
          {
            label: 'Query Time',
            value: 23,
            unit: 'ms',
            status: 'good' as const,
            trend: 'up' as const,
            trendValue: 3
          },
          {
            label: 'Cache Hit',
            value: 94,
            unit: '%',
            status: 'good' as const
          }
        ]
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const MetricCard: React.FC<{ metric: Metric }> = ({ metric }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-2">
        {getStatusIcon(metric.status)}
        <span className="text-sm text-gray-700">{metric.label}</span>
      </div>
      <div className="flex items-center space-x-2">
        {metric.trend && (
          <div className="flex items-center space-x-1">
            {metric.trend === 'up' ? (
              <TrendingUpIcon className="w-3 h-3 text-red-500" />
            ) : (
              <TrendingDownIcon className="w-3 h-3 text-green-500" />
            )}
            <span className="text-xs text-gray-500">{metric.trendValue}%</span>
          </div>
        )}
        <span className="text-sm font-semibold">
          {metric.value}{metric.unit}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Performance</span>
          </span>
          <Badge variant="success">
            All Systems Operational
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center space-x-2">
            <CpuIcon className="w-4 h-4" />
            <span>System</span>
          </h4>
          <div className="space-y-2">
            {metrics.system.map((metric, idx) => (
              <MetricCard key={idx} metric={metric} />
            ))}
          </div>
        </div>

        {/* API Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center space-x-2">
            <ServerIcon className="w-4 h-4" />
            <span>API</span>
          </h4>
          <div className="space-y-2">
            {metrics.api.map((metric, idx) => (
              <MetricCard key={idx} metric={metric} />
            ))}
          </div>
        </div>

        {/* Database Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Database</span>
          </h4>
          <div className="space-y-2">
            {metrics.database.map((metric, idx) => (
              <MetricCard key={idx} metric={metric} />
            ))}
          </div>
        </div>

        {/* Status Summary */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Last updated: Just now</span>
            <span>Updating every 30s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};