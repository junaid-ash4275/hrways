import React from 'react'
import { useAuth } from '../auth/AuthContext'
import { http } from '../api/http'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../ui/UIContext'
import { Bars3Icon, BellIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

export default function Topbar() {
  const { user, logout } = useAuth()
  const { toggleSidebar } = useUI()
  const nav = useNavigate()
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  return (
    <header className="h-14 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-4 bg-white/60 dark:bg-neutral-900/60 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={toggleSidebar} className="p-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Toggle sidebar" title="Toggle sidebar">
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div className="text-sm opacity-80 truncate">{user ? `${user.email} • ${user.role}` : 'Welcome'}</div>
      </div>
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Notifications" title="Notifications">
          <BellIcon className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 text-[10px] bg-emerald-600 text-white rounded-full px-1.5">3</span>
        </button>
        <button
          className="p-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={() => {
            const root = document.documentElement
            const next = root.classList.toggle('dark')
            setIsDark(next)
            const theme = next ? 'dark' : 'light'
            localStorage.setItem('theme', theme)
            const token = localStorage.getItem('accessToken')
            if (token) {
              http.put('/me/preferences', { theme }).catch(() => {})
            }
          }}
        >
          {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>
        {user && (
          <button
            className="p-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Logout"
            title="Logout"
            onClick={async () => {
              await logout()
              nav('/login')
            }}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  )
}
