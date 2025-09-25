import { Calendar } from 'lucide-react'

export default function Login(): JSX.Element {
  const handleGoogleLogin = (): void => {
    // TODO: Implement OAuth 2.0 login flow
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Calendar className="h-12 w-12 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            StillOnTime
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Film Schedule Automation System
          </p>
        </div>
        <div>
          <button
            onClick={handleGoogleLogin}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  )
}