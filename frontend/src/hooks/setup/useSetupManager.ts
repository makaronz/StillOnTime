import { useEffect, useCallback } from 'react'
import { useSetupStore } from '@/stores/setupStore'
import { useAuthStore } from '@/stores/authStore'

export function useSetupManager() {
  const { isAuthenticated } = useAuthStore()
  const {
    currentStep,
    isCompleted,
    loadProgress,
    saveProgress,
    completeSetup,
    testServiceConnection,
    serviceConnections,
  } = useSetupStore()

  // Load setup progress when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProgress()
    }
  }, [isAuthenticated, loadProgress])

  // Save progress automatically when setup data changes
  const saveCurrentProgress = useCallback(async () => {
    if (isAuthenticated && !isCompleted) {
      await saveProgress()
    }
  }, [isAuthenticated, isCompleted, saveProgress])

  // Test all critical service connections
  const testAllConnections = useCallback(async () => {
    const criticalServices = ['database', 'google', 'gmail', 'calendar']
    const results = await Promise.allSettled(
      criticalServices.map(service => testServiceConnection(service))
    )

    return criticalServices.reduce((acc, service, index) => {
      const result = results[index]
      acc[service] = {
        status: result.status === 'fulfilled' && result.value ? 'connected' : 'error',
        lastChecked: new Date(),
      }
      return acc
    }, {} as Record<string, { status: 'connected' | 'error'; lastChecked: Date }>)
  }, [testServiceConnection])

  // Check if setup is required
  const isSetupRequired = useCallback(() => {
    return isAuthenticated && !isCompleted && currentStep < 5
  }, [isAuthenticated, isCompleted, currentStep])

  // Get setup progress percentage
  const getProgressPercentage = useCallback(() => {
    return Math.round((currentStep / 5) * 100)
  }, [currentStep])

  // Get next step name
  const getNextStepName = useCallback(() => {
    const steps = [
      'Welcome',
      'User Preferences',
      'Gmail Integration',
      'Calendar Integration',
      'System Configuration',
      'Complete',
    ]
    return steps[Math.min(currentStep + 1, steps.length - 1)]
  }, [currentStep])

  // Reset and restart setup
  const restartSetup = useCallback(async () => {
    // This would be implemented in the store
    console.log('Restarting setup...')
  }, [])

  return {
    // State
    currentStep,
    isCompleted,
    serviceConnections,

    // Actions
    saveCurrentProgress,
    testAllConnections,
    completeSetup,
    restartSetup,

    // Helpers
    isSetupRequired,
    getProgressPercentage,
    getNextStepName,
  }
}