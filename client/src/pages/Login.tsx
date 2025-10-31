import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/hrways-logo.svg'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@hrways.local')
  const [password, setPassword] = useState('ChangeMe123')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      nav('/')
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const LOGIN_BG = (import.meta as any).env?.VITE_LOGIN_BG_URL ||
    "https://source.unsplash.com/1600x1200/?human%20resources,team,meeting,office"

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
      {/* Left brand panel */}
      <div
        className="hidden md:flex relative overflow-hidden items-center justify-center p-10 text-white"
        style={{
          backgroundImage: `url('${LOGIN_BG}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* overlays for readability and brand tint */}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/40 via-teal-600/40 to-cyan-600/30" />

        <div className="relative z-10 max-w-xl text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <img src={logoUrl} alt="HRWays" className="h-10 w-10" />
            <h1 className="text-2xl font-semibold">HRWays</h1>
          </div>

          <div>
            <h2 className="text-4xl font-extrabold leading-tight">Run HR without the hassle</h2>
            <p className="mt-2 opacity-90 text-sm md:text-base">A focused console for people ops — employees, attendance, meetings, and payroll — with strong RBAC and exports.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left text-sm">
            <div className="rounded-lg bg-white/10 backdrop-blur p-3 border border-white/20">
              <div className="font-semibold">Secure RBAC</div>
              <div className="opacity-90">ADMIN / HR roles</div>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur p-3 border border-white/20">
              <div className="font-semibold">In‑app Alerts</div>
              <div className="opacity-90">Birthdays & Anniv</div>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur p-3 border border-white/20">
              <div className="font-semibold">Exports</div>
              <div className="opacity-90">CSV & PDF ready</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs opacity-90">
            <div className="text-center">
              <div className="text-lg font-bold">2</div>
              <div>Roles</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">5</div>
              <div>Modules</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">∞</div>
              <div>Scalability</div>
            </div>
          </div>

          <p className="text-xs opacity-80">© {new Date().getFullYear()} HRWays • Built with care</p>
        </div>
      </div>

      {/* Right auth card */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
        <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-xl border brand-border-soft dark:border-neutral-700">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoUrl} alt="HRWays" className="h-7 w-7" />
            <h1 className="text-xl font-semibold">Sign in to HRWays</h1>
          </div>
          {error && (
            <div className="mb-3 text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input id="email" type="email" className="w-full mb-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 brand-ring" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <input id="password" type="password" className="w-full mb-6 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 brand-ring" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button disabled={loading} className="w-full px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="mt-4 text-sm text-center">
            <a href="/forgot-password" className="brand-text underline">Forgot password?</a>
          </div>
        </form>
      </div>
    </div>
  )
}


