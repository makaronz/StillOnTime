import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'

export default function OAuthCallback(): JSX.Element {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleOAuthCallback } = useAuthStore()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      toast.error(`Authentication failed: ${error}`)
      navigate('/login', { replace: true })
      return
    }

    if (!code || !state) {
      toast.error('Invalid authentication response')
      navigate('/login', { replace: true })
      return
    }

    handleOAuthCallback(code, state)
      .then(() => {
        navigate('/', { replace: true })
      })
      .catch(() => {
        navigate('/login', { replace: true })
      })
  }, [searchParams, handleOAuthCallback, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          Completing sign in...
        </h2>
        <p className="text-sm text-gray-600">
          Please wait while we verify your authentication.
        </p>
      </div>
    </div>
  )
}