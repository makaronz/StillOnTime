import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { AddressValidationResult } from '@/services/configuration'

const addressSchema = z.object({
  homeAddress: z.string().min(1, 'Home address is required'),
  panavisionAddress: z.string().min(1, 'Panavision address is required'),
})

type AddressFormData = z.infer<typeof addressSchema>

interface AddressConfigCardProps {
  homeAddress: string
  panavisionAddress: string
  onUpdate: (data: { homeAddress: string; panavisionAddress: string }) => Promise<void>
  onValidateAddress: (address: string) => Promise<AddressValidationResult>
  isSaving: boolean
}

export default function AddressConfigCard({
  homeAddress,
  panavisionAddress,
  onUpdate,
  onValidateAddress,
  isSaving,
}: AddressConfigCardProps): JSX.Element {
  const [validationResults, setValidationResults] = useState<{
    home?: AddressValidationResult
    panavision?: AddressValidationResult
  }>({})
  const [isValidating, setIsValidating] = useState<{
    home: boolean
    panavision: boolean
  }>({ home: false, panavision: false })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      homeAddress,
      panavisionAddress,
    },
  })

  const watchedHomeAddress = watch('homeAddress')
  const watchedPanavisionAddress = watch('panavisionAddress')

  const validateAddressField = async (address: string, field: 'home' | 'panavision') => {
    if (!address.trim()) return

    setIsValidating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await onValidateAddress(address)
      setValidationResults(prev => ({ ...prev, [field]: result }))
    } finally {
      setIsValidating(prev => ({ ...prev, [field]: false }))
    }
  }

  const onSubmit = async (data: AddressFormData) => {
    await onUpdate(data)
    // Clear validation results after successful update
    setValidationResults({})
  }

  const getValidationIcon = (field: 'home' | 'panavision') => {
    if (isValidating[field]) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
    
    const result = validationResults[field]
    if (!result) return null
    
    return result.isValid ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <MapPin className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Address Configuration</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Home Address */}
        <div>
          <label htmlFor="homeAddress" className="block text-sm font-medium text-gray-700 mb-2">
            Home Address
          </label>
          <div className="relative">
            <input
              {...register('homeAddress')}
              type="text"
              id="homeAddress"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Enter your home address"
              onBlur={() => validateAddressField(watchedHomeAddress, 'home')}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {getValidationIcon('home')}
            </div>
          </div>
          
          {errors.homeAddress && (
            <p className="mt-1 text-sm text-red-600">{errors.homeAddress.message}</p>
          )}
          
          {validationResults.home && !validationResults.home.isValid && (
            <p className="mt-1 text-sm text-red-600">{validationResults.home.error}</p>
          )}
          
          {validationResults.home?.isValid && validationResults.home.formattedAddress && (
            <p className="mt-1 text-sm text-green-600">
              ✓ Validated: {validationResults.home.formattedAddress}
            </p>
          )}
          
          <button
            type="button"
            onClick={() => validateAddressField(watchedHomeAddress, 'home')}
            disabled={isValidating.home || !watchedHomeAddress.trim()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            Validate Address
          </button>
        </div>

        {/* Panavision Address */}
        <div>
          <label htmlFor="panavisionAddress" className="block text-sm font-medium text-gray-700 mb-2">
            Panavision Address
          </label>
          <div className="relative">
            <input
              {...register('panavisionAddress')}
              type="text"
              id="panavisionAddress"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Enter Panavision office address"
              onBlur={() => validateAddressField(watchedPanavisionAddress, 'panavision')}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {getValidationIcon('panavision')}
            </div>
          </div>
          
          {errors.panavisionAddress && (
            <p className="mt-1 text-sm text-red-600">{errors.panavisionAddress.message}</p>
          )}
          
          {validationResults.panavision && !validationResults.panavision.isValid && (
            <p className="mt-1 text-sm text-red-600">{validationResults.panavision.error}</p>
          )}
          
          {validationResults.panavision?.isValid && validationResults.panavision.formattedAddress && (
            <p className="mt-1 text-sm text-green-600">
              ✓ Validated: {validationResults.panavision.formattedAddress}
            </p>
          )}
          
          <button
            type="button"
            onClick={() => validateAddressField(watchedPanavisionAddress, 'panavision')}
            disabled={isValidating.panavision || !watchedPanavisionAddress.trim()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            Validate Address
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
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
              'Save Addresses'
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> These addresses are used to calculate optimal routes for your shooting schedules. 
          The system will calculate: Home → Panavision → Shooting Location.
        </p>
      </div>
    </div>
  )
}