import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './styles/index.css'
import './utils/sessionManager' // Initialize session management

// Initialize connection check
import './stores/connectionStore'

// Register service worker for offline support
import ServiceWorkerRegistration from './components/performance/ServiceWorkerRegistration'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ServiceWorkerRegistration />
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
