import React from 'react'
import { Check, Loader2 } from 'lucide-react'

interface Step {
  id: string
  title: string
}

interface SetupProgressProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
  className?: string
}

export function SetupProgress({ steps, currentStep, onStepClick, className = '' }: SetupProgressProps): JSX.Element {
  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed'
    if (stepIndex === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Progress bar background */}
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-gray-300" />
      </div>

      {/* Progress steps */}
      <div className="relative flex justify-between">
        {steps.map((step, stepIdx) => {
          const status = getStepStatus(stepIdx)
          const isClickable = status === 'completed' && onStepClick

          return (
            <div
              key={step.id}
              className={`
                relative flex items-center justify-center
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
              onClick={() => isClickable && onStepClick(stepIdx)}
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-colors duration-200
                  ${
                    status === 'completed'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : status === 'current'
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-white border-2 border-gray-300 text-gray-500'
                  }
                `}
              >
                {status === 'completed' ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : status === 'current' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <span>{stepIdx + 1}</span>
                )}
              </div>

              {/* Step label */}
              <div className="absolute mt-10 w-20 text-center">
                <span
                  className={`
                    text-xs font-medium
                    ${status === 'current' ? 'text-blue-600' :
                      status === 'completed' ? 'text-gray-900' : 'text-gray-500'}
                  `}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line (except for last step) */}
              {stepIdx < steps.length - 1 && (
                <div
                  className={`
                    absolute left-8 top-4 w-20 h-0.5 -translate-x-1/2
                    ${status === 'completed' ? 'bg-blue-600' : 'bg-gray-300'}
                  `}
                  style={{ width: 'calc(100% - 2rem)' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}