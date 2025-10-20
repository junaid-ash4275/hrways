import { FormEvent, useState } from 'react'
import { http } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { useUI } from '../../ui/UIContext'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/i18n'

export default function SettingsPassword() {
  const { user } = useAuth()
  const { notify } = useUI()
  const nav = useNavigate()
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (currentPassword === newPassword) {
      const m = 'New password must be different from current password'
      setErr(m)
      notify({ type: 'error', message: m })
      return
    }
    if (newPassword !== confirmPassword) {
      const m = 'Passwords do not match'
      setErr(m)
      notify({ type: 'error', message: m })
      return
    }
    try {
      setLoading(true)
      await http.post('/me/change-password', { currentPassword, newPassword })
      const m = t('Password updated successfully')
      setMsg(m)
      notify({ type: 'success', message: m })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const m = error?.response?.data?.error?.message || t('Failed to update password')
      setErr(m)
      notify({ type: 'error', message: m })
    } finally {
      setLoading(false)
    }
  }

  const onRequestReset = async () => {
    if (!user?.email) {
      notify({ type: 'error', message: 'No account email found' })
      return
    }
    try {
      await http.post('/auth/request-reset', { email: user.email })
      const m = 'If your email is valid, a reset code has been sent'
      setMsg(m)
      notify({ type: 'success', message: m })
      // Navigate to verification so user can enter the OTP
      nav('/verify-reset', { state: { email: user.email } })
    } catch {
      const m = 'If your email is valid, a reset code has been sent'
      setMsg(m)
      notify({ type: 'info', message: m })
      nav('/verify-reset', { state: { email: user.email } })
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={onChangePassword} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
        <h3 className="font-semibold mb-3">Change password</h3>
        <label className="block text-sm mb-1" htmlFor="cur">Current password</label>
        <input id="cur" type="password" className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <label className="block text-sm mb-1" htmlFor="npw">New password</label>
        <input id="npw" type="password" className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <label className="block text-sm mb-1" htmlFor="cpw">Confirm new password</label>
        <input id="cpw" type="password" className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <p className="text-xs opacity-70 mb-3">Must be at least 8 characters and include upper, lower, and a digit.</p>
        {err && <div className="mb-2 text-sm text-red-600" role="alert">{err}</div>}
        {msg && <div className="mb-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">{msg}</div>}
        <button disabled={loading} className="px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">{loading ? 'Updating…' : 'Update password'}</button>
      </form>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
        <h3 className="font-semibold mb-3">Reset via email</h3>
        <p className="text-sm opacity-80 mb-3">We'll email a 6-digit code to verify and let you set a new password.</p>
        <button onClick={onRequestReset} className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">Send reset code</button>
        <p className="text-xs opacity-70 mt-2">You'll be redirected to verification after you receive the code.</p>
      </div>
    </div>
  )
}
