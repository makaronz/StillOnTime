import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { 
  Home, 
  Settings, 
  History, 
  LogOut,
  Calendar,
  Mail,
  Activity
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps): JSX.Element {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const skipLinkRef = useRef<HTMLAnchorElement>(null)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, description: 'View system dashboard and recent activity' },
    { name: 'Configuration', href: '/configuration', icon: Settings, description: 'Manage system settings and preferences' },
    { name: 'History', href: '/history', icon: History, description: 'View processed emails and schedules' },
    { name: 'Monitoring', href: '/monitoring', icon: Activity, description: 'Monitor system performance and health' },
  ]

  const isActive = (path: string): boolean => location.pathname === path

  // Focus management for route changes
  useEffect(() => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
    }
  }, [location.pathname])

  const handleSkipToContent = () => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to content link for accessibility */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50 focus:z-50"
      >
        Skip to main content
      </a>

      {/* Sidebar Navigation */}
      <nav 
        className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b border-gray-200">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-primary-600" aria-hidden="true" />
              <span className="ml-2 text-xl font-bold text-gray-900">StillOnTime</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 px-4 py-6">
            <ul className="space-y-2" role="list">
              {navigation.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        active
                          ? 'bg-primary-100 text-primary-700 border-l-4 border-primary-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      aria-current={active ? 'page' : undefined}
                      aria-describedby={`${item.name.toLowerCase()}-description`}
                    >
                      <Icon className="h-5 w-5 mr-3" aria-hidden="true" />
                      <span>{item.name}</span>
                      <span id={`${item.name.toLowerCase()}-description`} className="sr-only">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* User info and logout */}
          <div className="border-t border-gray-200 p-4" role="contentinfo">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center" aria-hidden="true">
                  <Mail className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900" aria-label={`Logged in as ${user?.name || 'User'}`}>
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500" aria-label={`Email: ${user?.email || 'Not available'}`}>
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Sign out of your account"
            >
              <LogOut className="h-4 w-4 mr-3" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="pl-64">
        <main 
          id="main-content"
          className="py-8 px-8 focus:outline-none"
          role="main"
          aria-label="Main content area"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}