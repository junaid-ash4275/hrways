import React, { createContext, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; type: ToastType; message: string }

type UIState = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  notify: (t: { message: string; type?: ToastType }) => void
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

  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = ({ message, type = 'info' as ToastType }: { message: string; type?: ToastType }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    const t: Toast = { id, type, message }
    setToasts((arr) => [...arr, t])
    window.setTimeout(() => {
      setToasts((arr) => arr.filter((x) => x.id !== id))
    }, 2800)
  }

  const value = useMemo(() => ({ sidebarCollapsed, toggleSidebar, notify }), [sidebarCollapsed])
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className={`min-w-[260px] max-w-sm rounded-lg border shadow-lg px-4 py-3 text-sm backdrop-blur
              ${t.type === 'success' ? 'bg-white/80 dark:bg-neutral-800/80 brand-border-soft ' : ''}
              ${t.type === 'error' ? 'bg-white/80 dark:bg-neutral-800/80 border-red-300 dark:border-red-800' : ''}
              ${t.type === 'info' ? 'bg-white/80 dark:bg-neutral-800/80 border-gray-300 dark:border-neutral-700' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`h-2.5 w-2.5 mt-1.5 rounded-full flex-shrink-0
                ${t.type === 'success' ? 'brand-badge' : ''}
                ${t.type === 'error' ? 'bg-red-500' : ''}
                ${t.type === 'info' ? 'bg-gray-500' : ''}
              `} />
              <div className="flex-1 text-gray-900 dark:text-gray-100">{t.message}</div>
              <button
                className="text-xs px-1.5 py-0.5 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800"
                onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useUI() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}


