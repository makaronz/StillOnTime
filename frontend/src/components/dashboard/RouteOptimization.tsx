import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  MapPinIcon,
  Clock,
  CarIcon,
  NavigationIcon,
  XIcon,
  ChevronRight,
  Play,
  RefreshCw
} from 'lucide-react';
import { Schedule } from '@/types/schedule';

interface RouteSegment {
  id: string;
  from: string;
  to: string;
  distance: number;
  duration: number;
  instructions: string[];
  traffic?: 'light' | 'moderate' | 'heavy';
}

interface RoutePlan {
  id: string;
  scheduleId: string;
  wakeUpTime: Date;
  departureTime: Date;
  arrivalTime: Date;
  totalTravelMinutes: number;
  segments: RouteSegment[];
  buffers: {
    carChange: number;
    parking: number;
    entry: number;
    traffic: number;
    morningRoutine: number;
  };
}

interface RouteOptimizationProps {
  schedule?: Schedule;
  onClose?: () => void;
}

export const RouteOptimization: React.FC<RouteOptimizationProps> = ({
  schedule,
  onClose
}) => {
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [showSteps, setShowSteps] = useState(true);

  useEffect(() => {
    if (schedule) {
      fetchRoutePlan();
    }
  }, [schedule]);

  const fetchRoutePlan = async () => {
    if (!schedule) return;

    setLoading(true);
    try {
      // Mock API call - replace with actual route optimization API
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockRoutePlan: RoutePlan = {
        id: 'route-1',
        scheduleId: schedule.id,
        wakeUpTime: new Date(),
        departureTime: new Date(),
        arrivalTime: new Date(),
        totalTravelMinutes: 45,
        segments: [
          {
            id: 'seg-1',
            from: 'Home',
            to: 'Panavision',
            distance: 5.2,
            duration: 15,
            instructions: [
              'Head north on Main St',
              'Turn right on Hollywood Blvd',
              'Destination on your left'
            ],
            traffic: 'light'
          },
          {
            id: 'seg-2',
            from: 'Panavision',
            to: 'Studio Lot',
            distance: 8.7,
            duration: 25,
            instructions: [
              'Head east on Santa Monica Blvd',
              'Merge onto US-101 N',
              'Take exit 9B for Cahuenga Blvd',
              'Turn left on Universal Studios Blvd'
            ],
            traffic: 'moderate'
          },
          {
            id: 'seg-3',
            from: 'Studio Lot',
            to: 'Stage 16',
            distance: 0.3,
            duration: 5,
            instructions: [
              'Follow studio signs',
              'Stage 16 is on the right'
            ],
            traffic: 'light'
          }
        ],
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45
        }
      };

      // Calculate times based on call time
      const callTime = new Date();
      callTime.setHours(8, 0, 0, 0); // 8:00 AM

      const totalBuffer = Object.values(mockRoutePlan.buffers).reduce((a, b) => a + b, 0);
      const totalTravelWithBuffers = mockRoutePlan.totalTravelMinutes + totalBuffer;

      mockRoutePlan.arrivalTime = new Date(callTime.getTime() - 10 * 60000); // 10 min before call
      mockRoutePlan.departureTime = new Date(
        mockRoutePlan.arrivalTime.getTime() - totalTravelWithBuffers * 60000
      );
      mockRoutePlan.wakeUpTime = new Date(
        mockRoutePlan.departureTime.getTime() - mockRoutePlan.buffers.morningRoutine * 60000
      );

      setRoutePlan(mockRoutePlan);
    } catch (error) {
      console.error('Failed to fetch route plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      // Mock optimization
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchRoutePlan();
    } catch (error) {
      console.error('Failed to optimize route:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const getTrafficColor = (traffic?: string) => {
    switch (traffic) {
      case 'heavy':
        return 'text-red-600 bg-red-100';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-100';
      case 'light':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!schedule) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MapPinIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Select a schedule to view route optimization</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4"
          onClick={onClose}
        >
          <XIcon className="w-4 h-4" />
        </Button>
      )}

      <CardHeader>
        <CardTitle className="flex items-center justify-between pr-8">
          <span className="flex items-center space-x-2">
            <NavigationIcon className="w-5 h-5" />
            <span>Route Optimization</span>
          </span>
          <Button
            size="sm"
            onClick={handleOptimize}
            loading={optimizing}
            disabled={loading}
          >
            {optimizing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-optimize
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-20 bg-gray-200 rounded-lg"></div>
            <div className="h-40 bg-gray-200 rounded-lg"></div>
          </div>
        ) : routePlan ? (
          <>
            {/* Timeline */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">Recommended Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Wake Up</span>
                  <span className="font-semibold text-blue-900">
                    {formatTime(routePlan.wakeUpTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Depart</span>
                  <span className="font-semibold text-blue-900">
                    {formatTime(routePlan.departureTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Arrive</span>
                  <span className="font-semibold text-blue-900">
                    {formatTime(routePlan.arrivalTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Call Time</span>
                  <span className="font-semibold text-blue-900">{schedule.callTime}</span>
                </div>
              </div>
            </div>

            {/* Route Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <CarIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-600">Total Distance</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {routePlan.segments.reduce((sum, seg) => sum + seg.distance, 0).toFixed(1)} mi
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-600">Travel Time</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {routePlan.totalTravelMinutes} min
                </p>
              </div>
            </div>

            {/* Buffers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Time Buffers</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSteps(!showSteps)}
                >
                  {showSteps ? 'Hide' : 'Show'} Details
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(routePlan.buffers).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <Badge variant="outline">{value} min</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Route Steps */}
            {showSteps && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Route Details</h4>
                <div className="space-y-3">
                  {routePlan.segments.map((segment, idx) => (
                    <div key={segment.id} className="relative">
                      {idx < routePlan.segments.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300"></div>
                      )}
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1 bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{segment.to}</p>
                              <p className="text-sm text-gray-600">From {segment.from}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{segment.duration} min</p>
                              <p className="text-xs text-gray-600">{segment.distance} mi</p>
                            </div>
                          </div>
                          {segment.traffic && (
                            <Badge
                              variant="outline"
                              size="sm"
                              className={getTrafficColor(segment.traffic)}
                            >
                              {segment.traffic} traffic
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t">
              <Button className="flex-1">
                <NavigationIcon className="w-4 h-4 mr-2" />
                Start Navigation
              </Button>
              <Button variant="outline" className="flex-1">
                <MapPinIcon className="w-4 h-4 mr-2" />
                View on Map
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <NavigationIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No route plan available</p>
            <Button
              className="mt-4"
              onClick={handleOptimize}
              loading={optimizing}
            >
              Generate Route Plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};