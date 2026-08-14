import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  user_id: string
  email: string
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      isAuthenticated: () => {
        const { accessToken } = get()
        return !!accessToken
      },

      getAccessToken: () => get().accessToken,

      getRefreshToken: () => get().refreshToken,
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
