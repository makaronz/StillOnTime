import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Configuration from '@/pages/Configuration'
import History from '@/pages/History'
import { Monitoring } from '@/pages/Monitoring'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import OAuthCallback from '@/components/OAuthCallback'

function App(): JSX.Element {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuration"
        element={
          <ProtectedRoute>
            <Layout>
              <Configuration />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Layout>
              <History />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitoring"
        element={
          <ProtectedRoute>
            <Layout>
              <Monitoring />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App