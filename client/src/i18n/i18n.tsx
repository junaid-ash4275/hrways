import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Dict = Record<string, string>
type Dictionaries = Record<string, Dict>

const dicts: Dictionaries = {
  en: {
    'Dashboard': 'Dashboard',
    'Employees': 'Employees',
    'Attendance': 'Attendance',
    'Meetings': 'Meetings',
    'Payroll': 'Payroll',
    'Settings': 'Settings',
    'Admin': 'Admin',
    'Profile': 'Profile',
    'Change Password': 'Change Password',
    'Preferences': 'Preferences',
    'Save': 'Save',
    'Save changes': 'Save changes',
    'Profile updated successfully': 'Profile updated successfully',
    'Failed to update profile': 'Failed to update profile',
    'Password updated successfully': 'Password updated successfully',
    'Failed to update password': 'Failed to update password',
    'Reset via email': 'Reset via email',
    'Send reset code': 'Send reset code',
    'Language': 'Language',
    'Timezone': 'Timezone',
    'Appearance': 'Appearance',
    'Theme': 'Theme',
    'Light': 'Light',
    'Dark': 'Dark',
    'Text size': 'Text size',
    'Preferences saved': 'Preferences saved',
    'Welcome': 'Welcome',
    'User': 'User',
    'Full name': 'Full name',
    'Phone': 'Phone',
    'Title': 'Title',
    'Digits, spaces, +, -, and () allowed.': 'Digits, spaces, +, -, and () allowed.',
  },
  ur: {
    'Dashboard': 'ڈیش بورڈ',
    'Employees': 'ملازمین',
    'Attendance': 'حاضری',
    'Meetings': 'میٹنگز',
    'Payroll': 'تنخواہ',
    'Settings': 'ترتیبات',
    'Admin': 'ایڈمن',
    'Profile': 'پروفائل',
    'Change Password': 'پاس ورڈ تبدیل کریں',
    'Preferences': 'ترجیحات',
    'Save': 'محفوظ کریں',
    'Save changes': 'تبدیلیاں محفوظ کریں',
    'Profile updated successfully': 'پروفائل کامیابی سے اپ ڈیٹ ہو گیا',
    'Failed to update profile': 'پروفائل اپ ڈیٹ ناکام',
    'Password updated successfully': 'پاس ورڈ کامیابی سے اپ ڈیٹ ہو گیا',
    'Failed to update password': 'پاس ورڈ اپ ڈیٹ ناکام',
    'Reset via email': 'ای میل کے ذریعے ریسٹ',
    'Send reset code': 'ریسٹ کوڈ بھیجیں',
    'Language': 'زبان',
    'Timezone': 'ٹائم زون',
    'Appearance': 'ظاہری شکل',
    'Theme': 'تھیم',
    'Light': 'لائٹ',
    'Dark': 'ڈارک',
    'Text size': 'متن کا سائز',
    'Preferences saved': 'ترجیحات محفوظ ہو گئیں',
    'Welcome': 'خوش آمدید',
    'User': 'صارف',
    'Full name': 'پورا نام',
    'Phone': 'فون',
    'Title': 'عہدہ',
    'Digits, spaces, +, -, and () allowed.': 'ہندسے، اسپیس، +، - اور () کی اجازت ہے۔',
  }
}

function normalize(lang: string): string {
  const base = (lang || 'en').toLowerCase()
  if (base.startsWith('ur')) return 'ur'
  if (base.startsWith('en')) return 'en'
  return 'en'
}

type I18nState = {
  lang: string
  t: (key: string, fallback?: string) => string
}

const Ctx = createContext<I18nState | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<string>(() => localStorage.getItem('lang') || document.documentElement.lang || 'en-US')

  useEffect(() => {
    const onPrefs = () => setLang(localStorage.getItem('lang') || document.documentElement.lang || 'en-US')
    window.addEventListener('hrw:prefs-updated', onPrefs as any)
    window.addEventListener('storage', onPrefs as any)
    return () => {
      window.removeEventListener('hrw:prefs-updated', onPrefs as any)
      window.removeEventListener('storage', onPrefs as any)
    }
  }, [])

  const t = useMemo(() => {
    const code = normalize(lang)
    const d = dicts[code] || dicts.en
    return (key: string, fallback?: string) => d[key] || fallback || key
  }, [lang])

  const value = useMemo(() => ({ lang, t }), [lang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

