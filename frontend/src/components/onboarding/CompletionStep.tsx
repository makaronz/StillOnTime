import React from 'react'
import { CheckCircle, Sparkles, ArrowRight, Settings } from 'lucide-react'

interface CompletionStepProps {
  onComplete: () => void
  onRestart: () => void
}

export function CompletionStep({ onComplete, onRestart }: CompletionStepProps): JSX.Element {
  const features = [
    {
      icon: '📧',
      title: 'Gmail Integration',
      description: 'Automatic parsing of schedules from emails',
    },
    {
      icon: '📅',
      title: 'Calendar Sync',
      description: 'Seamless calendar event creation and updates',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Processing',
      description: 'Smart extraction of schedule information',
    },
    {
      icon: '📍',
      title: 'Route Optimization',
      description: 'Efficient travel planning between locations',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup Complete!</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Your StillOnTime film schedule automation system is now configured and ready to use.
          You can start receiving and managing film schedules automatically.
        </p>
      </div>

      {/* Features activated */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">What's Now Available</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">{feature.icon}</span>
              <div>
                <h4 className="font-medium text-gray-900">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="font-medium text-blue-900 mb-4">Next Steps</h3>
        <ol className="space-y-3 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="font-medium mr-2">1.</span>
            <div>
              <strong>Check your dashboard</strong> - View your current schedules and upcoming events
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">2.</span>
            <div>
              <strong>Test email parsing</strong> - Forward a call sheet to your connected Gmail account
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">3.</span>
            <div>
              <strong>Review calendar events</strong> - Check that parsed schedules appear correctly
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">4.</span>
            <div>
              <strong>Customize settings</strong> - Adjust preferences and AI features as needed
            </div>
          </li>
        </ol>
      </div>

      {/* Tips section */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center">
          <Sparkles className="w-5 h-5 text-yellow-500 mr-2" aria-hidden="true" />
          Pro Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Email Organization</h4>
            <ul className="space-y-1">
              <li>• Create labels for different production types</li>
              <li>• Set up email filters for schedule emails</li>
              <li>• Use consistent subject lines</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Best Practices</h4>
            <ul className="space-y-1">
              <li>• Review parsed schedules for accuracy</li>
              <li>• Keep calendar permissions up to date</li>
              <li>• Monitor sync status regularly</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Support section */}
      <div className="text-center mb-8">
        <p className="text-sm text-gray-600 mb-4">
          Need help? Check our documentation or contact support
        </p>
        <div className="flex justify-center space-x-4">
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Documentation
          </button>
          <span className="text-gray-400">•</span>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Contact Support
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRestart}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
          Review Settings
        </button>
        <button
          onClick={onComplete}
          className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}