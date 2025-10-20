import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { http } from '../api/http'

export default function VerifyReset() {
  const loc = useLocation() as any
  const [email, setEmail] = useState<string>(loc?.state?.email || '')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await http.post<{ resetToken: string; expiresAt: string }>(
        '/auth/verify-reset-otp',
        { email, otp }
      )
      nav('/reset-password', { state: { resetToken: data.resetToken, email } })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Invalid code'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-xl border border-emerald-100/50 dark:border-neutral-700">
        <h1 className="text-xl font-semibold mb-2">Verify code</h1>
        <p className="text-sm opacity-80 mb-4">Enter the 6‑digit code sent to your email.</p>
        <label className="block text-sm mb-1" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900 cursor-not-allowed focus:outline-none"
          value={email}
          readOnly
          aria-readonly="true"
          title="Email is locked for verification"
          required
        />
        <label className="block text-sm mb-1" htmlFor="otp">Code</label>
        <input id="otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} className="w-full mb-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest text-center" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))} required />
        {error && <div className="mb-2 text-sm text-red-600" role="alert">{error}</div>}
        <button disabled={loading} className="w-full px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  )
}
