import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Clock, RotateCcw, Loader2 } from 'lucide-react'
import { TimeBuffers } from '@/types'

const timeBufferSchema = z.object({
  carChange: z.number().min(0).max(60),
  parking: z.number().min(0).max(30),
  entry: z.number().min(0).max(30),
  traffic: z.number().min(0).max(60),
  morningRoutine: z.number().min(0).max(120),
})

type TimeBufferFormData = z.infer<typeof timeBufferSchema>

interface TimeBufferConfigCardProps {
  buffers: TimeBuffers
  onUpdate: (data: { buffers: TimeBuffers }) => Promise<void>
  isSaving: boolean
}

const PRESET_CONFIGS = {
  conservative: {
    name: 'Conservative',
    description: 'Extra time for safety',
    buffers: {
      carChange: 20,
      parking: 15,
      entry: 15,
      traffic: 30,
      morningRoutine: 60,
    },
  },
  standard: {
    name: 'Standard',
    description: 'Recommended settings',
    buffers: {
      carChange: 15,
      parking: 10,
      entry: 10,
      traffic: 20,
      morningRoutine: 45,
    },
  },
  minimal: {
    name: 'Minimal',
    description: 'Tight schedule',
    buffers: {
      carChange: 10,
      parking: 5,
      entry: 5,
      traffic: 15,
      morningRoutine: 30,
    },
  },
}

export default function TimeBufferConfigCard({
  buffers,
  onUpdate,
  isSaving,
}: TimeBufferConfigCardProps): JSX.Element {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
  } = useForm<TimeBufferFormData>({
    resolver: zodResolver(timeBufferSchema),
    defaultValues: buffers,
  })

  const watchedBuffers = watch()

  const applyPreset = (presetKey: string) => {
    const preset = PRESET_CONFIGS[presetKey as keyof typeof PRESET_CONFIGS]
    if (preset) {
      Object.entries(preset.buffers).forEach(([key, value]) => {
        setValue(key as keyof TimeBufferFormData, value, { shouldDirty: true })
      })
      setSelectedPreset(presetKey)
    }
  }

  const resetToDefaults = () => {
    applyPreset('standard')
  }

  const onSubmit = async (data: TimeBufferFormData) => {
    await onUpdate({ buffers: data })
  }

  const getTotalBuffer = () => {
    return Object.values(watchedBuffers).reduce((sum, value) => sum + (value || 0), 0)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <Clock className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Time Buffer Configuration</h3>
      </div>

      {/* Preset Configurations */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(PRESET_CONFIGS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`p-3 border rounded-lg text-left transition-colors ${
                selectedPreset === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{preset.name}</div>
              <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
              <div className="text-xs text-gray-400 mt-1">
                Total: {Object.values(preset.buffers).reduce((sum, val) => sum + val, 0)} min
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Buffer Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="carChange" className="block text-sm font-medium text-gray-700 mb-2">
              Car Change Buffer
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register('carChange', { valueAsNumber: true })}
                type="number"
                id="carChange"
                min="0"
                max="60"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            {errors.carChange && (
              <p className="mt-1 text-sm text-red-600">{errors.carChange.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Time to change cars at Panavision</p>
          </div>

          <div>
            <label htmlFor="parking" className="block text-sm font-medium text-gray-700 mb-2">
              Parking Buffer
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register('parking', { valueAsNumber: true })}
                type="number"
                id="parking"
                min="0"
                max="30"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            {errors.parking && (
              <p className="mt-1 text-sm text-red-600">{errors.parking.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Time to find parking at location</p>
          </div>

          <div>
            <label htmlFor="entry" className="block text-sm font-medium text-gray-700 mb-2">
              Entry Buffer
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register('entry', { valueAsNumber: true })}
                type="number"
                id="entry"
                min="0"
                max="30"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            {errors.entry && (
              <p className="mt-1 text-sm text-red-600">{errors.entry.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Time for check-in and setup</p>
          </div>

          <div>
            <label htmlFor="traffic" className="block text-sm font-medium text-gray-700 mb-2">
              Traffic Buffer
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register('traffic', { valueAsNumber: true })}
                type="number"
                id="traffic"
                min="0"
                max="60"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            {errors.traffic && (
              <p className="mt-1 text-sm text-red-600">{errors.traffic.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Extra time for unexpected traffic</p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="morningRoutine" className="block text-sm font-medium text-gray-700 mb-2">
              Morning Routine Buffer
            </label>
            <div className="flex items-center space-x-2">
              <input
                {...register('morningRoutine', { valueAsNumber: true })}
                type="number"
                id="morningRoutine"
                min="0"
                max="120"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            {errors.morningRoutine && (
              <p className="mt-1 text-sm text-red-600">{errors.morningRoutine.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Time for getting ready in the morning</p>
          </div>
        </div>

        {/* Total Time Display */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total Buffer Time:</span>
            <span className="text-lg font-bold text-blue-600">{getTotalBuffer()} minutes</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This is the total time added to your travel time for wake-up calculation
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </button>

          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Saving...
              </>
            ) : (
              'Save Buffer Settings'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}