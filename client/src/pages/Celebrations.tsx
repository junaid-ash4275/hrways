import { useEffect, useMemo, useState } from 'react'
import { http } from '../api/http'
import { CalendarDaysIcon, SparklesIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

type Emp = { id: string; name: string; email: string; birth_date?: string; join_date?: string; day?: number; years?: number }

export default function Celebrations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [birthdays, setBirthdays] = useState<Emp[]>([])
  const [anniv, setAnniv] = useState<Emp[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true); setError('')
        const { data } = await http.get('/dashboard/celebrations')
        if (!alive) return
        setBirthdays(Array.isArray(data?.birthdays) ? data.birthdays : [])
        setAnniv(Array.isArray(data?.anniversaries) ? data.anniversaries : [])
      } catch (e: any) {
        if (!alive) return
        setError(e?.response?.data?.error?.message || 'Failed to load celebrations')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const monthLabel = useMemo(() => {
    try { return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) } catch { return '' }
  }, [])

  const totalBirthdays = birthdays.length
  const totalAnniv = anniv.length

  return (
    <section>
      <div className="max-w-7xl mx-auto">
        {/* Hero banner */}
        <div className="rounded-2xl overflow-hidden mb-5 border border-gray-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">This Month&apos;s Celebrations</h2>
            <p className="opacity-70 text-sm text-gray-700 dark:text-gray-300">{monthLabel}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            <SummaryCard
              title="Birthdays"
              value={totalBirthdays}
              icon={<CalendarDaysIcon className="h-5 w-5" />}
              tint="from-emerald-500/15 to-teal-500/15"
            />
            <SummaryCard
              title="Work Anniversaries"
              value={totalAnniv}
              icon={<SparklesIcon className="h-5 w-5" />}
              tint="from-cyan-500/15 to-indigo-500/15"
            />
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
        {loading ? (
          <div className="text-sm opacity-70">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ListCard
              title="Birthdays"
              subtitle="Teammates celebrating this month"
              empty="No birthdays this month."
              items={birthdays}
              rightLabel={(e) => formatMonthDay(e.birth_date)}
            />
            <ListCard
              title="Work Anniversaries"
              subtitle="Milestones this month"
              empty="No anniversaries this month."
              items={anniv}
              rightLabel={(e) => `${e.years ?? 0} yr • ${formatMonthDay(e.join_date)}`}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function SummaryCard({ title, value, icon, tint }: { title: string; value: number; icon: React.ReactNode; tint: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${tint} flex items-center justify-center brand-text`}>{icon}</div>
          <div className="text-sm opacity-70">{title}</div>
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </div>
  )
}

function ListCard({ title, subtitle, empty, items, rightLabel }: { title: string; subtitle: string; empty: string; items: Emp[]; rightLabel: (e: Emp) => string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-4 shadow-sm">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm opacity-70">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="text-sm opacity-70">{empty}</div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-neutral-800 max-h-[60vh] overflow-y-auto">
          {items.map((e) => (
            <li key={e.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center brand-text text-xs font-semibold">
                  {initials(e.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <a className="text-xs opacity-70 truncate inline-flex items-center gap-1 hover:opacity-100" href={`mailto:${e.email}`}>
                    <EnvelopeIcon className="h-3.5 w-3.5" />{e.email}
                  </a>
                </div>
              </div>
              <div className="shrink-0 text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-neutral-700 opacity-80">
                {rightLabel(e)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function initials(name?: string) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (a + b).toUpperCase()
}

function formatMonthDay(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return '' }
}

