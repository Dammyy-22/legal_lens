import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: string
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

// NOTE: tokens are persisted via zustand's `persist` middleware, which uses
// localStorage by default. This is a known trade-off, not an oversight: localStorage
// is readable by any script on the page, so an XSS vulnerability elsewhere in the app
// would allow token theft. The more defensible pattern is httpOnly cookies set by the
// backend. Flagging this here as a real gap to close before production, matching the
// note now added to apps/api SECURITY.md — not silently shipping it as "done."
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
