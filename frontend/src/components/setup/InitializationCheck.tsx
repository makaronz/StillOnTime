import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSetupManager } from '@/hooks/setup/useSetupManager'
import { useSetupStore } from '@/stores/setupStore'

interface InitializationCheckProps {
  children: React.ReactNode
  redirectToOnboarding?: boolean
  showSetupPrompt?: boolean
}

export function InitializationCheck({
  children,
  redirectToOnboarding = false,
  showSetupPrompt = true
}: InitializationCheckProps): JSX.Element {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { isSetupRequired, isCompleted } = useSetupManager()
  const { currentStep } = useSetupStore()

  useEffect(() => {
    // If user is authenticated and setup is required, redirect to onboarding
    if (isAuthenticated && isSetupRequired && redirectToOnboarding) {
      navigate('/onboarding', { replace: true })
    }
  }, [isAuthenticated, isSetupRequired, redirectToOnboarding, navigate])

  // If setup is not required or user is not authenticated, show children
  if (!isAuthenticated || !isSetupRequired || !showSetupPrompt) {
    return <>{children}</>
  }

  // Show setup prompt overlay
  return (
    <div className="relative">
      {children}

      {/* Setup prompt overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to StillOnTime!</h2>
            <p className="text-gray-600 mb-6">
              Let's set up your film schedule automation system. This will only take a few minutes.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Start Setup (5 min)
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Skip for now
              </button>
            </div>

            {currentStep > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  You've already completed {currentStep} of 5 setup steps
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}