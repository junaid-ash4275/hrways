import { NavLink, useLocation } from 'react-router-dom'
import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useUI } from '../ui/UIContext'
import { useI18n } from '../i18n/i18n'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  BriefcaseIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  UserCircleIcon,
  KeyIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import logoUrl from '../assets/hrways-logo.svg'

export type NavItem = { to: string; label: string; Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element; adminOnly?: boolean }
export type NavGroup = { label: string; Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element; children: NavItem[]; adminOnly?: boolean }

export const navBase: Array<NavItem | NavGroup> = [
  { to: '/', label: 'Dashboard', Icon: HomeIcon },
  { to: '/employees', label: 'Employees', Icon: UsersIcon },
  { to: '/attendance', label: 'Attendance', Icon: ClipboardDocumentListIcon },
  { to: '/meetings', label: 'Meetings', Icon: CalendarIcon },
  { to: '/payroll', label: 'Payroll', Icon: BriefcaseIcon },
  {
    label: 'Settings',
    Icon: Cog6ToothIcon,
    children: [
      { to: '/settings/profile', label: 'Profile', Icon: UserCircleIcon },
      { to: '/settings/password', label: 'Change Password', Icon: KeyIcon },
      { to: '/settings/preferences', label: 'Preferences', Icon: AdjustmentsHorizontalIcon },
    ],
  },
  { to: '/admin', label: 'Admin', Icon: ShieldCheckIcon, adminOnly: true },
]

export default function Sidebar() {
  const { user } = useAuth()
  const { sidebarCollapsed } = useUI()
  const { t } = useI18n()
  const [hovering, setHovering] = useState(false)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => location.pathname.startsWith('/settings'))

  useEffect(() => {
    if (location.pathname.startsWith('/settings')) setSettingsOpen(true)
    else setSettingsOpen(false)
  }, [location.pathname])

  const handleEnter = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    enterTimer.current = window.setTimeout(() => setHovering(true), 120)
  }
  const handleLeave = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovering(false), 180)
  }

  const expanded = !sidebarCollapsed || hovering
  const isDashboardLike = location.pathname === '/' || location.pathname.startsWith('/celebrations')

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={
        `hidden md:block fixed md:relative inset-y-0 left-0 z-40 transform md:transform-none ` +
        `${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'} md:translate-x-0 ` +
        `${expanded ? 'md:w-64' : 'md:w-16'} w-64 ` +
        `md:sticky md:top-0 md:h-screen overflow-y-auto ` +
        `transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-neutral-800 p-4 bg-white/60 dark:bg-neutral-900/60 backdrop-blur`
      }
    >
      <div className={(expanded ? '' : 'justify-center') + ' flex items-center gap-3 mb-6'}>
        <img src={logoUrl} alt="HRWays" className="h-9 w-9" />
        {expanded && <h1 className="text-lg font-semibold">HRWays</h1>}
      </div>
      <nav aria-label="Primary">
        <ul className="space-y-1">
          {navBase
            .filter((n: any) => !(n as any).adminOnly || user?.role === 'ADMIN')
            .map((n: any, idx: number) => {
              const isGroup = !!n.children
              if (!isGroup) {
                const item = n as NavItem
                return (
                  <li key={(item as any).to ?? idx}>
                    <NavLink to={item.to} end={item.to === '/'}>
                      {({ isActive }) => {
                        const active = isActive || (item.to === '/' && isDashboardLike)
                        return (
                          <div
                            className={`group flex items-center gap-3 rounded-md px-3 py-2 transition
                              focus:outline-none focus:ring-2 brand-ring border border-transparent
                              ${active
                                ? 'brand-gradient text-white shadow'
                                : 'text-gray-700 dark:text-gray-200 brand-hover'}`}
                          >
                            <item.Icon className={`h-5 w-5 ${active ? 'text-white opacity-100' : 'opacity-80 group-hover:opacity-100'}`} />
                            {expanded && <span className="truncate">{t(item.label)}</span>}
                          </div>
                        )
                      }}
                    </NavLink>
                  </li>
                )
              }
              const group = n as NavGroup
              const open = settingsOpen
              return (
                <li key={`group-${idx}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    className={`w-full group flex items-center gap-3 rounded-md px-3 py-2 transition text-left
                      focus:outline-none focus:ring-2 brand-ring border border-transparent
                      ${open ? 'brand-open' : 'brand-hover'}
                      text-gray-700 dark:text-gray-200`}
                    onClick={() => setSettingsOpen(!open)}
                  >
                    <group.Icon className="h-5 w-5 opacity-80 group-hover:opacity-100" />
                    {expanded && <span className="truncate flex-1">{t(group.label)}</span>}
                    {expanded && <ChevronDownIcon className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />}
                  </button>
                  {expanded && open && (
                    <ul className="mt-1 ml-6 space-y-1" aria-label={`${t(group.label)} submenu`}>
                      {group.children.map((child) => (
                        <li key={child.to}>
                          <NavLink to={child.to}>
                            {({ isActive }) => (
                              <div
                                className={`group flex items-center gap-3 rounded-md px-3 py-2 transition
                                  focus:outline-none focus:ring-2 brand-ring border border-transparent
                                  ${isActive
                                    ? 'brand-gradient text-white shadow'
                                    : 'text-gray-700 dark:text-gray-200 brand-hover'}`}
                              >
                                <child.Icon className={`h-5 w-5 ${isActive ? 'text-white opacity-100' : 'opacity-75 group-hover:opacity-100'}`} />
                                <span className="truncate text-sm">{t(child.label)}</span>
                              </div>
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
        </ul>
      </nav>
    </aside>
  )
}

