import { useState, useCallback } from 'react'
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { SetupState, StepValidation, OnboardingProgress } from '@/types/setup'
import { systemConfigService } from '@/services/systemConfig'
import { toast } from 'react-hot-toast'

interface SetupStore extends SetupState {
  // Actions
  setCurrentStep: (step: number) => void
  updateSetupData: (updates: Partial<SetupState['setupData']>) => void
  validateCurrentStep: () => StepValidation
  nextStep: () => void
  previousStep: () => void
  skipStep: () => void
  completeSetup: () => Promise<void>
  resetSetup: () => void
  saveProgress: () => Promise<void>
  loadProgress: () => Promise<void>

  // Service connections
  serviceConnections: Record<string, { status: 'connected' | 'disconnected' | 'connecting' | 'error', lastChecked: Date }>
  testServiceConnection: (service: string) => Promise<boolean>

  // Progress tracking
  progress: OnboardingProgress | null
  startOnboarding: () => void
  updateProgress: (stepIndex: number) => void

  // Loading state
  isLoading: boolean
}

const initialSetupData: SetupState['setupData'] = {
  userPreferences: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    notifications: {
      email: true,
      sms: false,
      push: true,
    },
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
  },
  gmailIntegration: {
    enabled: true,
    autoProcessing: true,
    senderFilters: ['production', 'coordinator', 'assistant', 'manager'],
    labelFilters: ['call-sheet', 'schedule', 'shooting'],
  },
  calendarIntegration: {
    enabled: true,
    primaryCalendar: 'primary',
    syncSettings: {
      autoSync: true,
      syncInterval: 300, // 5 minutes
      createEvents: true,
    },
  },
  systemConfig: {
    enhancedServices: {
      pdf: true,
      email: true,
      routing: true,
      calendar: true,
      aiClassification: true,
    },
    mailParsing: {
      autoDetectSchedules: true,
      parseAttachments: true,
      extractContacts: true,
      extractEquipment: true,
      extractSafetyNotes: true,
    },
  },
}

