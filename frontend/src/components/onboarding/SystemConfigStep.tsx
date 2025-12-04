import React from 'react'
import { Cpu, FileText, Mail, MapPin, Calendar as CalendarIcon, Brain } from 'lucide-react'
import { StepProps } from '@/types/setup'

const serviceFeatures = [
  {
    id: 'pdf',
    icon: FileText,
    title: 'Enhanced PDF Processing',
    description: 'Advanced OCR and AI-powered text extraction from PDF attachments',
    key: 'enhancedServices.pdf' as const,
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Enhanced Email Parsing',
    description: 'Machine learning classification of email content and attachments',
    key: 'enhancedServices.email' as const,
  },
  {
    id: 'routing',
    icon: RoutePlanning,
    title: 'Enhanced Route Planning',
    description: 'AI-optimized travel routes with real-time traffic and location data',
    key: 'enhancedServices.routing' as const,
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Enhanced Calendar Sync',
    description: 'Intelligent calendar event creation and conflict resolution',
    key: 'enhancedServices.calendar' as const,
  },
  {
    id: 'aiClassification',
    icon: Brain,
    title: 'AI Classification',
    description: 'Automatic classification of schedule types, priorities, and departments',
    key: 'enhancedServices.aiClassification' as const,
  },
]

const mailParsingFeatures = [
  {
    id: 'autoDetectSchedules',
    title: 'Auto-detect Schedules',
    description: 'Automatically identify schedule information in emails',
  },
  {
    id: 'parseAttachments',
    title: 'Parse Attachments',
    description: 'Extract schedule data from PDF and Word document attachments',
  },
  {
    id: 'extractContacts',
    title: 'Extract Contacts',
    description: 'Identify and extract cast, crew, and contact information',
  },
  {
    id: 'extractEquipment',
    title: 'Extract Equipment',
    description: 'Parse equipment lists and technical requirements',
  },
  {
    id: 'extractSafetyNotes',
    title: 'Extract Safety Notes',
    description: 'Identify safety procedures and hazard information',
  },
]

export function SystemConfigStep({ data, updateData, onNext, onPrevious, onSkip, isFirstStep, isLastStep, isLoading }: StepProps): JSX.Element {
  const handleEnhancedServiceToggle = (key: string, value: boolean) => {
    const [category, service] = key.split('.') as [keyof typeof data.systemConfig, string]
    updateData({
      systemConfig: {
        ...data.systemConfig,
        [category]: {
          ...data.systemConfig[category],
          [service]: value,
        },
      },
    })
  }

  const handleMailParsingToggle = (feature: string, value: boolean) => {
    updateData({
      systemConfig: {
        ...data.systemConfig,
        mailParsing: {
          ...data.systemConfig.mailParsing,
          [feature]: value,
        },
      },
    })
  }

  const isStepComplete = true // This step is always valid as features can be toggled

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">System Configuration</h2>
        <p className="text-gray-600">
          Configure advanced AI and processing features for your film schedule automation.
        </p>
      </div>

      <div className="space-y-8">
        {/* Enhanced Services */}
        <div>
          <div className="flex items-center mb-4">
            <Cpu className="w-5 h-5 text-gray-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">Enhanced AI Services</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Enable advanced AI-powered features to enhance your schedule automation capabilities.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceFeatures.map((feature) => {
              const isEnabled = feature.key.split('.').reduce((obj, key) => obj[key], data.systemConfig) as boolean

              return (
                <label
                  key={feature.id}
                  className={`relative p-4 border rounded-lg cursor-pointer transition-colors ${
                    isEnabled
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => handleEnhancedServiceToggle(feature.key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <feature.icon className="w-4 h-4 text-gray-600 mr-2" aria-hidden="true" />
                        <span className="text-sm font-medium text-gray-900">{feature.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Mail Parsing Configuration */}
        <div>
          <div className="flex items-center mb-4">
            <Mail className="w-5 h-5 text-gray-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">Mail Parsing Features</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Configure what information to extract from emails and attachments.
          </p>

          <div className="space-y-3">
            {mailParsingFeatures.map((feature) => {
              const isEnabled = data.systemConfig.mailParsing[feature.id as keyof typeof data.systemConfig.mailParsing] as boolean

              return (
                <label
                  key={feature.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    isEnabled
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">{feature.title}</span>
                    <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => handleMailParsingToggle(feature.id, e.target.checked)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                </label>
              )
            })}
          </div>
        </div>

        {/* Performance Impact Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Cpu className="w-5 h-5 text-yellow-600" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Performance Considerations</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Enabling all enhanced AI services may increase processing time and API usage. You can always adjust these settings later based on your needs.</p>
                <p className="mt-2">
                  <strong>Recommended for most users:</strong> Enable Enhanced PDF Processing and AI Classification for the best experience.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-3">Current Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Enabled AI Services</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {serviceFeatures
                  .filter(feature => {
                    const value = feature.key.split('.').reduce((obj, key) => obj[key], data.systemConfig) as boolean
                    return value
                  })
                  .map(feature => (
                    <li key={feature.id} className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {feature.title}
                    </li>
                  ))}
                {serviceFeatures.filter(feature => {
                  const value = feature.key.split('.').reduce((obj, key) => obj[key], data.systemConfig) as boolean
                  return value
                }).length === 0 && (
                  <li className="text-gray-400 italic">No enhanced services enabled</li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Mail Parsing Features</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {mailParsingFeatures
                  .filter(feature => data.systemConfig.mailParsing[feature.id as keyof typeof data.systemConfig.mailParsing] as boolean)
                  .map(feature => (
                    <li key={feature.id} className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {feature.title}
                    </li>
                  ))}
                {mailParsingFeatures.filter(feature => data.systemConfig.mailParsing[feature.id as keyof typeof data.systemConfig.mailParsing] as boolean).length === 0 && (
                  <li className="text-gray-400 italic">No parsing features enabled</li>
                )}
              </ul>
            </div>
          </div>
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
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}