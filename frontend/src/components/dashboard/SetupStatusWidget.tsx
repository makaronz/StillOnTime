import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetupManager } from '@/hooks/setup/useSetupManager'
import { Settings, CheckCircle, AlertCircle, Clock } from 'lucide-react'

export function SetupStatusWidget(): JSX.Element {
  const navigate = useNavigate()
  const { isSetupRequired, getProgressPercentage, getNextStepName, isCompleted } = useSetupManager()

  if (isCompleted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-medium text-green-900">Setup Complete</h3>
            <p className="text-xs text-green-700">Your system is fully configured</p>
          </div>
        </div>
      </div>
    )
  }

  if (isSetupRequired) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-medium text-yellow-900">Setup Required</h3>
              <p className="text-xs text-yellow-700">
                Complete setup to unlock all features ({getProgressPercentage()}% done)
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Continue Setup
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full bg-yellow-200 rounded-full h-2">
            <div
              className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <p className="text-xs text-yellow-700 mt-1">Next: {getNextStepName()}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Clock className="w-5 h-5 text-blue-600 mr-3" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">Quick Setup</h3>
            <p className="text-xs text-blue-700">Configure your system in 5 minutes</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/onboarding')}
          className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Start Setup
        </button>
      </div>
    </div>
  )
}