export const useSetupStore = create<SetupStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        currentStep: 0,
        isCompleted: false,
        setupData: initialSetupData,
        serviceConnections: {},
        progress: null,
        isLoading: false,

        setCurrentStep: (step) => set({ currentStep: step }),

        updateSetupData: (updates) =>
          set((state) => ({
            setupData: {
              ...state.setupData,
              ...updates,
            },
          })),

        validateCurrentStep: (): StepValidation => {
          const state = get()
          const step = state.currentStep

          // Basic validation logic for each step
          switch (step) {
            case 0: // Welcome step
              return { isValid: true, errors: [], warnings: [] }

            case 1: // User preferences
              const { userPreferences } = state.setupData
              const errors: string[] = []

              if (!userPreferences.timezone) {
                errors.push('Timezone is required')
              }
              if (!userPreferences.workingHours.start || !userPreferences.workingHours.end) {
                errors.push('Working hours are required')
              }

              return {
                isValid: errors.length === 0,
                errors,
                warnings: [],
              }

            case 2: // Gmail integration
              return { isValid: true, errors: [], warnings: [] }

            case 3: // Calendar integration
              return { isValid: true, errors: [], warnings: [] }

            case 4: // System configuration
              return { isValid: true, errors: [], warnings: [] }

            default:
              return { isValid: true, errors: [], warnings: [] }
          }
        },

        nextStep: () => {
          const validation = get().validateCurrentStep()
          if (!validation.isValid) {
            validation.errors.forEach((error) => toast.error(error))
            return
          }
          set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) }))
        },

        previousStep: () =>
          set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),

        skipStep: () =>
          set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })),

        completeSetup: async () => {
          set({ isLoading: true })
          try {
            // Save all configuration to backend
            await systemConfigService.updateMailParsingConfig({
              gmailIntegration: {
                enabled: get().setupData.gmailIntegration.enabled,
                scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
                autoProcessing: get().setupData.gmailIntegration.autoProcessing,
              },
              emailProcessing: get().setupData.systemConfig.mailParsing,
              parsingRules: {
                subjectPatterns: ["call sheet", "schedule", "shooting", "production"],
                senderPatterns: get().setupData.gmailIntegration.senderFilters,
                attachmentTypes: [".pdf", ".doc", ".docx"],
              },
              processingSettings: {
                maxFileSize: "10MB",
                supportedFormats: ["PDF", "DOC", "DOCX"],
                ocrEnabled: true,
                aiClassification: get().setupData.systemConfig.enhancedServices.aiClassification,
              },
            })

            await systemConfigService.updateLLMConfig({
              enhancedServices: get().setupData.systemConfig.enhancedServices,
            })

            set({ isCompleted: true, isLoading: false })
            toast.success('Setup completed successfully!')
          } catch (error) {
            console.error('Failed to complete setup:', error)
            toast.error('Failed to save configuration. Please try again.')
            set({ isLoading: false })
          }
        },

        resetSetup: () => {
          set({
            currentStep: 0,
            isCompleted: false,
            setupData: initialSetupData,
            serviceConnections: {},
            progress: null,
          })
        },

        saveProgress: async () => {
          try {
            const state = get()
            const progressData = {
              currentStep: state.currentStep,
              setupData: state.setupData,
              serviceConnections: state.serviceConnections,
            }

            // Save to backend or local storage as needed
            localStorage.setItem('setup-progress', JSON.stringify(progressData))
            toast.success('Progress saved')
          } catch (error) {
            console.error('Failed to save progress:', error)
            toast.error('Failed to save progress')
          }
        },

        loadProgress: async () => {
          try {
            const savedProgress = localStorage.getItem('setup-progress')
            if (savedProgress) {
              const progressData = JSON.parse(savedProgress)
              set({
                currentStep: progressData.currentStep || 0,
                setupData: { ...initialSetupData, ...progressData.setupData },
                serviceConnections: progressData.serviceConnections || {},
              })
            }
          } catch (error) {
            console.error('Failed to load progress:', error)
          }
        },

        testServiceConnection: async (service: string) => {
          try {
            set((state) => ({
              serviceConnections: {
                ...state.serviceConnections,
                [service]: { status: 'connecting', lastChecked: new Date() },
              },
            }))

            // Test connection via API
            const response = await systemConfigService.testConnections()
            const isConnected = response.results[service]?.connected || false

            set((state) => ({
              serviceConnections: {
                ...state.serviceConnections,
                [service]: {
                  status: isConnected ? 'connected' : 'error',
                  lastChecked: new Date(),
                  error: isConnected ? undefined : 'Connection failed',
                },
              },
            }))

            return isConnected
          } catch (error) {
            set((state) => ({
              serviceConnections: {
                ...state.serviceConnections,
                [service]: {
                  status: 'error',
                  lastChecked: new Date(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              },
            }))
            return false
          }
        },

        startOnboarding: () => {
          set({
            progress: {
              startedAt: new Date(),
              currentStep: 0,
              totalSteps: 5,
              completedSteps: [],
            },
          })
        },

        updateProgress: (stepIndex: number) => {
          const state = get()
          if (state.progress) {
            const completedSteps = [...new Set([...state.progress.completedSteps, `step-${stepIndex}`])]
            set({
              progress: {
                ...state.progress,
                currentStep: stepIndex,
                completedSteps,
                estimatedTimeRemaining: Math.max(0, (5 - stepIndex) * 2 * 60 * 1000), // 2 minutes per step
              },
            })
          }
        },
      }),
      {
        name: 'setup-storage',
        partialize: (state) => ({
          currentStep: state.currentStep,
          setupData: state.setupData,
          isCompleted: state.isCompleted,
          serviceConnections: state.serviceConnections,
        }),
      }
    )
  )
)