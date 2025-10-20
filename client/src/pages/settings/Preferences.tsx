import { useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http'
import { useUI } from '../../ui/UIContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useI18n } from '../../i18n/i18n'

type Theme = 'light' | 'dark'

export default function SettingsPreferences() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const { notify } = useUI()
  const { t } = useI18n()
  const [textScale, setTextScale] = useState<number>(() => {
    const ls = Number(localStorage.getItem('textScale') || 100)
    return Number.isFinite(ls) ? ls : 100
  })
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('lang') || 'en-US')
  const [timezone, setTimezone] = useState<string>(() => localStorage.getItem('timezone') || 'UTC')

  useEffect(() => {
    http
      .get('/me/preferences')
      .then((r) => r.data as any)
      .then((prefs) => {
        const t = prefs?.theme
        if (t === 'light' || t === 'dark') setTheme(t)
        const s = Number(prefs?.textScale)
        if (Number.isFinite(s) && s >= 90 && s <= 120) setTextScale(Math.round(s))
      })
      .catch(() => {})
  }, [])

  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    if (t === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', t)
  }

  const applyTextScale = (n: number) => {
    const pct = Math.min(120, Math.max(90, Math.round(n)))
    document.documentElement.style.fontSize = `${pct}%`
    localStorage.setItem('textScale', String(pct))
  }

  const applyLocale = (lang: string, tz?: string) => {
    const root = document.documentElement
    root.lang = lang || 'en'
    const rtl = /^(ar|fa|ur|he)/i.test(lang)
    root.dir = rtl ? 'rtl' : 'ltr'
    if (tz) {
      localStorage.setItem('timezone', tz)
    } else {
      localStorage.removeItem('timezone')
    }
    localStorage.setItem('lang', lang)
    // Broadcast to other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hrw:prefs-updated'))
    }
  }

  const onSave = async () => {
    try {
      await http.put('/me/preferences', { theme, textScale, language, timezone })
      applyTheme(theme)
      applyTextScale(textScale)
      applyLocale(language, timezone)
      notify({ type: 'success', message: 'Preferences saved' })
    } catch {
      notify({ type: 'error', message: 'Failed to save preferences' })
    }
  }

  const previewStyle = useMemo(() => ({ fontSize: `${textScale}%` }), [textScale])

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
        <h3 className="font-semibold mb-3">{t('Appearance')}</h3>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">{t('Theme')}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                theme === 'light'
                  ? 'brand-gradient text-white border-transparent shadow'
                  : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`}
              aria-pressed={theme === 'light'}
            >
              <SunIcon className="h-5 w-5" />
              <span>{t('Light')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                theme === 'dark'
                  ? 'brand-gradient text-white border-transparent shadow'
                  : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`}
              aria-pressed={theme === 'dark'}
            >
              <MoonIcon className="h-5 w-5" />
              <span>{t('Dark')}</span>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium">{t('Text size')}</div>
            <div className="text-xs opacity-70">{textScale}%</div>
          </div>
          <div className="px-1 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
            <input
              type="range"
              min={90}
              max={120}
              step={2}
              value={textScale}
              onChange={(e) => { const v = Number(e.target.value); setTextScale(v); }}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] opacity-70 mt-1">
              <span>90%</span>
              <span>100%</span>
              <span>110%</span>
              <span>120%</span>
            </div>
          </div>
        </div>

        {/* Theme preview card */}
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden" style={previewStyle as any}>
          <div className="px-3 py-2 bg-gray-100 dark:bg-neutral-900 flex items-center justify-between">
            <div className="text-sm opacity-80">Topbar · {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || undefined }).format(new Date())}</div>
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="p-3 grid md:grid-cols-3 gap-3 bg-white dark:bg-neutral-800">
            <div className="rounded-md h-16 border border-gray-200 dark:border-neutral-700 flex items-center justify-center">Card</div>
            <div className="rounded-md h-16 border border-gray-200 dark:border-neutral-700 flex items-center justify-center">Card</div>
            <div className="rounded-md h-16 border border-gray-200 dark:border-neutral-700 flex items-center justify-center">Card</div>
          </div>
        </div>
      </div>

      {/* Localization (coming soon) */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
        <h3 className="font-semibold mb-3">Localization</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="lang">{t('Language')}</label>
            <select
              id="lang"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="ur-PK">اردو (پاکستان)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="tz">{t('Timezone')}</label>
            <select
              id="tz"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
            </select>
          </div>
        </div>
        <p className="text-xs opacity-70 mt-2">Saving language and timezone comes with HRW-SET-3.</p>
      </div>

      <button onClick={onSave} className="px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 transition">{t('Save')}</button>
    </div>
  )
}
