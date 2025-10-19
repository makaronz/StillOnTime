import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  DocumentTextIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EmailStatus {
  total: number;
  processed: number;
  pending: number;
  failed: number;
  lastChecked?: Date;
  isProcessing: boolean;
}

export const EmailProcessor: React.FC = () => {
  const [status, setStatus] = useState<EmailStatus>({
    total: 0,
    processed: 0,
    pending: 0,
    failed: 0,
    isProcessing: false
  });
  const [recentEmails, setRecentEmails] = useState<Array<{
    id: string;
    subject: string;
    sender: string;
    status: 'processed' | 'pending' | 'failed';
    processedAt?: Date;
  }>>([]);

  useEffect(() => {
    fetchEmailStatus();
    const interval = setInterval(fetchEmailStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchEmailStatus = async () => {
    try {
      // Mock API call - replace with actual API
      const mockStatus: EmailStatus = {
        total: 124,
        processed: 118,
        pending: 4,
        failed: 2,
        lastChecked: new Date(),
        isProcessing: false
      };

      const mockEmails = [
        {
          id: '1',
          subject: 'Tomorrow Shoot Schedule - REVISED',
          sender: 'production@studio.com',
          status: 'processed' as const,
          processedAt: new Date()
        },
        {
          id: '2',
          subject: 'Call Sheet for Jan 16',
          sender: 'ad@production.com',
          status: 'pending' as const
        },
        {
          id: '3',
          subject: 'Weather Alert for Tomorrow',
          sender: 'weather@service.com',
          status: 'failed' as const
        }
      ];

      setStatus(mockStatus);
      setRecentEmails(mockEmails);
    } catch (error) {
      console.error('Failed to fetch email status:', error);
    }
  };

  const handleProcessEmails = async () => {
    setStatus(prev => ({ ...prev, isProcessing: true }));

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success('Email processing completed');
      fetchEmailStatus();
    } catch (error) {
      toast.error('Failed to process emails');
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const getStatusIcon = (emailStatus: string) => {
    switch (emailStatus) {
      case 'processed':
        return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <ExclamationCircleIcon className="w-4 h-4 text-red-600" />;
      default:
        return <EnvelopeIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (emailStatus: string) => {
    switch (emailStatus) {
      case 'processed':
        return <Badge variant="success">Processed</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <EnvelopeIcon className="w-5 h-5" />
            <span>Email Processor</span>
          </span>
          <Button
            size="sm"
            onClick={handleProcessEmails}
            loading={status.isProcessing}
            disabled={status.pending === 0 && !status.isProcessing}
          >
            {status.isProcessing ? (
              <>
                <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Check Now
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Processed</span>
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-900">{status.processed}</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-600">Pending</span>
              <ClockIcon className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-900">{status.pending}</p>
          </div>
        </div>

        {status.failed > 0 && (
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">Failed</span>
              <ExclamationCircleIcon className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-900">{status.failed}</p>
          </div>
        )}

        {/* Last Checked */}
        {status.lastChecked && (
          <div className="text-xs text-gray-500 text-center">
            Last checked: {status.lastChecked.toLocaleTimeString()}
          </div>
        )}

        {/* Recent Emails */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Emails</h4>
          <div className="space-y-2">
            {recentEmails.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No recent emails
              </p>
            ) : (
              recentEmails.map(email => (
                <div
                  key={email.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getStatusIcon(email.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {email.sender}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(email.status)}
                    {email.status === 'processed' && (
                      <Button size="sm" variant="ghost">
                        <DocumentTextIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = '/emails'}
          >
            View All Emails
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};