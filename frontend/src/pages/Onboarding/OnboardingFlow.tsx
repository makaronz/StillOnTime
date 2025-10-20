import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetupStore } from '@/stores/setupStore'
import { WelcomeStep } from '@/components/onboarding/WelcomeStep'
import { UserPreferencesStep } from '@/components/onboarding/UserPreferencesStep'
import { GmailIntegrationStep } from '@/components/onboarding/GmailIntegrationStep'
import { CalendarIntegrationStep } from '@/components/onboarding/CalendarIntegrationStep'
import { SystemConfigStep } from '@/components/onboarding/SystemConfigStep'
import { CompletionStep } from '@/components/onboarding/CompletionStep'
import { SetupProgress } from '@/components/setup/SetupProgress'
import { useAuthStore } from '@/stores/authStore'

const onboardingSteps = [
  { id: 'welcome', title: 'Welcome', component: WelcomeStep },
  { id: 'preferences', title: 'Preferences', component: UserPreferencesStep },
  { id: 'gmail', title: 'Gmail Integration', component: GmailIntegrationStep },
  { id: 'calendar', title: 'Calendar Setup', component: CalendarIntegrationStep },
  { id: 'system', title: 'System Configuration', component: SystemConfigStep },
  { id: 'completion', title: 'Complete', component: CompletionStep },
]

export default function OnboardingFlow(): JSX.Element {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const {
    currentStep,
    isCompleted,
    setCurrentStep,
    validateCurrentStep,
    nextStep,
    previousStep,
    skipStep,
    completeSetup,
    updateProgress,
    startOnboarding,
    resetSetup,
    loadProgress,
  } = useSetupStore()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    // Load any saved progress
    loadProgress()
    startOnboarding()
  }, [isAuthenticated, navigate, loadProgress, startOnboarding])

  useEffect(() => {
    updateProgress(currentStep)
  }, [currentStep, updateProgress])

  const handleStepChange = (stepIndex: number) => {
    const validation = validateCurrentStep()
    if (!validation.isValid && stepIndex > currentStep) {
      // Don't allow jumping forward if current step is invalid
      return
    }
    setCurrentStep(stepIndex)
  }

  const handleComplete = async () => {
    await completeSetup()
    navigate('/dashboard', { replace: true })
  }

  const handleRestart = () => {
    resetSetup()
    navigate('/onboarding', { replace: true })
  }

  if (isCompleted) {
    return <CompletionStep onComplete={handleComplete} onRestart={handleRestart} />
  }

  const CurrentStepComponent = onboardingSteps[currentStep].component

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with progress */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">StillOnTime Setup</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Configure your film schedule automation system
                </p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now →
              </button>
            </div>

            {/* Step indicator */}
            <div className="mt-6">
              <SetupProgress
                steps={onboardingSteps}
                currentStep={currentStep}
                onStepClick={handleStepChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Step content */}
          <div className="lg:col-span-3">
            <CurrentStepComponent
              data={useSetupStore.getState().setupData}
              updateData={useSetupStore.getState().updateSetupData}
              validation={validateCurrentStep()}
              onNext={nextStep}
              onPrevious={previousStep}
              onSkip={skipStep}
              isFirstStep={currentStep === 0}
              isLastStep={currentStep === onboardingSteps.length - 1}
              isLoading={false}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Tips</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <p>• Take your time to configure each step properly</p>
                <p>• You can always change these settings later</p>
                <p>• Enable Gmail integration for automatic schedule detection</p>
                <p>• Connect your calendar for seamless scheduling</p>
              </div>

              {/* Connection status */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Service Status</h3>
                <ServiceStatusWidget />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ServiceStatusWidget(): JSX.Element {
  const { serviceConnections, testServiceConnection } = useSetupStore()

  const services = [
    { key: 'database', name: 'Database', icon: '🗄️' },
    { key: 'google', name: 'Google APIs', icon: '🔗' },
    { key: 'gmail', name: 'Gmail', icon: '📧' },
    { key: 'calendar', name: 'Calendar', icon: '📅' },
  ]

  return (
    <div className="space-y-2">
      {services.map((service) => {
        const connection = serviceConnections[service.key]
        const status = connection?.status || 'disconnected'

        return (
          <div key={service.key} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs">{service.icon}</span>
              <span className="text-xs text-gray-600">{service.name}</span>
            </div>
            <button
              onClick={() => testServiceConnection(service.key)}
              className={`text-xs px-2 py-1 rounded-full ${
                status === 'connected'
                  ? 'bg-green-100 text-green-800'
                  : status === 'connecting'
                  ? 'bg-yellow-100 text-yellow-800'
                  : status === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status === 'connected' && 'Connected'}
              {status === 'connecting' && 'Testing...'}
              {status === 'error' && 'Error'}
              {status === 'disconnected' && 'Test'}
            </button>
          </div>
        )
      })}
    </div>
  )
}