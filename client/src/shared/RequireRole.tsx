import React from 'react'
import { useAuth, Role } from '../auth/AuthContext'
import Forbidden from '../pages/Forbidden'

export default function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth()
  const current = user?.role
  const allowed = role === 'HR' ? current === 'HR' || current === 'ADMIN' : current === 'ADMIN'
  if (!allowed) return <Forbidden />
  return <>{children}</>
}
