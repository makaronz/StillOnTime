import React, { useState, useEffect } from 'react'
import { Calendar, CheckCircle, AlertCircle, Sync, Clock } from 'lucide-react'
import { StepProps } from '@/types/setup'

const syncIntervals = [
  { value: 60, label: 'Every minute' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 900, label: 'Every 15 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
]

export function CalendarIntegrationStep({ data, updateData, onNext, onPrevious, onSkip, isFirstStep, isLastStep, isLoading }: StepProps): JSX.Element {
  const [isConnecting, setIsConnecting] = useState(false)
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; primary: boolean }>>([])
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    // Simulate fetching calendars
    if (connectionStatus === 'connected') {
      setCalendars([
        { id: 'primary', name: 'Main Calendar', primary: true },
        { id: 'work', name: 'Work Calendar', primary: false },
        { id: 'personal', name: 'Personal Calendar', primary: false },
      ])
      setLastSync(new Date())
    }
  }, [connectionStatus])

  const handleCalendarConnect = async () => {
    setIsConnecting(true)
    try {
      // This would trigger the Google Calendar OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      setConnectionStatus('connected')
      updateData({
        calendarIntegration: {
          ...data.calendarIntegration,
          enabled: true,
        },
      })
    } catch (error) {
      setConnectionStatus('error')
      console.error('Failed to connect Calendar:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleCalendarSelect = (calendarId: string) => {
    updateData({
      calendarIntegration: {
        ...data.calendarIntegration,
        primaryCalendar: calendarId,
      },
    })
  }

  const handleSyncSettingChange = (setting: string, value: any) => {
    updateData({
      calendarIntegration: {
        ...data.calendarIntegration,
        syncSettings: {
          ...data.calendarIntegration.syncSettings,
          [setting]: value,
        },
      },
    })
  }

  const handleTestSync = async () => {
    setIsConnecting(true)
    try {
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 3000))
      setLastSync(new Date())
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const isStepComplete = data.calendarIntegration.enabled && connectionStatus === 'connected'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Calendar Integration</h2>
        <p className="text-gray-600">
          Connect your Google Calendar to automatically create and sync schedule events.
        </p>
      </div>

      {/* Connection status */}
      <div className="mb-6">
        <div className={`p-4 rounded-lg border ${
          connectionStatus === 'connected'
            ? 'bg-green-50 border-green-200'
            : connectionStatus === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center">
            {connectionStatus === 'connected' ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-3" aria-hidden="true" />
            ) : connectionStatus === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" aria-hidden="true" />
            ) : (
              <Calendar className="w-5 h-5 text-gray-600 mr-3" aria-hidden="true" />
            )}
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {connectionStatus === 'connected'
                  ? 'Calendar Connected'
                  : connectionStatus === 'error'
                  ? 'Connection Failed'
                  : 'Calendar Not Connected'
                }
              </h3>
              <p className="text-sm text-gray-600">
                {connectionStatus === 'connected'
                  ? 'Connected to Google Calendar'
                  : connectionStatus === 'error'
                  ? 'Failed to connect to Google Calendar. Please try again.'
                  : 'Connect your Google Calendar to enable schedule synchronization.'
                }
              </p>
            </div>
            {lastSync && (
              <div className="text-xs text-gray-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Last sync: {lastSync.toLocaleTimeString()}
              </div>
            )}
          </div>

          {connectionStatus !== 'connected' && (
            <div className="mt-4">
              <button
                onClick={handleCalendarConnect}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration options */}
      <div className="space-y-6">
        {/* Calendar selection */}
        {connectionStatus === 'connected' && calendars.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select Primary Calendar</h3>

            <div className="space-y-2">
              {calendars.map((calendar) => (
                <label key={calendar.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="primaryCalendar"
                      value={calendar.id}
                      checked={data.calendarIntegration.primaryCalendar === calendar.id}
                      onChange={(e) => handleCalendarSelect(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{calendar.name}</span>
                      {calendar.primary && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Primary</span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sync settings */}
        {connectionStatus === 'connected' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Settings</h3>

            <div className="space-y-4">
              {/* Auto sync */}
              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.calendarIntegration.syncSettings.autoSync}
                    onChange={(e) => handleSyncSettingChange('autoSync', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable Automatic Sync</span>
                    <p className="text-xs text-gray-500">Automatically sync calendar events</p>
                  </div>
                </div>
              </label>

              {/* Sync interval */}
              {data.calendarIntegration.syncSettings.autoSync && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sync Frequency
                  </label>
                  <select
                    value={data.calendarIntegration.syncSettings.syncInterval}
                    onChange={(e) => handleSyncSettingChange('syncInterval', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {syncIntervals.map((interval) => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Create events */}
              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.calendarIntegration.syncSettings.createEvents}
                    onChange={(e) => handleSyncSettingChange('createEvents', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Create Calendar Events</span>
                    <p className="text-xs text-gray-500">Automatically create events from parsed schedules</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Test sync button */}
            <div className="mt-4">
              <button
                onClick={handleTestSync}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center">
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Sync className="w-4 h-4 mr-2" aria-hidden="true" />
                      Test Sync Now
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Preview of calendar integration */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-3">Calendar Integration Features</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Automatic creation of shooting schedule events
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Location and time slot conflict detection
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Crew availability checking
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Real-time schedule updates and notifications
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Equipment and resource scheduling
            </li>
          </ul>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onPrevious}
          disabled={isFirstStep}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <div className="flex space-x-3">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Skip this step
          </button>
          <button
            onClick={onNext}
            disabled={isLoading || !isStepComplete}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}