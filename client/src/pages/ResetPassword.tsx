import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { http } from '../api/http'

export default function ResetPassword() {
  const loc = useLocation() as any
  const nav = useNavigate()
  const resetToken = loc?.state?.resetToken as string | undefined
  const email = loc?.state?.email as string | undefined
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pw1 !== pw2) {
      setError('Passwords do not match')
      return
    }
    try {
      setLoading(true)
      await http.post('/auth/reset', { resetToken, newPassword: pw1 })
      nav('/login', { state: { msg: 'Password updated. Please sign in.' } })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Reset failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 p-6">
        <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-xl border border-emerald-100/50 dark:border-neutral-700">
          <h1 className="text-xl font-semibold mb-2">Reset password</h1>
          <p className="text-sm opacity-80">Your reset session has expired. Please <a href="/forgot-password" className="underline text-emerald-700 dark:text-emerald-400">request a new code</a>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-xl border border-emerald-100/50 dark:border-neutral-700">
        <h1 className="text-xl font-semibold mb-2">Set a new password</h1>
        {email && <p className="text-sm opacity-80 mb-4">Account: {email}</p>}
        <label className="block text-sm mb-1" htmlFor="pw1">New password</label>
        <input id="pw1" type="password" className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={pw1} onChange={(e) => setPw1(e.target.value)} required />
        <label className="block text-sm mb-1" htmlFor="pw2">Confirm password</label>
        <input id="pw2" type="password" className="w-full mb-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        {error && <div className="mb-2 text-sm text-red-600" role="alert">{error}</div>}
        <p className="text-xs opacity-70 mb-3">Must be at least 8 characters and include upper, lower, and a digit.</p>
        <button disabled={loading} className="w-full px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

