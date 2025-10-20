import { NavLink } from 'react-router-dom'

import React, { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useUI } from '../ui/UIContext'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  BriefcaseIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import logoUrl from '../assets/hrways-logo.svg'

type NavItem = { to: string; label: string; Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element; adminOnly?: boolean }
const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: HomeIcon },
  { to: '/employees', label: 'Employees', Icon: UsersIcon },
  { to: '/attendance', label: 'Attendance', Icon: ClipboardDocumentListIcon },
  { to: '/meetings', label: 'Meetings', Icon: CalendarIcon },
  { to: '/payroll', label: 'Payroll', Icon: BriefcaseIcon },
  { to: '/settings', label: 'Settings', Icon: Cog6ToothIcon },
  { to: '/admin', label: 'Admin', Icon: ShieldCheckIcon, adminOnly: true },
]

export default function Sidebar() {
  const { user } = useAuth()
  const { sidebarCollapsed } = useUI()
  const [hovering, setHovering] = useState(false)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)

  const handleEnter = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    enterTimer.current = window.setTimeout(() => setHovering(true), 120)
  }
  const handleLeave = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovering(false), 180)
  }

  const expanded = !sidebarCollapsed || hovering
  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={(expanded ? 'w-64' : 'w-16') +
        " transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-neutral-800 p-4 bg-white/60 dark:bg-neutral-900/60 backdrop-blur"}
    >
      <div className={(expanded ? '' : 'justify-center') + " flex items-center gap-3 mb-6"}>
        <img src={logoUrl} alt="HRWays" className="h-9 w-9" />
        {expanded && <h1 className="text-lg font-semibold">HRWays</h1>}
      </div>
      <nav aria-label="Primary">
        <ul className="space-y-1">
          {nav.filter(n => !n.adminOnly || user?.role === 'ADMIN').map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === '/'}>
                {({ isActive }) => (
                  <div
                    className={`group flex items-center gap-3 rounded-md px-3 py-2 transition
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent
                      ${isActive
                        ? 'brand-gradient text-white shadow'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                  >
                    <n.Icon className={`h-5 w-5 ${isActive ? 'text-white opacity-100' : 'opacity-80 group-hover:opacity-100'}`} />
                    {expanded && <span className="truncate">{n.label}</span>}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
