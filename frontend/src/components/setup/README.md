# Setup and Initialization Components

This directory contains components for the StillOnTime film schedule automation system setup and initialization flow.

## Components

### OnboardingFlow (`/pages/Onboarding/OnboardingFlow.tsx`)
The main onboarding flow component that orchestrates the entire setup process.

**Features:**
- Multi-step setup wizard with progress tracking
- Step validation and navigation
- Service connection status monitoring
- Responsive design with sidebar tips
- Integration with memory sync for data persistence

**Usage:**
```tsx
<OnboardingFlow />
```

### SetupProgress (`/components/setup/SetupProgress.tsx`)
A visual progress indicator for the onboarding steps.

**Props:**
- `steps`: Array of step objects with id and title
- `currentStep`: Current step index
- `onStepClick`: Optional callback for step navigation
- `className`: Additional CSS classes

**Usage:**
```tsx
<SetupProgress
  steps={steps}
  currentStep={currentStep}
  onStepClick={handleStepClick}
/>
```

### InitializationCheck (`/components/setup/InitializationCheck.tsx`)
A wrapper component that checks if setup is required and shows appropriate UI.

**Props:**
- `children`: Child components to render
- `redirectToOnboarding`: Whether to auto-redirect to onboarding
- `showSetupPrompt`: Whether to show the setup prompt overlay

**Usage:**
```tsx
<InitializationCheck redirectToOnboarding showSetupPrompt>
  <YourApp />
</InitializationCheck>
```

## Onboarding Steps

### 1. WelcomeStep
Introduction to StillOnTime with feature overview.

### 2. UserPreferencesStep
User timezone, date format, working hours, and notification preferences.

### 3. GmailIntegrationStep
Gmail account connection and email parsing configuration.

### 4. CalendarIntegrationStep
Google Calendar connection and sync settings.

### 5. SystemConfigStep
AI services and mail parsing feature configuration.

### 6. CompletionStep
Setup completion summary and next steps.

## State Management

### SetupStore (`/stores/setupStore.ts`)
Zustand store managing the entire setup state.

**Key Features:**
- Setup progress tracking
- Configuration data management
- Service connection monitoring
- Persistent storage with Zustand persist
- Memory synchronization with backend

**Key Methods:**
- `nextStep()`, `previousStep()`: Navigation
- `updateSetupData()`: Configuration updates
- `validateCurrentStep()`: Step validation
- `completeSetup()`: Finalize setup
- `testServiceConnection()`: Service testing

### useSetupManager Hook (`/hooks/setup/useSetupManager.ts`)
Custom hook providing setup management utilities.

**Features:**
- Setup progress loading/saving
- Service connection testing
- Setup requirement checking
- Progress percentage calculation

## Memory Synchronization

### useMemorySync Hook (`/hooks/memory/useMemorySync.ts`)
Handles synchronization between frontend setup state and backend memory.

**Features:**
- Automatic periodic sync (30-second intervals)
- Debounced sync on state changes
- Local storage fallback
- Force sync capability
- Memory data persistence

## Service Integration

### SystemConfigService (`/services/systemConfig.ts`)
API service for system configuration management.

**Endpoints:**
- `GET /api/config/status`: System status
- `POST /api/config/test-connections`: Connection testing
- `GET/PUT /api/config/llm`: LLM configuration
- `GET/PUT /api/config/mail-parsing`: Email parsing configuration

## Testing

### Setup Flow Tests (`/tests/setup/SetupFlow.test.tsx`)
Comprehensive test suite for the onboarding flow.

**Test Coverage:**
- Step rendering and navigation
- Form validation
- Service integration
- Authentication handling
- Progress tracking

## Configuration

### Environment Variables
Key environment variables for setup:

```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_ENABLE_ENHANCED_PDF=true
VITE_ENABLE_ENHANCED_EMAIL=true
VITE_ENABLE_ENHANCED_ROUTING=true
VITE_ENABLE_ENHANCED_CALENDAR=true
VITE_ENABLE_AI_CLASSIFICATION=true
```

## Integration Points

### Dashboard Integration
- `SetupStatusWidget`: Shows setup status on dashboard
- `InitializationCheck`: Wraps dashboard to show setup prompt

### App Routing
- `/onboarding`: Dedicated onboarding route
- Protected route requiring authentication

### Authentication Integration
- OAuth flow integration for Google services
- Session management during setup

## Best Practices

1. **Progress Persistence**: Always save progress on step changes
2. **Validation**: Validate each step before allowing progression
3. **Error Handling**: Graceful handling of service connection failures
4. **User Feedback**: Clear indicators for loading, success, and error states
5. **Accessibility**: Proper ARIA labels and keyboard navigation
6. **Responsive Design**: Mobile-friendly interface throughout setup

## Future Enhancements

1. **Setup Templates**: Pre-configured templates for different production types
2. **Batch Operations**: Bulk configuration for multiple accounts
3. **Setup Analytics**: Track setup completion rates and common issues
4. **Guided Tours**: Interactive walkthroughs for complex features
5. **Setup Recovery**: Ability to resume interrupted setup processes