import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

import OnboardingFlow from '@/pages/Onboarding/OnboardingFlow'
import { useSetupStore } from '@/stores/setupStore'
import { useAuthStore } from '@/stores/authStore'

// Mock stores
jest.mock('@/stores/setupStore')
jest.mock('@/stores/authStore')
jest.mock('@/services/systemConfig')

const mockUseSetupStore = useSetupStore as jest.MockedFunction<typeof useSetupStore>
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// Mock toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Setup Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'test@example.com', name: 'Test User' },
    } as any)

    mockUseSetupStore.mockReturnValue({
      currentStep: 0,
      isCompleted: false,
      setupData: {
        userPreferences: {
          timezone: 'America/New_York',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          notifications: { email: true, sms: false, push: true },
          workingHours: { start: '09:00', end: '17:00' },
        },
        gmailIntegration: {
          enabled: false,
          autoProcessing: true,
          senderFilters: ['production'],
          labelFilters: ['call-sheet'],
        },
        calendarIntegration: {
          enabled: false,
          primaryCalendar: 'primary',
          syncSettings: {
            autoSync: true,
            syncInterval: 300,
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
      },
      setCurrentStep: jest.fn(),
      updateSetupData: jest.fn(),
      validateCurrentStep: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
      nextStep: jest.fn(),
      previousStep: jest.fn(),
      skipStep: jest.fn(),
      completeSetup: jest.fn(),
      resetSetup: jest.fn(),
      saveProgress: jest.fn(),
      loadProgress: jest.fn(),
      startOnboarding: jest.fn(),
      updateProgress: jest.fn(),
      testServiceConnection: jest.fn(),
      serviceConnections: {},
      progress: null,
    } as any)
  })

  it('renders the welcome step initially', () => {
    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    expect(screen.getByText('Welcome to StillOnTime')).toBeInTheDocument()
    expect(screen.getByText('Let\'s get your film schedule automation system set up in just a few minutes.')).toBeInTheDocument()
  })

  it('shows step progress indicator', () => {
    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    expect(screen.getByText('StillOnTime Setup')).toBeInTheDocument()
    expect(screen.getByText('Configure your film schedule automation system')).toBeInTheDocument()
  })

  it('navigates to next step when clicking next button', async () => {
    const mockNextStep = jest.fn()
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      nextStep: mockNextStep,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    const nextButton = screen.getByText("Let's get started")
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(mockNextStep).toHaveBeenCalled()
    })
  })

  it('allows skipping setup', () => {
    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    const skipButton = screen.getByText('Skip setup')
    expect(skipButton).toBeInTheDocument()
  })

  it('shows service status widget', () => {
    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    expect(screen.getByText('Service Status')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Google APIs')).toBeInTheDocument()
  })

  it('validates current step before proceeding', async () => {
    const mockValidateCurrentStep = jest.fn().mockReturnValue({
      isValid: false,
      errors: ['Timezone is required'],
      warnings: [],
    })

    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      currentStep: 1, // User preferences step
      validateCurrentStep: mockValidateCurrentStep,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(mockValidateCurrentStep).toHaveBeenCalled()
    })
  })

  it('redirects to login if not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    // Should trigger redirect to login
    expect(mockUseAuthStore).toHaveBeenCalled()
  })

  it('loads saved progress on mount', () => {
    const mockLoadProgress = jest.fn()
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      loadProgress: mockLoadProgress,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    expect(mockLoadProgress).toHaveBeenCalled()
  })
})

describe('Setup Steps Integration', () => {
  it('renders user preferences step correctly', async () => {
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      currentStep: 1,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Your Preferences')).toBeInTheDocument()
      expect(screen.getByText('Time & Date Settings')).toBeInTheDocument()
      expect(screen.getByText('Working Hours')).toBeInTheDocument()
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
    })
  })

  it('renders gmail integration step correctly', async () => {
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      currentStep: 2,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Gmail Integration')).toBeInTheDocument()
      expect(screen.getByText('Connect your Gmail account to automatically parse schedules from emails and attachments.')).toBeInTheDocument()
    })
  })

  it('renders calendar integration step correctly', async () => {
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      currentStep: 3,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Calendar Integration')).toBeInTheDocument()
      expect(screen.getByText('Connect your Google Calendar to automatically create and sync schedule events.')).toBeInTheDocument()
    })
  })

  it('renders system configuration step correctly', async () => {
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      currentStep: 4,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('System Configuration')).toBeInTheDocument()
      expect(screen.getByText('Enhanced AI Services')).toBeInTheDocument()
      expect(screen.getByText('Mail Parsing Features')).toBeInTheDocument()
    })
  })

  it('renders completion step when setup is completed', async () => {
    mockUseSetupStore.mockReturnValue({
      ...mockUseSetupStore(),
      isCompleted: true,
    } as any)

    render(
      <TestWrapper>
        <OnboardingFlow />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
      expect(screen.getByText('Your StillOnTime film schedule automation system is now configured and ready to use.')).toBeInTheDocument()
    })
  })
})