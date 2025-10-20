import { useEffect, useCallback, useRef } from 'react'
import { useSetupStore } from '@/stores/setupStore'
import { useAuthStore } from '@/stores/authStore'

interface MemoryData {
  setupProgress?: {
    currentStep: number
    isCompleted: boolean
    lastUpdated: string
  }
  userPreferences?: {
    timezone: string
    notifications: Record<string, boolean>
  }
  serviceConnections?: Record<string, {
    status: string
    lastChecked: string
  }>
}

export function useMemorySync() {
  const {
    currentStep,
    isCompleted,
    setupData,
    serviceConnections,
    saveProgress,
    loadProgress
  } = useSetupStore()

  const { user, isAuthenticated } = useAuthStore()
  const syncIntervalRef = useRef<NodeJS.Timeout>()
  const lastSyncRef = useRef<MemoryData | null>(null)

  // Sync setup data to memory/backend
  const syncToMemory = useCallback(async (force = false) => {
    if (!isAuthenticated) return

    const currentData: MemoryData = {
      setupProgress: {
        currentStep,
        isCompleted,
        lastUpdated: new Date().toISOString(),
      },
      userPreferences: {
        timezone: setupData.userPreferences.timezone,
        notifications: setupData.userPreferences.notifications,
      },
      serviceConnections: Object.entries(serviceConnections).reduce((acc, [key, value]) => {
        acc[key] = {
          status: value.status,
          lastChecked: value.lastChecked.toISOString(),
        }
        return acc
      }, {} as Record<string, { status: string; lastChecked: string }>),
    }

    // Skip sync if data hasn't changed (unless forced)
    if (!force && lastSyncRef.current && JSON.stringify(currentData) === JSON.stringify(lastSyncRef.current)) {
      return
    }

    try {
      // Save to local storage as fallback
      localStorage.setItem('stillontime-memory', JSON.stringify(currentData))

      // Sync to backend if API is available
      await saveProgress()

      lastSyncRef.current = currentData
      console.log('Setup data synced to memory:', { currentStep, isCompleted })
    } catch (error) {
      console.error('Failed to sync to memory:', error)
    }
  }, [isAuthenticated, currentStep, isCompleted, setupData, serviceConnections, saveProgress])

  // Load data from memory/backend
  const loadFromMemory = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      // Load from local storage
      const storedData = localStorage.getItem('stillontime-memory')
      if (storedData) {
        const memoryData: MemoryData = JSON.parse(storedData)

        // Update store with memory data if newer
        if (memoryData.setupProgress) {
          await loadProgress()
        }
      }

      // Also load from store's built-in persistence
      await loadProgress()
    } catch (error) {
      console.error('Failed to load from memory:', error)
    }
  }, [isAuthenticated, loadProgress])

  // Clear memory data
  const clearMemory = useCallback(() => {
    try {
      localStorage.removeItem('stillontime-memory')
      localStorage.removeItem('setup-progress')
      lastSyncRef.current = null
      console.log('Memory data cleared')
    } catch (error) {
      console.error('Failed to clear memory:', error)
    }
  }, [])

  // Force immediate sync
  const forceSync = useCallback(() => {
    syncToMemory(true)
  }, [syncToMemory])

  // Set up periodic sync
  useEffect(() => {
    if (isAuthenticated) {
      // Initial load
      loadFromMemory()

      // Set up periodic sync (every 30 seconds)
      syncIntervalRef.current = setInterval(() => {
        syncToMemory()
      }, 30000)

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current)
        }
      }
    }
  }, [isAuthenticated, loadFromMemory, syncToMemory])

  // Sync on important changes
  useEffect(() => {
    if (isAuthenticated) {
      // Debounced sync on step change
      const timeoutId = setTimeout(() => {
        syncToMemory()
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [currentStep, isAuthenticated, syncToMemory])

  // Sync on completion
  useEffect(() => {
    if (isAuthenticated && isCompleted) {
      syncToMemory(true)
    }
  }, [isCompleted, isAuthenticated, syncToMemory])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  return {
    syncToMemory,
    loadFromMemory,
    clearMemory,
    forceSync,
    lastSync: lastSyncRef.current,
  }
}