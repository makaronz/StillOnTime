import { useState } from 'react'
import { 
  X, 
  Mail, 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit3,
  Save,
  RotateCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { DetailedProcessedEmail } from '@/services/history'
import { ScheduleData } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'

interface EmailDetailsModalProps {
  email: DetailedProcessedEmail | null
  isOpen: boolean
  onClose: () => void
  onRetry: (emailId: string) => void
  onUpdateSchedule?: (scheduleId: string, updates: Partial<ScheduleData>) => Promise<void>
}

export default function EmailDetailsModal({
  email,
  isOpen,
  onClose,
  onRetry,
  onUpdateSchedule,
}: EmailDetailsModalProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedSchedule, setEditedSchedule] = useState<Partial<ScheduleData> | null>(null)

  if (!isOpen || !email) return <></>

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedSchedule(null)
    } else {
      setEditedSchedule(email.schedule || {})
    }
    setIsEditing(!isEditing)
  }

  const handleSave = async () => {
    if (!editedSchedule || !email.schedule || !onUpdateSchedule) return

    setIsSaving(true)
    try {
      await onUpdateSchedule(email.schedule.id, editedSchedule)
      setIsEditing(false)
      setEditedSchedule(null)
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusIcon = (status: DetailedProcessedEmail['processingStatus']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <Mail className="h-5 w-5 text-gray-400" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {getStatusIcon(email.processingStatus)}
              <h3 className="text-lg font-semibold text-gray-900">Email Details</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Information */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Email Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start space-x-2">
                      <Mail className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                        <p className="text-xs text-gray-500">Subject</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <User className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-900">{email.sender}</p>
                        <p className="text-xs text-gray-500">Sender</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-900">
                          {format(new Date(email.receivedAt), 'MMM d, yyyy HH:mm:ss')}
                        </p>
                        <p className="text-xs text-gray-500">Received</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <div className="mt-0.5">{getStatusIcon(email.processingStatus)}</div>
                      <div>
                        <p className="text-sm text-gray-900 capitalize">{email.processingStatus}</p>
                        <p className="text-xs text-gray-500">Status</p>
                      </div>
                    </div>

                    {email.processingTime && (
                      <div className="flex items-start space-x-2">
                        <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{email.processingTime}s</p>
                          <p className="text-xs text-gray-500">Processing Time</p>
                        </div>
                      </div>
                    )}

                    {email.retryCount && email.retryCount > 0 && (
                      <div className="flex items-start space-x-2">
                        <RotateCcw className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{email.retryCount}</p>
                          <p className="text-xs text-gray-500">Retry Attempts</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Information */}
                {email.error && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Error Details</h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800">{email.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Schedule Information</h4>
                  {email.schedule && onUpdateSchedule && (
                    <div className="flex items-center space-x-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center px-2 py-1 text-xs text-green-600 hover:text-green-800 border border-green-200 rounded transition-colors disabled:opacity-50"
                          >
                            {isSaving ? (
                              <LoadingSpinner size="sm" className="mr-1" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={handleEditToggle}
                            className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded transition-colors"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleEditToggle}
                          className="flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded transition-colors"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {email.schedule ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editedSchedule?.shootingDate ? 
                              format(new Date(editedSchedule.shootingDate), 'yyyy-MM-dd') : 
                              format(new Date(email.schedule.shootingDate), 'yyyy-MM-dd')
                            }
                            onChange={(e) => setEditedSchedule(prev => ({
                              ...prev,
                              shootingDate: new Date(e.target.value)
                            }))}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">
                            {format(new Date(email.schedule.shootingDate), 'MMM d, yyyy')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">Shooting Date</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            type="time"
                            value={editedSchedule?.callTime || email.schedule.callTime}
                            onChange={(e) => setEditedSchedule(prev => ({
                              ...prev,
                              callTime: e.target.value
                            }))}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{email.schedule.callTime}</p>
                        )}
                        <p className="text-xs text-gray-500">Call Time</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        {isEditing ? (
                          <textarea
                            value={editedSchedule?.location || email.schedule.location}
                            onChange={(e) => setEditedSchedule(prev => ({
                              ...prev,
                              location: e.target.value
                            }))}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{email.schedule.location}</p>
                        )}
                        <p className="text-xs text-gray-500">Location</p>
                      </div>
                    </div>

                    {email.schedule.sceneType && (
                      <div className="flex items-start space-x-2">
                        <div className="h-4 w-4 mt-0.5 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-500">
                            {email.schedule.sceneType}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{email.schedule.sceneType} Scene</p>
                          <p className="text-xs text-gray-500">Scene Type</p>
                        </div>
                      </div>
                    )}

                    {email.schedule.scenes && email.schedule.scenes.length > 0 && (
                      <div className="flex items-start space-x-2">
                        <div className="h-4 w-4 mt-0.5 flex items-center justify-center">
                          <span className="text-xs text-gray-500">#</span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{email.schedule.scenes.join(', ')}</p>
                          <p className="text-xs text-gray-500">Scenes</p>
                        </div>
                      </div>
                    )}

                    {email.schedule.safetyNotes && (
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{email.schedule.safetyNotes}</p>
                          <p className="text-xs text-gray-500">Safety Notes</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No schedule data extracted</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Message ID: {email.messageId}
            </div>
            <div className="flex items-center space-x-3">
              {email.processingStatus === 'failed' && (
                <button
                  onClick={() => onRetry(email.id)}
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry Processing
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}