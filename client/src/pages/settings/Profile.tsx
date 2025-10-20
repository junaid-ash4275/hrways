import { FormEvent, useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { useUI } from '../../ui/UIContext'
import { useI18n } from '../../i18n/i18n'

export default function SettingsProfile() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const { notify } = useUI()
  const { t } = useI18n()
  const phoneRegex = useMemo(() => /^[0-9+\-()\s]{6,}$/ , [])

  useEffect(() => {
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
    try {
      if (phone && !phoneRegex.test(phone)) {
        notify({ type: 'error', message: 'Please enter a valid phone (digits, space, +, -, ())' })
        return
      }
      const { data } = await http.put('/me/profile', { fullName, phone, title })
      setFullName(data?.fullName || '')
      setPhone(data?.phone || '')
      setTitle(data?.title || '')
      notify({ type: 'success', message: 'Profile updated successfully' })
    } catch (error: any) {
      const m = error?.response?.data?.error?.message || 'Failed to update profile'
      notify({ type: 'error', message: m })
    }
  }

  const initials = useMemo(() => {
    const src = fullName || user?.email || ''
    const parts = src.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/)
    const init = parts.length >= 2 ? (parts[0][0] + parts[1][0]) : (parts[0]?.[0] || 'U')
    return init.toUpperCase()
  }, [fullName, user?.email])

  const completeness = useMemo(() => {
    let c = 0
    if (fullName) c++
    if (phone) c++
    if (title) c++
    return Math.round((c / 3) * 100)
  }, [fullName, phone, title])

  return (
    <div className="space-y-6">
      {/* Account header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{fullName || user?.email?.split('@')[0] || t('User')}</div>
          <div className="text-sm opacity-80 truncate">{user?.email}</div>
        </div>
        {user?.role && (
          <span className="text-xs px-2 py-1 rounded-full border border-emerald-500 text-emerald-700 dark:text-emerald-400">
            {user.role}
          </span>
        )}
      </div>

      {/* Profile form */}
      <form onSubmit={onSaveProfile} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{t('Profile')}</h3>
          <div className="text-xs opacity-70">Completeness: {completeness}%</div>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-neutral-700 rounded mb-4 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="fn">{t('Full name')}</label>
            <input id="fn" type="text" className="w-full mb-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Alex Johnson" />
            <p className="text-xs opacity-70">This appears on internal reports.</p>
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="ph">{t('Phone')}</label>
            <input
              id="ph"
              type="text"
              className={`w-full mb-1 px-3 py-2 rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 ${phone && !phoneRegex.test(phone) ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-neutral-700'}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +1 (555) 123-4567"
              aria-invalid={!!(phone && !phoneRegex.test(phone))}
              pattern="^[0-9+\-()\s]{6,}$"
              title="Use digits, spaces, +, -, () (min 6 characters)"
            />
            <p className={`text-xs ${phone && !phoneRegex.test(phone) ? 'text-red-600' : 'opacity-70'}`}>{t('Digits, spaces, +, -, and () allowed.')}</p>
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="tt">{t('Title')}</label>
            <input id="tt" type="text" className="w-full mb-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., HR Manager" />
            <p className="text-xs opacity-70">Your role or designation.</p>
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 transition">{t('Save changes')}</button>
        </div>
      </form>

      {/* Helpful tips */}
      <div className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30 p-4 text-sm">
        Tip: Keeping your name and title updated helps teammates find you quickly across modules.
      </div>
    </div>
  )
}
