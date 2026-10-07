import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken, getStoredUser, getToken, setStoredUser, setToken } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getStoredUser())
  const [sessionEnded, setSessionEnded] = useState(false)

  useEffect(() => {
    const handleExpired = () => {
      setUser(null)
      setSessionEnded(true)
      navigate('/login', { replace: true, state: { reason: 'expired' } })
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [navigate])

  const authenticate = useCallback((session) => {
    setToken(session.token)
    setStoredUser(session.user)
    setUser(session.user)
    setSessionEnded(false)
  }, [])

  const signup = useCallback(
    async (payload) => {
      const session = await api.post('/auth/signup', payload)
      authenticate(session)
      return session
    },
    [authenticate]
  )

  const login = useCallback(
    async (payload) => {
      const session = await api.post('/auth/login', payload)
      authenticate(session)
      return session
    },
    [authenticate]
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({ user, authenticated: Boolean(user) && Boolean(getToken()), sessionEnded, login, signup, logout }),
    [user, sessionEnded, login, signup, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}