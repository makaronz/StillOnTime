import React, { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  isWeekend
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface CalendarEvent {
  date: Date;
  title: string;
  type?: string;
}

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events?: CalendarEvent[];
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
  onSelectDate,
  events = [],
  className
}) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getEventTypeColor = (type?: string) => {
    switch (type) {
      case 'Day Exterior':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Night Exterior':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Interior':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className={clsx('bg-white rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-700 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const isWeekendDay = isWeekend(day);

          return (
            <div
              key={day.toString()}
              className={clsx(
                'min-h-[80px] p-2 border rounded-lg cursor-pointer transition-colors',
                isCurrentMonth ? 'bg-white' : 'bg-gray-50',
                isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200',
                isTodayDate && 'bg-blue-50',
                isWeekendDay && !isCurrentMonth && 'bg-gray-100',
                'hover:bg-gray-50 hover:shadow-sm'
              )}
              onClick={() => onSelectDate(day)}
            >
              <div className={clsx(
                'text-sm font-medium mb-1',
                !isCurrentMonth && 'text-gray-400',
                isTodayDate && 'text-blue-600',
                isSelected && 'text-blue-600'
              )}>
                {format(day, 'd')}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      'text-xs px-1 py-0.5 rounded truncate border',
                      getEventTypeColor(event.type)
                    )}
                    title={event.title}
                  >
                    {event.title.split(' - ')[0]} {/* Show only time */}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500 px-1">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
              <span>Standard</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
              <span>Day Ext.</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-indigo-100 border border-indigo-200 rounded"></div>
              <span>Night Ext.</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
};