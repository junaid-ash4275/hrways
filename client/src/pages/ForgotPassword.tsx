import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await http.post('/auth/request-reset', { email })
      setSubmitted(true)
      // optionally navigate to verify screen after a small delay
      setTimeout(() => nav('/verify-reset', { state: { email } }), 600)
    } catch {
      // Even if it fails, endpoint returns 202; keep UX same
      setSubmitted(true)
      setTimeout(() => nav('/verify-reset', { state: { email } }), 600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-xl border brand-border-soft dark:border-neutral-700">
        <h1 className="text-xl font-semibold mb-2">Forgot password</h1>
        <p className="text-sm opacity-80 mb-4">Enter your account email. We’ll send a 6‑digit code to verify it’s you.</p>
        <label className="block text-sm mb-1" htmlFor="email">Email</label>
        <input id="email" type="email" className="w-full mb-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button disabled={loading} className="w-full px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">
          {loading ? 'Sending…' : 'Send code'}
        </button>
        {submitted && (
          <div className="mt-3 text-sm brand-text">If an account exists, a code has been sent to your email.</div>
        )}
      </form>
    </div>
  )
}


