import React from 'react'
import { Clock, Globe, Bell, Calendar } from 'lucide-react'
import { StepProps } from '@/types/setup'

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

const dateFormats = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g., 12/25/2023)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g., 25/12/2023)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g., 2023-12-25)' },
]

export function UserPreferencesStep({ data, updateData, onNext, onPrevious, onSkip, isFirstStep, isLastStep, isLoading }: StepProps): JSX.Element {
  const handlePreferenceChange = (section: string, field: string, value: any) => {
    updateData({
      userPreferences: {
        ...data.userPreferences,
        [section]: {
          ...data.userPreferences[section as keyof typeof data.userPreferences],
          [field]: value,
        },
      },
    })
  }

  const workingHours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0')
    return { value: `${hour}:00`, label: `${hour}:00` }
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your Preferences</h2>
        <p className="text-gray-600">
          Set up your personal preferences to customize your StillOnTime experience.
        </p>
      </div>

      <div className="space-y-6">
        {/* Timezone settings */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center mb-4">
            <Globe className="w-5 h-5 text-gray-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">Time & Date Settings</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Your Timezone
              </label>
              <select
                id="timezone"
                value={data.userPreferences.timezone}
                onChange={(e) => handlePreferenceChange('', 'timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 mb-2">
                Date Format
              </label>
              <select
                id="dateFormat"
                value={data.userPreferences.dateFormat}
                onChange={(e) => handlePreferenceChange('', 'dateFormat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {dateFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Format
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="timeFormat"
                    value="12h"
                    checked={data.userPreferences.timeFormat === '12h'}
                    onChange={(e) => handlePreferenceChange('', 'timeFormat', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">12-hour (AM/PM)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="timeFormat"
                    value="24h"
                    checked={data.userPreferences.timeFormat === '24h'}
                    onChange={(e) => handlePreferenceChange('', 'timeFormat', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">24-hour</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Working hours */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center mb-4">
            <Clock className="w-5 h-5 text-gray-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">Working Hours</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Set your typical working hours for scheduling notifications and alerts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <select
                id="startTime"
                value={data.userPreferences.workingHours.start}
                onChange={(e) => handlePreferenceChange('workingHours', 'start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workingHours.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <select
                id="endTime"
                value={data.userPreferences.workingHours.end}
                onChange={(e) => handlePreferenceChange('workingHours', 'end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workingHours.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notification preferences */}
        <div>
          <div className="flex items-center mb-4">
            <Bell className="w-5 h-5 text-gray-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Choose how you'd like to receive schedule updates and alerts.
          </p>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.userPreferences.notifications.email}
                  onChange={(e) => handlePreferenceChange('notifications', 'email', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Email Notifications</span>
                  <p className="text-xs text-gray-500">Receive schedule updates via email</p>
                </div>
              </div>
            </label>

            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.userPreferences.notifications.sms}
                  onChange={(e) => handlePreferenceChange('notifications', 'sms', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">SMS Notifications</span>
                  <p className="text-xs text-gray-500">Get text messages for urgent updates</p>
                </div>
              </div>
            </label>

            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.userPreferences.notifications.push}
                  onChange={(e) => handlePreferenceChange('notifications', 'push', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Push Notifications</span>
                  <p className="text-xs text-gray-500">Browser notifications for real-time updates</p>
                </div>
              </div>
            </label>
          </div>
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
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}