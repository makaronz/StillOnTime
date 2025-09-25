import { ScheduleData } from '@/types'
import { Calendar, MapPin, Clock, Sun, Moon } from 'lucide-react'
import { format, isToday, isTomorrow, formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '@/components/LoadingSpinner'

interface UpcomingSchedulesCardProps {
  upcomingSchedules: ScheduleData[]
  isLoading: boolean
}

export default function UpcomingSchedulesCard({ 
  upcomingSchedules, 
  isLoading 
}: UpcomingSchedulesCardProps): JSX.Element {
  const getSceneIcon = (sceneType: ScheduleData['sceneType']) => {
    return sceneType === 'EXT' ? (
      <Sun className="h-4 w-4 text-yellow-500" />
    ) : (
      <Moon className="h-4 w-4 text-blue-500" />
    )
  }

  const getDateLabel = (date: Date) => {
    if (isToday(date)) {
      return 'Today'
    } else if (isTomorrow(date)) {
      return 'Tomorrow'
    } else {
      return format(date, 'MMM d')
    }
  }

  const getUrgencyColor = (date: Date) => {
    if (isToday(date)) {
      return 'border-l-red-500 bg-red-50'
    } else if (isTomorrow(date)) {
      return 'border-l-yellow-500 bg-yellow-50'
    } else {
      return 'border-l-blue-500 bg-blue-50'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Schedules</h3>

      {isLoading ? (
        <LoadingSpinner size="sm" text="Loading schedules..." />
      ) : upcomingSchedules.length > 0 ? (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {upcomingSchedules.map((schedule) => (
            <div 
              key={schedule.id} 
              className={`border-l-4 p-4 rounded-r-lg ${getUrgencyColor(new Date(schedule.shootingDate))}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {getDateLabel(new Date(schedule.shootingDate))}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(schedule.shootingDate), 'yyyy-MM-dd')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      Call time: {schedule.callTime}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700 truncate">
                      {schedule.location}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getSceneIcon(schedule.sceneType)}
                    <span className="text-xs text-gray-600">
                      {schedule.sceneType} Scene
                    </span>
                    {schedule.scenes && schedule.scenes.length > 0 && (
                      <span className="text-xs text-gray-500">
                        • Scenes: {schedule.scenes.join(', ')}
                      </span>
                    )}
                  </div>

                  {schedule.safetyNotes && (
                    <div className="mt-2 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                      <strong>Safety:</strong> {schedule.safetyNotes}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(schedule.shootingDate), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">No upcoming shooting schedules</p>
          <p className="text-xs text-gray-400 mt-1">
            Schedules will appear here when emails are processed
          </p>
        </div>
      )}
    </div>
  )
}