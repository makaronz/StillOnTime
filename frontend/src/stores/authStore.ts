import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name?: string
  googleId: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      login: (token: string, user: User) => {
        set({ token, user, isAuthenticated: true })
      },
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false })
      },
      checkAuth: () => {
        const { token } = get()
        if (token) {
          // TODO: Validate token with backend
          set({ isAuthenticated: true })
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)