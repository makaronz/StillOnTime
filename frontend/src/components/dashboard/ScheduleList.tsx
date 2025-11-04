import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  CalendarIcon,
  Clock,
  MapPinIcon,
  FilmIcon,
  UserIcon,
  ChevronRight,
  ChevronDownIcon
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { Schedule } from '@/types/schedule';

interface ScheduleListProps {
  selectedDate: Date;
  onScheduleSelect?: (schedule: Schedule) => void;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  selectedDate,
  onScheduleSelect
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Mock schedules - replace with actual data from API
  const schedules: Schedule[] = useMemo(() => [
    {
      id: '1',
      shootingDate: new Date(),
      callTime: '08:00',
      location: 'Warner Bros Studio - Stage 16',
      baseLocation: 'Burbank, CA',
      sceneType: 'Day Exterior',
      scenes: [
        { number: '12A', description: 'Car chase scene', duration: '4 hours' },
        { number: '12B', description: 'Dialogue in car', duration: '2 hours' }
      ],
      contacts: {
        director: 'Christopher Nolan',
        cinematographer: 'Hoyte van Hoytema',
        ad: 'Thomas Hayslip'
      },
      equipment: ['Camera A', 'Camera B', 'Grip Truck', 'Lighting Package'],
      status: 'confirmed',
      weather: 'Partly Cloudy',
      routeOptimized: true
    },
    {
      id: '2',
      shootingDate: new Date(),
      callTime: '14:00',
      location: 'Downtown LA - 5th Street',
      baseLocation: 'Los Angeles, CA',
      sceneType: 'Night Exterior',
      scenes: [
        { number: '23', description: 'Alley confrontation', duration: '3 hours' }
      ],
      contacts: {
        director: 'Christopher Nolan',
        cinematographer: 'Hoyte van Hoytema'
      },
      equipment: ['Camera A', 'Lighting Package', 'Rain Machine'],
      status: 'pending',
      weather: 'Clear',
      routeOptimized: false
    },
    {
      id: '3',
      shootingDate: new Date(Date.now() + 86400000), // Tomorrow
      callTime: '06:00',
      location: 'Griffith Observatory',
      baseLocation: 'Los Angeles, CA',
      sceneType: 'Dawn Exterior',
      scenes: [
        { number: '45', description: 'Opening shot', duration: '2 hours' }
      ],
      contacts: {
        director: 'Christopher Nolan',
        cinematographer: 'Hoyte van Hoytema'
      },
      status: 'confirmed',
      weather: 'Clear',
      routeOptimized: true
    }
  ], []);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const scheduleDate = format(new Date(schedule.shootingDate), 'yyyy-MM-dd');
      const selected = format(selectedDate, 'yyyy-MM-dd');
      return scheduleDate === selected;
    });
  }, [schedules, selectedDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getSceneTypeColor = (type: string) => {
    if (type.includes('Day')) return 'warning';
    if (type.includes('Night')) return 'primary';
    if (type.includes('Dawn') || type.includes('Dusk')) return 'secondary';
    return 'primary';
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5" />
            <span>
              Schedules for {formatDateLabel(selectedDate)}
            </span>
          </span>
          <Badge variant="outline">
            {filteredSchedules.length} schedule{filteredSchedules.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No schedules found for this date</p>
          </div>
        ) : (
          filteredSchedules.map((schedule) => (
            <div
              key={schedule.id}
              className="border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant={getSceneTypeColor(schedule.sceneType)}>
                        {schedule.sceneType}
                      </Badge>
                      <Badge variant={getStatusColor(schedule.status || 'unknown')}>
                        {schedule.status}
                      </Badge>
                      {isPast(new Date(schedule.shootingDate)) && (
                        <Badge variant="secondary">Past</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {schedule.location}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Call: {schedule.callTime}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4" />
                        <span>{schedule.baseLocation || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FilmIcon className="w-4 h-4" />
                        <span>{schedule.scenes?.length || 0} scenes</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(schedule.id)}
                  >
                    {expandedId === schedule.id ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {expandedId === schedule.id && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    {/* Scenes */}
                    {schedule.scenes && schedule.scenes.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Scenes</h4>
                        <div className="space-y-2">
                          {schedule.scenes.map((scene, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 p-3 rounded"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">
                                  {scene.number}
                                </span>
                                <span className="text-sm">{scene.description}</span>
                              </div>
                              <Badge variant="outline" size="sm">
                                {scene.duration}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contacts */}
                    {schedule.contacts && (
                      <div>
                        <h4 className="font-medium mb-2">Key Contacts</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(schedule.contacts).map(([role, name]) => (
                            <div
                              key={role}
                              className="flex items-center space-x-2 text-sm"
                            >
                              <UserIcon className="w-4 h-4 text-gray-400" />
                              <span className="capitalize">{role}:</span>
                              <span className="font-medium">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Equipment */}
                    {schedule.equipment && schedule.equipment.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Equipment</h4>
                        <div className="flex flex-wrap gap-2">
                          {schedule.equipment.map((item, idx) => (
                            <Badge key={idx} variant="outline" size="sm">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weather */}
                    {schedule.weather && (
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium mb-1">Weather Forecast</h4>
                          <p className="text-sm text-gray-600">{schedule.weather}</p>
                        </div>
                        {schedule.routeOptimized && (
                          <Badge variant="success">Route Optimized</Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2 pt-4">
                      <Button
                        size="sm"
                        onClick={() => onScheduleSelect?.(schedule)}
                      >
                        View Route
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Export PDF
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};