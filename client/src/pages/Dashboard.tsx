import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/http'
import {
  UsersIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'

type Kpis = {
  employeesTotal: number
  onLeaveToday: number
  birthdaysThisMonth: number
  meetingsThisWeek: number
}

type ActivityItem = {
  at: string
  kind: 'EMPLOYEE' | 'LEAVE' | 'MEETING' | 'DOCUMENT' | string
  ref: string
  title?: string | null
  link: string
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityError, setActivityError] = useState('')
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const { data } = await http.get('/dashboard/kpis')
        if (alive) setKpis(data)
      } catch (e: any) {
        if (alive) setError(e?.response?.data?.error?.message || 'Failed to load KPIs')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setActivityLoading(true)
        const { data } = await http.get('/dashboard/activity', { params: { limit: 10 } })
        if (alive) setActivity(data?.data || [])
      } catch (e: any) {
        if (alive) setActivityError(e?.response?.data?.error?.message || 'Failed to load activity')
      } finally { if (alive) setActivityLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const grouped = useMemo(() => groupByDay(activity), [activity])
  // Calendar state
  const [view, setView] = useState<'day'|'week'|'month'>('day')
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [meetings, setMeetings] = useState<Array<{ id: string; title: string; start_at: string; end_at: string; status: string }>>([])
  const [mtgLoading, setMtgLoading] = useState(false)
  const [mtgError, setMtgError] = useState('')

  useEffect(() => {
    const { from, to } = rangeFor(view, cursor)
    let alive = true
    ;(async () => {
      try {
        setMtgLoading(true)
        const { data } = await http.get('/meetings', { params: { from: from.toISOString(), to: to.toISOString(), status: 'NOT_CANCELLED' } })
        if (alive) setMeetings(Array.isArray(data?.data) ? data.data : [])
      } catch (e: any) {
        if (alive) setMtgError(e?.response?.data?.error?.message || 'Failed to load meetings')
      } finally { if (alive) setMtgLoading(false) }
    })()
    return () => { alive = false }
  }, [view, cursor])

  return (
    <section>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
        <p className="opacity-80 mb-4">Key stats and recent activity.</p>
        {error && (
          <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="list">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KpiCard
                title="Employees"
                value={kpis?.employeesTotal ?? 0}
                icon={<UsersIcon className="h-4 w-4" />}
                tint="from-emerald-500/20 to-teal-500/20"
                to="/celebrations"
              />
              <KpiCard
                title="On Leave Today"
                value={kpis?.onLeaveToday ?? 0}
                icon={<CalendarDaysIcon className="h-4 w-4" />}
                tint="from-cyan-500/20 to-sky-500/20"
                to="/attendance"
              />
              <KpiCard
                title="Birthdays/Anniversaries"
                value={kpis?.birthdaysThisMonth ?? 0}
                icon={<CalendarDaysIcon className="h-4 w-4" />}
                tint="from-amber-500/20 to-orange-500/20"
                to="/celebrations"
              />
              <KpiCard
                title="Meetings This Week"
                value={kpis?.meetingsThisWeek ?? 0}
                icon={<CalendarIcon className="h-4 w-4" />}
                tint="from-indigo-500/20 to-violet-500/20"
                to="/meetings"
              />
            </>
          )}
        </div>

        {/* Calendar */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Meetings</h3>
            <Link to="/meetings" className="text-sm underline opacity-80 hover:opacity-100">Open Meetings</Link>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setCursor(new Date())} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 text-sm">Today</button>
              <button onClick={() => setCursor(addDays(cursor, view==='day'? -1 : view==='week' ? -7 : -30))} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 text-sm">Prev</button>
            <div className="text-sm opacity-80">
              {view === 'month' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                  : view === 'week' ? `${formatDate(rangeFor(view, cursor).from)} - ${formatDate(addDays(rangeFor(view, cursor).to, -1))}`
                  : formatDate(cursor)}
            </div>
              <button onClick={() => setCursor(addDays(cursor, view==='day'? 1 : view==='week' ? 7 : 30))} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 text-sm">Next</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('day')} className={`px-2 py-1 rounded border text-sm ${view==='day'?'brand-gradient text-white border-transparent':'border-gray-300 dark:border-neutral-700'}`}>Day</button>
              <button onClick={() => setView('week')} className={`px-2 py-1 rounded border text-sm ${view==='week'?'brand-gradient text-white border-transparent':'border-gray-300 dark:border-neutral-700'}`}>Week</button>
              <button onClick={() => setView('month')} className={`px-2 py-1 rounded border text-sm ${view==='month'?'brand-gradient text-white border-transparent':'border-gray-300 dark:border-neutral-700'}`}>Month</button>
            </div>
          </div>
          {mtgError && <div className="mb-2 text-sm text-red-600 dark:text-red-400">{mtgError}</div>}
          <div className="min-h-[220px]">
            {renderCalendar(view, cursor, meetings, mtgLoading)}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Link to="/celebrations" className="text-sm underline opacity-80 hover:opacity-100">View all</Link>
          </div>
          {activityError && (
            <div className="mb-2 text-sm text-red-600 dark:text-red-400">{activityError}</div>
          )}
          {activityLoading ? (
            <ActivitySkeleton />
          ) : grouped.length === 0 ? (
            <div className="text-sm opacity-70">No recent activity.</div>
          ) : (
            <div className="relative">
              {grouped.map(({ label, items }) => (
                <div key={label} className="mb-6">
                  <div className="sticky top-0 bg-transparent text-sm font-medium opacity-80 mb-2">{label}</div>
                  <ul className="space-y-2" role="list">
                    {items.map((a) => (
                      <li key={`${a.kind}:${a.ref}:${a.at}`} role="listitem" className="relative">
                        <Link to={a.link} className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 px-4 py-3 shadow-sm hover:shadow transition focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <TimelineDot kind={a.kind} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm">
                              <span className="align-middle mr-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 dark:border-neutral-700 opacity-80">
                                {iconFor(a.kind)}
                                <span>{a.kind}</span>
                              </span>
                              <span className="font-medium align-middle truncate">{a.title || labelFor(a.kind)}</span>
                            </div>
                            <div className="text-xs opacity-70 truncate">{relativeTime(a.at)} • {new Date(a.at).toLocaleString()}</div>
                          </div>
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition text-xs">Open →</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function KpiCard({ title, value, icon, tint, to, delta }: { title: string; value: number; icon: React.ReactNode; tint: string; to?: string; delta?: { value: number; period?: string } }) {
  const content = (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-800 shadow-sm hover:shadow transition">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${tint} flex items-center justify-center text-emerald-700 dark:text-emerald-300`}>{icon}</div>
          <div className="text-xs uppercase tracking-wide opacity-70">{title}</div>
        </div>
        {delta && (
          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${delta.value >= 0 ? 'text-emerald-700 dark:text-emerald-300 border-emerald-300/40' : 'text-red-600 dark:text-red-400 border-red-300/40'}`}>
            {delta.value >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
            <span>{formatNumber(Math.abs(delta.value))}%</span>
            {delta.period && <span className="opacity-70">{delta.period}</span>}
          </div>
        )}
      </div>
      <div className="text-3xl font-semibold tracking-tight mt-2">{formatNumber(value)}</div>
    </div>
  )
  return to ? (
    <Link to={to} role="listitem" className="focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl">{content}</Link>
  ) : (
    <div role="listitem">{content}</div>
  )
}

function labelFor(kind: string): string {
  switch (kind) {
    case 'EMPLOYEE': return 'Employee created'
    case 'LEAVE': return 'Leave request'
    case 'MEETING': return 'Meeting scheduled'
    case 'DOCUMENT': return 'Document uploaded'
    default: return kind
  }
}

function iconFor(kind: string) {
  const cls = 'h-4 w-4 opacity-80'
  switch (kind) {
    case 'EMPLOYEE': return <UsersIcon className={cls} />
    case 'LEAVE': return <ClipboardDocumentListIcon className={cls} />
    case 'MEETING': return <CalendarIcon className={cls} />
    case 'DOCUMENT': return <PaperClipIcon className={cls} />
    default: return <PaperClipIcon className={cls} />
  }
}

function formatNumber(n: number) {
  try {
    const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en-US'
    return new Intl.NumberFormat(lang).format(n)
  } catch { return String(n) }
}

function relativeTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  let rtf: any = null
  try {
    const RTF = (Intl as any).RelativeTimeFormat
    if (typeof RTF === 'function') {
      const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en-US'
      rtf = new RTF(lang, { numeric: 'auto' })
    }
  } catch {}
  const minute = 60 * 1000, hour = 60 * minute, day = 24 * hour
  if (abs < hour) {
    const v = Math.round(diff / minute)
    return rtf ? rtf.format(v, 'minute') : `${v} min ago`
  }
  if (abs < day) {
    const v = Math.round(diff / hour)
    return rtf ? rtf.format(v, 'hour') : `${v} hr ago`
  }
  const v = Math.round(diff / day)
  return rtf ? rtf.format(v, 'day') : `${v} d ago`
}

function groupByDay(items: ActivityItem[]) {
  const out: Array<{ label: string; items: ActivityItem[] }> = []
  const by: Record<string, ActivityItem[]> = {}
  for (const it of items) {
    const d = new Date(it.at)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    ;(by[key] ||= []).push(it)
  }
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today.getTime() - 24*3600*1000)
  const keys = Object.keys(by).sort().reverse()
  for (const k of keys) {
    const [y,m,d] = k.split('-').map(Number)
    const dt = new Date(y, m-1, d)
    let label = dt.getTime() === today.getTime() ? 'Today' : (dt.getTime() === yesterday.getTime() ? 'Yesterday' : dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))
    out.push({ label, items: by[k].sort((a,b) => (a.at < b.at ? 1 : -1)) })
  }
  return out
}

function TimelineDot({ kind }: { kind: string }) {
  const color = kind === 'EMPLOYEE' ? 'bg-emerald-500' : kind === 'LEAVE' ? 'bg-amber-500' : kind === 'MEETING' ? 'bg-indigo-500' : 'bg-cyan-500'
  return <span className={`mt-1 h-2.5 w-2.5 rounded-full ${color} shadow`} aria-hidden="true" />
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-800 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-neutral-700" />
        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-700" />
      </div>
      <div className="h-7 w-20 rounded bg-gray-200 dark:bg-neutral-700 mt-3" />
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 animate-pulse" />
      ))}
    </div>
  )
}

// Calendar helpers and renderer
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay() // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day) // Monday start
  return addDays(x, diff)
}
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }
function endOfMonth(d: Date) { const x = startOfDay(d); x.setMonth(x.getMonth()+1, 1); return x }
function formatDate(d: Date) { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }

function rangeFor(view: 'day'|'week'|'month', cursor: Date) {
  if (view === 'day') { const from = startOfDay(cursor); return { from, to: addDays(from, 1) } }
  if (view === 'week') { const from = startOfWeek(cursor); return { from, to: addDays(from, 7) } }
  const from = startOfMonth(cursor); const to = endOfMonth(cursor); return { from, to }
}

function renderCalendar(view: 'day'|'week'|'month', cursor: Date, meetings: Array<{ id: string; title: string; start_at: string; end_at: string; status: string }>, loading: boolean) {
  if (loading) {
    return <div className="h-40 rounded bg-gray-100 dark:bg-neutral-900 animate-pulse" />
  }
  if (view === 'day') return <DayView date={cursor} meetings={meetings} />
  if (view === 'week') return <WeekView date={cursor} meetings={meetings} />
  return <MonthView date={cursor} meetings={meetings} />
}

function DayView({ date, meetings }: { date: Date; meetings: any[] }) {
  const dayKey = startOfDay(date).toDateString()
  const items = meetings.filter(e => new Date(e.start_at).toDateString() === dayKey)
  const hours = Array.from({ length: 11 }, (_, i) => 8 + i) // 08:00 - 18:00
  const byHour: Record<number, any[]> = {}
  for (const m of items) {
    const h = new Date(m.start_at).getHours()
    ;(byHour[h] ||= []).push(m)
  }
  return (
    <div className="grid grid-cols-12 gap-2">
      {hours.map((h) => (
        <div key={h} className="col-span-12 grid grid-cols-12 items-start">
          <div className="col-span-2 sm:col-span-1 text-xs opacity-70 pr-2 text-right sm:text-left">
            {String(h).padStart(2,'0')}:00
          </div>
          <div className="col-span-10 sm:col-span-11">
            {byHour[h]?.length ? (
              <ul className="space-y-1">
                {byHour[h].map((m) => (
                  <li key={m.id} className="rounded border border-gray-200 dark:border-neutral-800 px-3 py-1.5 flex items-center justify-between bg-white/60 dark:bg-neutral-900/40">
                    <div className="min-w-0">
                      <div className="font-medium truncate text-sm">{m.title}</div>
                      <div className="text-xs opacity-70">{formatTime(m.start_at)} - {formatTime(m.end_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-6" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function WeekView({ date, meetings }: { date: Date; meetings: any[] }) {
  const from = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 min-h-[220px]">
      {days.map((d) => {
        const key = d.toDateString()
        const items = meetings.filter(e => new Date(e.start_at).toDateString() === key)
        return (
          <div key={key} className="rounded border border-gray-200 dark:border-neutral-800 p-2">
            <div className="text-sm font-medium mb-1">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            {items.length === 0 ? (
              <div className="text-xs opacity-60">—</div>
            ) : (
              <ul className="space-y-1">
                {items.map((m) => (
                  <li key={m.id} className="text-xs truncate">
                    <span className="opacity-70 mr-1">{formatTime(m.start_at)}</span>
                    <span className="font-medium">{m.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ date, meetings }: { date: Date; meetings: any[] }) {
  const from = startOfMonth(date)
  const start = startOfWeek(from)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const thisMonth = from.getMonth()
  return (
    <div className="grid grid-cols-7 gap-2 min-h-[220px]">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
        <div key={d} className="text-xs font-medium opacity-70 px-1">{d}</div>
      ))}
      {cells.map((d) => {
        const key = d.toDateString()
        const items = meetings.filter(e => new Date(e.start_at).toDateString() === key)
        const dim = d.getMonth() !== thisMonth
        return (
          <div key={key} className={`rounded border border-gray-200 dark:border-neutral-800 p-2 min-h-[84px] ${dim ? 'opacity-60' : ''}`}>
            <div className="text-xs font-medium mb-1">{d.getDate()}</div>
            <ul className="space-y-1">
              {items.slice(0,3).map((m:any) => (
                <li key={m.id} className="text-xs truncate">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 mr-1 align-middle" />
                  <span className="align-middle">{m.title}</span>
                </li>
              ))}
              {items.length > 3 && (
                <li className="text-xs opacity-70">+{items.length - 3} more</li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

