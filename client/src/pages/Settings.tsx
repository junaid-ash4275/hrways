import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { http } from '../api/http'

export default function Settings() {
  const { user } = useAuth()
  // Profile state (HRW-SET-1)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [pMsg, setPMsg] = useState<string | null>(null)
  const [pErr, setPErr] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load current profile
    http
      .get('/me/profile')
      .then((r) => r.data as any)
      .then((p) => {
        setFullName(p?.fullName || '')
        setPhone(p?.phone || '')
        setTitle(p?.title || '')
      })
      .catch(() => {})
  }, [])

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setPMsg(null)
    setPErr(null)
    try {
      const { data } = await http.put('/me/profile', { fullName, phone, title })
      setFullName(data?.fullName || '')
      setPhone(data?.phone || '')
      setTitle(data?.title || '')
      setPMsg('Profile updated')
    } catch (error: any) {
      const m = error?.response?.data?.error?.message || 'Failed to update profile'
      setPErr(m)
    }
  }

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match')
      return
    }
    try {
      setLoading(true)
      await http.post('/me/change-password', { currentPassword, newPassword })
      setMsg('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const m = error?.response?.data?.error?.message || 'Failed to update password'
      setErr(m)
    } finally {
      setLoading(false)
    }
  }

  const onRequestReset = async () => {
    if (!user?.email) return
    try {
      await http.post('/auth/request-reset', { email: user.email })
      setMsg('If your email is valid, a reset code has been sent')
    } catch {
      setMsg('If your email is valid, a reset code has been sent')
    }
  }

  useEffect(() => {
    const theme = localStorage.getItem('theme')
    if (theme === 'dark') document.documentElement.classList.add('dark')
  }, [])
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Settings</h2>
      <p className="opacity-80 mb-6">Profile, password, and preferences.</p>

      {/* Profile (HRW-SET-1) */}
      <form onSubmit={onSaveProfile} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 mb-6">
        <h3 className="font-semibold mb-3">Profile</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="fn">Full name</label>
            <input id="fn" type="text" className="w-full mb-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Alex Johnson" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="ph">Phone</label>
            <input id="ph" type="text" className="w-full mb-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., +1 (555) 123-4567" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="tt">Title</label>
            <input id="tt" type="text" className="w-full mb-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., HR Manager" />
          </div>
        </div>
        {pErr && <div className="mt-2 text-sm text-red-600" role="alert">{pErr}</div>}
        {pMsg && <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">{pMsg}</div>}
        <div className="mt-3">
          <button className="px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 transition">Save changes</button>
        </div>
      </form>

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
          <p className="text-sm opacity-80 mb-3">We’ll email a 6‑digit code to verify and let you set a new password.</p>
          <button onClick={onRequestReset} className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">Send reset code</button>
          <p className="text-xs opacity-70 mt-2">You’ll be redirected to verification after you receive the code.</p>
        </div>
      </div>
    </section>
  )
}
