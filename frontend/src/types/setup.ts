export interface SetupState {
  currentStep: number
  isCompleted: boolean
  setupData: {
    // User preferences
    userPreferences: {
      timezone: string
      dateFormat: string
      timeFormat: '12h' | '24h'
      notifications: {
        email: boolean
        sms: boolean
        push: boolean
      }
      workingHours: {
        start: string
        end: string
      }
    }

    // Gmail integration
    gmailIntegration: {
      enabled: boolean
      autoProcessing: boolean
      senderFilters: string[]
      labelFilters: string[]
    }

    // Calendar integration
    calendarIntegration: {
      enabled: boolean
      primaryCalendar: string
      syncSettings: {
        autoSync: boolean
        syncInterval: number
        createEvents: boolean
      }
    }

    // System configuration
    systemConfig: {
      enhancedServices: {
        pdf: boolean
        email: boolean
        routing: boolean
        calendar: boolean
        aiClassification: boolean
      }
      mailParsing: {
        autoDetectSchedules: boolean
        parseAttachments: boolean
        extractContacts: boolean
        extractEquipment: boolean
        extractSafetyNotes: boolean
      }
    }
  }
}

export interface StepValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface SetupStep {
  id: string
  title: string
  description: string
  component: React.ComponentType<StepProps>
  validation: (data: SetupState['setupData']) => StepValidation
  isRequired: boolean
  canSkip: boolean
}

export interface StepProps {
  data: SetupState['setupData']
  updateData: (updates: Partial<SetupState['setupData']>) => void
  validation: StepValidation
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  isFirstStep: boolean
  isLastStep: boolean
  isLoading: boolean
}

export interface ServiceConnection {
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  lastChecked: Date
  latency?: number
  error?: string
}

export interface OnboardingProgress {
  startedAt: Date
  currentStep: number
  totalSteps: number
  completedSteps: string[]
  estimatedTimeRemaining?: number
}