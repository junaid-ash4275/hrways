import React from 'react'
import { useAuth } from '../auth/AuthContext'
import { http } from '../api/http'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../ui/UIContext'
import { navBase } from './Sidebar'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n/i18n'
import { Bars3Icon, BellIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

export default function Topbar() {
  const { user, logout } = useAuth()
  const { toggleSidebar } = useUI()
  const nav = useNavigate()
  const { t } = useI18n()
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  const [now, setNow] = React.useState<Date>(new Date())
  const [locale, setLocale] = React.useState<string>(() => localStorage.getItem('lang') || 'en-US')
  const [tz, setTz] = React.useState<string | undefined>(() => localStorage.getItem('timezone') || undefined as any)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    const onPrefs = () => {
      setLocale(localStorage.getItem('lang') || 'en-US')
      setTz((localStorage.getItem('timezone') || undefined) as any)
    }
    window.addEventListener('hrw:prefs-updated', onPrefs as any)
    window.addEventListener('storage', onPrefs as any)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('hrw:prefs-updated', onPrefs as any)
      window.removeEventListener('storage', onPrefs as any)
    }
  }, [])

  const timeLabel = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(now)
    } catch {
      return now.toLocaleTimeString()
    }
  }, [now, locale, tz])

  return (
    <header className="relative z-50 h-14 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-4 bg-white md:bg-white/60 dark:bg-neutral-900 md:dark:bg-neutral-900/60 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => { setMobileOpen((v) => !v); toggleSidebar() }} className="p-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Toggle menu" title="Toggle menu">
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div className="text-sm opacity-80 truncate">
          {user ? `${user.email} | ${user.role}` : 'Welcome'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs opacity-70 px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">
          {timeLabel}
        </div>
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
      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)} />
          <nav className="md:hidden fixed top-14 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 shadow">
            <ul className="p-2 space-y-1">
              {navBase
                .filter((n: any) => !(n as any).adminOnly || user?.role === 'ADMIN')
                .map((n: any, idx: number) => {
                  const isGroup = !!n.children
                  if (!isGroup) {
                    const item = n as any
                    return (
                      <li key={item.to ?? idx}>
                        <NavLink to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}>
                          {({ isActive }) => (
                            <div className={`flex items-center gap-3 px-3 py-2 rounded-md ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                              <item.Icon className="h-5 w-5 opacity-80" />
                              <span className="truncate">{t(item.label)}</span>
                            </div>
                          )}
                        </NavLink>
                      </li>
                    )
                  }
                  const group = n as any
                  return (
                    <li key={`mgroup-${idx}`} className="px-2">
                      <div className="text-xs uppercase opacity-70 px-1 py-1">{t(group.label)}</div>
                      <ul className="pl-2">
                        {group.children.map((child: any) => (
                          <li key={child.to}>
                            <NavLink to={child.to} onClick={() => setMobileOpen(false)}>
                              {({ isActive }) => (
                                <div className={`flex items-center gap-3 px-3 py-2 rounded-md ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                                  <child.Icon className="h-4 w-4 opacity-80" />
                                  <span className="truncate text-sm">{t(child.label)}</span>
                                </div>
                              )}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
            </ul>
          </nav>
        </>
      )}
    </header>
  )
}
