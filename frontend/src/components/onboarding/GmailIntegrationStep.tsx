import React, { useState } from 'react'
import { Mail, CheckCircle, AlertCircle, Settings } from 'lucide-react'
import { StepProps } from '@/types/setup'
import { useAuthStore } from '@/stores/authStore'

export function GmailIntegrationStep({ data, updateData, onNext, onPrevious, onSkip, isFirstStep, isLastStep, isLoading }: StepProps): JSX.Element {
  const { isAuthenticated, user } = useAuthStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle')

  const handleGmailConnect = async () => {
    setIsConnecting(true)
    try {
      // This would trigger the OAuth flow
      setConnectionStatus('connected')
      // Update the setup data
      updateData({
        gmailIntegration: {
          ...data.gmailIntegration,
          enabled: true,
        },
      })
    } catch (error) {
      setConnectionStatus('error')
      console.error('Failed to connect Gmail:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSenderFilterChange = (index: number, value: string) => {
    const newFilters = [...data.gmailIntegration.senderFilters]
    newFilters[index] = value
    updateData({
      gmailIntegration: {
        ...data.gmailIntegration,
        senderFilters: newFilters,
      },
    })
  }

  const addSenderFilter = () => {
    updateData({
      gmailIntegration: {
        ...data.gmailIntegration,
        senderFilters: [...data.gmailIntegration.senderFilters, ''],
      },
    })
  }

  const removeSenderFilter = (index: number) => {
    const newFilters = data.gmailIntegration.senderFilters.filter((_, i) => i !== index)
    updateData({
      gmailIntegration: {
        ...data.gmailIntegration,
        senderFilters: newFilters,
      },
    })
  }

  const isStepComplete = data.gmailIntegration.enabled && connectionStatus === 'connected'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Gmail Integration</h2>
        <p className="text-gray-600">
          Connect your Gmail account to automatically parse schedules from emails and attachments.
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
              <Mail className="w-5 h-5 text-gray-600 mr-3" aria-hidden="true" />
            )}
            <div>
              <h3 className="font-medium text-gray-900">
                {connectionStatus === 'connected'
                  ? 'Gmail Connected'
                  : connectionStatus === 'error'
                  ? 'Connection Failed'
                  : 'Gmail Not Connected'
                }
              </h3>
              <p className="text-sm text-gray-600">
                {connectionStatus === 'connected'
                  ? `Connected as ${user?.email || 'your account'}`
                  : connectionStatus === 'error'
                  ? 'Failed to connect to Gmail. Please try again.'
                  : 'Connect your Gmail account to enable automatic schedule parsing.'
                }
              </p>
            </div>
          </div>

          {connectionStatus !== 'connected' && (
            <div className="mt-4">
              <button
                onClick={handleGmailConnect}
                disabled={isConnecting || !isAuthenticated}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Gmail Account'}
              </button>
              {!isAuthenticated && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  You need to be signed in to connect your Gmail account
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Configuration options */}
      <div className="space-y-6">
        {/* Auto processing */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Settings</h3>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={data.gmailIntegration.enabled}
                onChange={(e) => updateData({
                  gmailIntegration: {
                    ...data.gmailIntegration,
                    enabled: e.target.checked,
                  },
                })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Enable Automatic Processing</span>
                <p className="text-xs text-gray-500">Automatically parse new emails for schedule information</p>
              </div>
            </div>
          </label>
        </div>

        {/* Sender filters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Sender Filters</h3>
            <button
              onClick={addSenderFilter}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Filter
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Specify which email senders to monitor for schedule information.
          </p>

          <div className="space-y-3">
            {data.gmailIntegration.senderFilters.map((filter, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => handleSenderFilterChange(index, e.target.value)}
                  placeholder="e.g., production@studio.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => removeSenderFilter(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  aria-label="Remove filter"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Label filters */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Label Filters</h3>

          <p className="text-sm text-gray-600 mb-4">
            Gmail labels to monitor for schedule-related emails.
          </p>

          <div className="space-y-2">
            {data.gmailIntegration.labelFilters.map((label, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview of what will be parsed */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-3">What We'll Parse</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Call sheets and shooting schedules
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Call times and location information
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Cast and crew assignments
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Equipment and department notes
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              PDF and Word document attachments
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