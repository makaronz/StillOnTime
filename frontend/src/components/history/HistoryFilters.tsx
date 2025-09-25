import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Search, Filter, RefreshCw, X } from 'lucide-react'
import { ProcessingHistoryFilters } from '@/services/history'

interface HistoryFiltersProps {
  filters: ProcessingHistoryFilters
  onFiltersChange: (filters: ProcessingHistoryFilters) => void
  onExport: (format: 'csv' | 'json') => void
  onRefresh: () => void
  isLoading: boolean
}

export default function HistoryFilters({
  filters,
  onFiltersChange,
  onExport,
  onRefresh,
  isLoading,
}: HistoryFiltersProps): JSX.Element {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  const { register, handleSubmit, reset, watch } = useForm<ProcessingHistoryFilters>({
    defaultValues: filters,
  })

  const watchedFilters = watch()

  const onSubmit = (data: ProcessingHistoryFilters) => {
    // Remove empty values
    const cleanedFilters = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== '' && value !== undefined)
    )
    onFiltersChange(cleanedFilters)
  }

  const clearFilters = () => {
    reset({})
    onFiltersChange({})
  }

  const hasActiveFilters = Object.values(watchedFilters).some(value => value !== '' && value !== undefined)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Search & Filter</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <select
              onChange={(e) => onExport(e.target.value as 'csv' | 'json')}
              value=""
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" disabled>Export</option>
              <option value="csv">Export as CSV</option>
              <option value="json">Export as JSON</option>
            </select>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            {...register('search')}
            type="text"
            placeholder="Search by subject, sender, or location..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                {...register('status')}
                id="status"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                {...register('dateFrom')}
                type="date"
                id="dateFrom"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                {...register('dateTo')}
                type="date"
                id="dateTo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
            
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </button>
            )}
          </div>

          <div className="text-sm text-gray-500">
            {hasActiveFilters && 'Filters applied'}
          </div>
        </div>
      </form>
    </div>
  )
}