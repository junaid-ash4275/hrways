import { useEffect } from 'react'
import { http } from '../api/http'
import { Outlet } from 'react-router-dom'
import Sidebar from '../shared/Sidebar'
import Topbar from '../shared/Topbar'
import { UIProvider } from '../ui/UIContext'

export default function App() {
  useEffect(() => {
    // Apply theme from local storage first
    const lsTheme = localStorage.getItem('theme')
    if (lsTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
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
        })
        .catch(() => {})
    }
  }, [])
  return (
    <UIProvider>
      <div className="min-h-screen flex bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </UIProvider>
  )
}
