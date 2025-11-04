import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  BellIcon,
  CheckIcon,
  XIcon,
  Info,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  template: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: any;
}

interface NotificationsPanelProps {
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');

  // Mock notifications - replace with actual data
  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      template: 'schedule_processed',
      title: 'Schedule Processed',
      message: 'Tomorrow\'s shoot schedule has been processed and route optimized',
      createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      read: false,
      data: { scheduleId: '123' }
    },
    {
      id: '2',
      type: 'warning',
      template: 'weather_warning',
      title: 'Weather Alert',
      message: 'High winds expected tomorrow afternoon. Consider adjusting schedule',
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      data: { severity: 'medium' }
    },
    {
      id: '3',
      type: 'info',
      template: 'traffic_update',
      title: 'Traffic Update',
      message: 'Heavy traffic reported on route to studio. Added 15 min buffer',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: true
    },
    {
      id: '4',
      type: 'error',
      template: 'email_failed',
      title: 'Email Processing Failed',
      message: 'Could not process email from production@studio.com',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      read: false
    },
    {
      id: '5',
      type: 'success',
      template: 'route_optimized',
      title: 'Route Optimized',
      message: 'New route found that saves 10 minutes',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: true
    }
  ];

  const allNotifications = notifications.length > 0 ? notifications : mockNotifications;

  const filteredNotifications = allNotifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'important') {
      return notification.type === 'error' || notification.type === 'warning';
    }
    return true;
  });

  const displayedNotifications = showAll
    ? filteredNotifications
    : filteredNotifications.slice(0, 5);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XIcon className="w-5 h-5 text-red-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const handleMarkAsRead = async (id: string) => {
    onMarkAsRead?.(id);
    // Mock API call
    console.log('Marking notification as read:', id);
  };

  const handleMarkAllAsRead = async () => {
    onMarkAllAsRead?.();
    // Mock API call
    console.log('Marking all notifications as read');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <BellIcon className="w-5 h-5" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="danger">{unreadCount}</Badge>
            )}
          </span>
          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border rounded-md px-2 py-1"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="important">Important</option>
            </select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BellIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <>
            {displayedNotifications.map((notification) => (
              <div
                key={notification.id}
                className={clsx(
                  'p-3 rounded-lg border transition-colors hover:shadow-sm cursor-pointer',
                  getNotificationColor(notification.type),
                  !notification.read && 'font-semibold'
                )}
                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                      </p>
                      {notification.read ? (
                        <CheckIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredNotifications.length > 5 && (
              <div className="pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show All (${filteredNotifications.length})`}
                </Button>
              </div>
            )}

            {unreadCount > 0 && (
              <div className="pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleMarkAllAsRead}
                >
                  Mark All as Read
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Helper function for className merging
function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}