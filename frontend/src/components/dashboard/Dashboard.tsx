import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Calendar } from '../ui/Calendar';
import { ScheduleList } from './ScheduleList';
import { WeatherWidget } from './WeatherWidget';
import { RouteOptimization } from './RouteOptimization';
import { EmailProcessor } from './EmailProcessor';
import { NotificationsPanel } from './NotificationsPanel';
import { PerformanceMetrics } from './PerformanceMetrics';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Mail,
  Bell,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSchedules } from '@/hooks/useSchedules';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface DashboardStats {
  totalSchedules: number;
  upcomingSchedules: number;
  processedEmails: number;
  pendingEmails: number;
  activeNotifications: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { schedules, refresh: refreshSchedules } = useSchedules();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [stats, setStats] = useState<DashboardStats>({
    totalSchedules: 0,
    upcomingSchedules: 0,
    processedEmails: 0,
    pendingEmails: 0,
    activeNotifications: 0
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);

  // Calculate stats from data
  useEffect(() => {
    const today = new Date();
    const upcomingSchedules = schedules.filter(s =>
      new Date(s.shootingDate) >= today
    ).length;

    setStats({
      totalSchedules: schedules.length,
      upcomingSchedules,
      processedEmails: notifications.filter(n =>
        n.template === 'email_processed'
      ).length,
      pendingEmails: notifications.filter(n =>
        n.template === 'email_pending'
      ).length,
      activeNotifications: unreadCount
    });
  }, [schedules, notifications, unreadCount]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshSchedules(),
        // Add other refresh functions as needed
      ]);
      toast.success('Dashboard refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    trend?: {
      value: number;
      direction: 'up' | 'down';
    };
    color?: string;
  }> = ({ title, value, icon, trend, color = 'blue' }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
            {trend && (
              <div className={`flex items-center mt-1 text-sm ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
                <span className="ml-1">{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={`p-3 bg-${color}-100 rounded-full`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.name || 'User'}!
              </h1>
              <p className="text-sm text-gray-600">
                Here's what's happening with your film schedules today
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
              <Button variant="outline">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Schedules"
            value={stats.totalSchedules}
            icon={<CalendarIcon className="w-6 h-6 text-blue-600" />}
            color="blue"
          />
          <StatCard
            title="Upcoming"
            value={stats.upcomingSchedules}
            icon={<Clock className="w-6 h-6 text-green-600" />}
            color="green"
            trend={{ value: 12, direction: 'up' }}
          />
          <StatCard
            title="Processed Emails"
            value={stats.processedEmails}
            icon={<Mail className="w-6 h-6 text-purple-600" />}
            color="purple"
          />
          <StatCard
            title="Notifications"
            value={stats.activeNotifications}
            icon={<Bell className="w-6 h-6 text-red-600" />}
            color="red"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Calendar Widget */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarIcon className="w-5 h-5" />
                  <span>Production Calendar</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  events={schedules.map(s => ({
                    date: new Date(s.shootingDate),
                    title: `${s.callTime} - ${s.location}`,
                    type: s.sceneType
                  }))}
                />
              </CardContent>
            </Card>

            {/* Schedule List */}
            <ScheduleList
              selectedDate={selectedDate}
              onScheduleSelect={(schedule) => {
                setActiveWidget('route-optimization');
              }}
            />

            {/* Route Optimization */}
            {activeWidget === 'route-optimization' && (
              <RouteOptimization
                schedule={schedules.find(s =>
                  format(new Date(s.shootingDate), 'yyyy-MM-dd') ===
                  format(selectedDate, 'yyyy-MM-dd')
                )}
                onClose={() => setActiveWidget(null)}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Email Processor */}
            <EmailProcessor />

            {/* Weather Widget */}
            <WeatherWidget
              location={schedules[0]?.location}
              date={selectedDate}
            />

            {/* Notifications Panel */}
            <NotificationsPanel
              notifications={notifications}
              onMarkAsRead={markAsRead}
            />

            {/* Performance Metrics */}
            <PerformanceMetrics />
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2"
                onClick={() => setActiveWidget('email-processor')}
              >
                <Mail className="w-4 h-4" />
                <span>Check Emails</span>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2"
                onClick={() => window.location.href = '/schedules/new'}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Add Schedule</span>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2"
                onClick={() => window.location.href = '/routes'}
              >
                <MapPin className="w-4 h-4" />
                <span>View Routes</span>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2"
                onClick={() => window.location.href = '/analytics'}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};