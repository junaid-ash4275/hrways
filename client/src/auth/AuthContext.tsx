import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { http, saveTokens, clearTokens } from '../api/http'

export type Role = 'ADMIN' | 'HR'

type User = { id: string; email: string; role: Role }

type AuthState = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    http
      .get<User>('/me')
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        setUser(null)
      })
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await http.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password })
    saveTokens(data.accessToken, data.refreshToken)
    const me = await http.get<User>('/me')
    setUser(me.data)
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      if (refreshToken) await http.post('/auth/logout', { refreshToken })
    } catch {}
    clearTokens()
    setUser(null)
  }

  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
