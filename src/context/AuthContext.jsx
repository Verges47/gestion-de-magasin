import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

const STORAGE_KEY = 'stockscan.session'

const AuthContext = createContext(null)

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)
  const [loading, setLoading] = useState(true)

  // Au démarrage, on valide le jeton auprès de l'API si une session existe.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const s = loadSession()
      if (!s?.token) {
        setLoading(false)
        return
      }
      try {
        const { user } = await apiFetch('/me.php', { token: s.token })
        if (!cancelled) setSession({ token: s.token, user })
      } catch {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY)
          setSession(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((next) => {
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    setSession(next)
  }, [])

  const login = useCallback(
    async (loginId, password) => {
      const { token, user } = await apiFetch('/login.php', {
        method: 'POST',
        body: { login: loginId, password },
      })
      const next = { token, user }
      persist(next)
      return user
    },
    [persist],
  )

  const logout = useCallback(async () => {
    const s = loadSession()
    if (s?.token) {
      try {
        await apiFetch('/logout.php', { method: 'POST', token: s.token })
      } catch {
        // Ignore : on déconnecte localement dans tous les cas.
      }
    }
    persist(null)
  }, [persist])

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const s = loadSession()
      await apiFetch('/change-password.php', {
        method: 'POST',
        token: s?.token,
        body: { current_password: currentPassword, new_password: newPassword },
      })
    },
    [],
  )

  const updateProfile = useCallback(
    async (name, login, email, phone) => {
      const s = loadSession()
      const { user } = await apiFetch('/update-profile.php', {
        method: 'POST',
        token: s?.token,
        body: { name, login, email, phone },
      })
      const next = { token: s.token, user }
      persist(next)
      return user
    },
    [persist],
  )

  const value = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    loading,
    login,
    logout,
    changePassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
