import React from 'react'
import { Play, BookOpen, Settings, Zap } from 'lucide-react'
import { StepProps } from '@/types/setup'

export function WelcomeStep({ data, updateData, onNext, onPrevious, onSkip, isFirstStep, isLastStep, isLoading }: StepProps): JSX.Element {
  const features = [
    {
      icon: BookOpen,
      title: 'Automatic Schedule Parsing',
      description: 'Automatically extract call sheets, schedules, and shooting details from your emails and attachments.',
    },
    {
      icon: Zap,
      title: 'Smart Calendar Integration',
      description: 'Seamlessly sync with Google Calendar to create and manage film production schedules.',
    },
    {
      icon: Settings,
      title: 'Intelligent Notifications',
      description: 'Get timely alerts about schedule changes, call times, and location updates.',
    },
    {
      icon: Play,
      title: 'Route Optimization',
      description: 'Optimize travel routes between shooting locations with real-time traffic data.',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Play className="w-8 h-8 text-blue-600" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to StillOnTime</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Let's get your film schedule automation system set up in just a few minutes.
          We'll guide you through connecting your accounts and configuring your preferences.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <feature.icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* What we'll set up */}
      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-3">What we'll set up:</h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex items-center">
            <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">1</span>
            Your personal preferences (timezone, working hours)
          </li>
          <li className="flex items-center">
            <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">2</span>
            Gmail integration for automatic email parsing
          </li>
          <li className="flex items-center">
            <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">3</span>
            Calendar synchronization
          </li>
          <li className="flex items-center">
            <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">4</span>
            System configuration and AI features
          </li>
        </ol>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          This setup should take about 5-10 minutes
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Skip setup
          </button>
          <button
            onClick={onNext}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : "Let's get started"}
          </button>
        </div>
      </div>
    </div>
  )
}