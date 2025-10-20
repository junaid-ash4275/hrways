import React, { createContext, useContext, useMemo, useState } from 'react'

type UIState = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const Ctx = createContext<UIState | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setCollapsed] = useState<boolean>(() => {
    const v = localStorage.getItem('sidebarCollapsed')
    return v === '1'
  })
  const toggleSidebar = () => {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }
  const value = useMemo(() => ({ sidebarCollapsed, toggleSidebar }), [sidebarCollapsed])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUI() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}

