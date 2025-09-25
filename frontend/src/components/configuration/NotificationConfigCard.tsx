import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bell, Mail, MessageSquare, Smartphone, Loader2 } from 'lucide-react'

const notificationSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
})

type NotificationFormData = z.infer<typeof notificationSchema>

interface NotificationConfigCardProps {
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
  }
  onUpdate: (data: { notifications: { email: boolean; sms: boolean; push: boolean } }) => Promise<void>
  isSaving: boolean
}

export default function NotificationConfigCard({
  notifications,
  onUpdate,
  isSaving,
}: NotificationConfigCardProps): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { isDirty },
    watch,
  } = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: notifications,
  })

  const watchedNotifications = watch()

  const onSubmit = async (data: NotificationFormData) => {
    await onUpdate({ notifications: data })
  }

  const getEnabledCount = () => {
    return Object.values(watchedNotifications).filter(Boolean).length
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <Bell className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Notification Options */}
        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0 mt-1">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Receive schedule summaries and system alerts via email
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    {...register('email')}
                    type="checkbox"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                • Schedule processing results
                • Weather warnings
                • System status alerts
              </div>
            </div>
          </div>

          {/* SMS Notifications */}
          <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0 mt-1">
              <MessageSquare className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Get wake-up reminders and urgent alerts via text message
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    {...register('sms')}
                    type="checkbox"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                • Wake-up time reminders
                • Critical system failures
                • Last-minute schedule changes
              </div>
              {watchedNotifications.sms && (
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                  <strong>Note:</strong> SMS notifications require phone number configuration in your profile.
                </div>
              )}
            </div>
          </div>

          {/* Push Notifications */}
          <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0 mt-1">
              <Smartphone className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Receive real-time notifications in your browser
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    {...register('push')}
                    type="checkbox"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                • Processing completion
                • Calendar event creation
                • Real-time status updates
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              Active Notification Channels:
            </span>
            <span className="text-sm font-bold text-blue-900">
              {getEnabledCount()} of 3 enabled
            </span>
          </div>
          {getEnabledCount() === 0 && (
            <p className="text-sm text-blue-800 mt-2">
              ⚠️ No notification channels enabled. You won't receive any alerts.
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Saving...
              </>
            ) : (
              'Save Notification Settings'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}