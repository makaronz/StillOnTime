import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Configuration from '@/pages/Configuration'
import History from '@/pages/History'
import Layout from '@/components/Layout'

function App(): JSX.Element {
  const { isAuthenticated, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/history" element={<History />} />
        <Route path="/auth/callback" element={<Dashboard />} />
      </Routes>
    </Layout>
  )
}

export default App