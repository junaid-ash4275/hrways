import { useEffect } from 'react'
import { http } from '../api/http'
import { Outlet } from 'react-router-dom'
import Sidebar from '../shared/Sidebar'
import Topbar from '../shared/Topbar'
import { UIProvider } from '../ui/UIContext'
import { I18nProvider } from '../i18n/i18n'

export default function App() {
  useEffect(() => {
    // Apply theme from local storage first
    const lsTheme = localStorage.getItem('theme')
    if (lsTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    // Apply brand variant from local storage first
    const applyBrand = (v?: string) => {
      const root = document.documentElement
      const all = ['brand-emerald','brand-blue','brand-orange','brand-violet','brand-rose']
      all.forEach((c) => root.classList.remove(c))
      const key = (v || 'emerald').toLowerCase()
      const cls = `brand-${key}`
      if (all.includes(cls)) root.classList.add(cls)
    }
    const lsBrand = localStorage.getItem('brandVariant') || 'emerald'
    applyBrand(lsBrand)
    // Apply text size from local storage first
    const lsScale = Number(localStorage.getItem('textScale') || 100)
    if (Number.isFinite(lsScale)) {
      document.documentElement.style.fontSize = `${Math.round(lsScale)}%`
    }
    // Apply locale and direction from local storage first
    const lsLang = localStorage.getItem('lang') || 'en-US'
    document.documentElement.lang = lsLang
    document.documentElement.dir = /^(ar|fa|ur|he)/i.test(lsLang) ? 'rtl' : 'ltr'
    // If logged in (token present), hydrate from server preferences
    const token = localStorage.getItem('accessToken')
    if (token) {
      http
        .get('/me/preferences')
        .then((r) => r.data as any)
        .then((prefs) => {
          const theme = prefs?.theme
          if (theme === 'dark' || theme === 'light') {
            if (theme === 'dark') document.documentElement.classList.add('dark')
            else document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', theme)
          }
          const brand = prefs?.brandVariant
          if (typeof brand === 'string' && brand) {
            localStorage.setItem('brandVariant', brand)
            applyBrand(brand)
          }
          const textScale = Number(prefs?.textScale)
          if (Number.isFinite(textScale) && textScale >= 90 && textScale <= 120) {
            const pct = Math.round(textScale)
            document.documentElement.style.fontSize = `${pct}%`
            localStorage.setItem('textScale', String(pct))
          }
          const lang = prefs?.language
          if (typeof lang === 'string' && lang) {
            document.documentElement.lang = lang
            document.documentElement.dir = /^(ar|fa|ur|he)/i.test(lang) ? 'rtl' : 'ltr'
            localStorage.setItem('lang', lang)
          }
          const tz = prefs?.timezone
          if (typeof tz === 'string' && tz) {
            localStorage.setItem('timezone', tz)
          }
        })
        .catch(() => {})
    }
  }, [])
  return (
    <UIProvider>
      <I18nProvider>
        <div className="h-screen flex bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col max-h-screen">
            <Topbar />
            <main className="p-4 overflow-y-auto flex-1">
              <Outlet />
            </main>
          </div>
        </div>
      </I18nProvider>
    </UIProvider>
  )
}
