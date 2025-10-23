import { useEffect, useMemo, useState } from 'react'
import { http } from '../api/http'
import { useUI } from '../ui/UIContext'

type Meeting = { id: string; title: string; start_at: string; end_at: string; status: string }

export default function Meetings() {
  const { notify } = useUI()
  const [mode, setMode] = useState<'calendar' | 'list'>('calendar')
  const [view, setView] = useState<'day' | 'week' | 'month'>('month')
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Modal state
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  // Attendees tabs and state
  const [tab, setTab] = useState<'internal' | 'external'>('internal')
  // Internal: employee search and selection
  const [empQuery, setEmpQuery] = useState('')
  const [empResults, setEmpResults] = useState<any[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([])
  // External contact
  const [extName, setExtName] = useState('')
  const [extEmail, setExtEmail] = useState('')
  const [extPhone, setExtPhone] = useState('')
  const [creating, setCreating] = useState(false)
  // Day details modal
  const [dayOpen, setDayOpen] = useState(false)
  const [dayDate, setDayDate] = useState<Date | null>(null)
  const [dayItems, setDayItems] = useState<Meeting[]>([])
  const [cancellingId, setCancellingId] = useState<string>('')
  // Detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState<any | null>(null)
  const [drawerCancelling, setDrawerCancelling] = useState(false)
  // List (HRW-MEET-3)
  const todayLocal = (() => { const d = new Date(); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}` })()
  const plus30Local = (() => { const d = new Date(); d.setDate(d.getDate() + 30); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}` })()
  const [lFrom, setLFrom] = useState<string>(todayLocal)
  const [lTo, setLTo] = useState<string>(plus30Local)
  const [lAttType, setLAttType] = useState<'employee' | 'external'>('employee')
  const [lEmpQuery, setLEmpQuery] = useState('')
  const [lEmpResults, setLEmpResults] = useState<any[]>([])
  const [lEmpLoading, setLEmpLoading] = useState(false)
  const [lEmpId, setLEmpId] = useState<string>('')
  const [lExtEmail, setLExtEmail] = useState<string>('')
  const [lStatus, setLStatus] = useState<string>('')
  const [lSort, setLSort] = useState<'start_at' | 'title' | 'created_at'>('start_at')
  const [lDir, setLDir] = useState<'asc' | 'desc'>('asc')
  const [lPage, setLPage] = useState<number>(1)
  const [lPageSize, setLPageSize] = useState<number>(10)
  const [lTotal, setLTotal] = useState<number>(0)
  const [lRows, setLRows] = useState<any[]>([])
  const [lLoading, setLLoading] = useState<boolean>(false)
  const [lError, setLError] = useState<string>('')
  // Edit (HRW-MEET-2)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editStartLocal, setEditStartLocal] = useState('')
  const [editEndLocal, setEditEndLocal] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [replaceAtt, setReplaceAtt] = useState(false)
  const [eTab, setETab] = useState<'internal' | 'external'>('internal')
  const [eEmpQuery, setEEmpQuery] = useState('')
  const [eEmpResults, setEEmpResults] = useState<any[]>([])
  const [eEmpLoading, setEEmpLoading] = useState(false)
  const [eSelectedEmployees, setESelectedEmployees] = useState<any[]>([])
  const [eExtName, setEExtName] = useState('')
  const [eExtEmail, setEExtEmail] = useState('')
  const [eExtPhone, setEExtPhone] = useState('')

  const { from, to } = useMemo(() => rangeFor(view, cursor), [view, cursor])

  useEffect(() => {
    let alive = true
      ; (async () => {
      try {
        setLoading(true)
        setError('')
        const { data } = await http.get('/meetings', { params: { from: from.toISOString(), to: to.toISOString(), status: 'NOT_CANCELLED' } })
        if (!alive) return
        const items = Array.isArray(data?.data) ? data.data : []
        setMeetings(items)
      } catch (e: any) {
        if (!alive) return
        setError(e?.response?.data?.error?.message || 'Failed to load meetings')
      } finally { if (alive) setLoading(false) }
      })()
    return () => { alive = false }
  }, [from.getTime(), to.getTime()])

  // Employee search debounce
  useEffect(() => {
    if (tab !== 'internal') return
    const q = empQuery.trim()
    if (!q) { setEmpResults([]); return }
    let alive = true
    const t = window.setTimeout(async () => {
      try {
        setEmpLoading(true)
        const { data } = await http.get('/employees', { params: { q, page: 1, pageSize: 8 } })
        if (!alive) return
        setEmpResults(Array.isArray(data?.data) ? data.data : [])
      } catch {
        if (!alive) return
        setEmpResults([])
      } finally {
        if (alive) setEmpLoading(false)
      }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [empQuery, tab])

  // Employee search for list filters
  useEffect(() => {
    if (mode !== 'list' || lAttType !== 'employee') return
    const q = lEmpQuery.trim()
    if (!q) { setLEmpResults([]); return }
    let alive = true
    const t = window.setTimeout(async () => {
      try {
        setLEmpLoading(true)
        const { data } = await http.get('/employees', { params: { q, page: 1, pageSize: 8 } })
        if (!alive) return
        setLEmpResults(Array.isArray(data?.data) ? data.data : [])
      } catch { if (alive) setLEmpResults([]) }
      finally { if (alive) setLEmpLoading(false) }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [mode, lAttType, lEmpQuery])

  // Fetch list view
  useEffect(() => {
    if (mode !== 'list') return
    let alive = true
      ; (async () => {
        try {
          setLLoading(true); setLError('')
          const params: any = {}
          // Dates
          if (lFrom) {
            const fromIso = localToIso(`${lFrom}T00:00`)
            if (fromIso) params.from = fromIso
          }
          if (lTo) {
            // Exclusive upper bound: next day 00:00
            const dt = new Date(`${lTo}T00:00`)
            if (!isNaN(dt.getTime())) { dt.setDate(dt.getDate() + 1); params.to = dt.toISOString() }
          }
          // Attendee
          if (lAttType === 'employee' && lEmpId) params.attendee = lEmpId
          if (lAttType === 'external' && lExtEmail.trim()) params.attendee = lExtEmail.trim()
          // Status
          if (lStatus) params.status = lStatus
          // Paging & sort
          params.page = lPage
          params.pageSize = lPageSize
          params.sort = lSort
          params.dir = lDir
          const { data } = await http.get('/meetings', { params })
          if (!alive) return
          setLRows(data?.data || [])
          setLTotal(data?.total || 0)
        } catch (e: any) {
          if (!alive) return
          setLError(e?.response?.data?.error?.message || 'Failed to load meetings')
        } finally { if (alive) setLLoading(false) }
      })()
    return () => { alive = false }
  }, [mode, lFrom, lTo, lAttType, lEmpId, lExtEmail, lStatus, lPage, lPageSize, lSort, lDir])

  // Employee search for edit drawer
  useEffect(() => {
    if (!editing || eTab !== 'internal') return
    const q = eEmpQuery.trim()
    if (!q) { setEEmpResults([]); return }
    let alive = true
    const t = window.setTimeout(async () => {
      try {
        setEEmpLoading(true)
        const { data } = await http.get('/employees', { params: { q, page: 1, pageSize: 8 } })
        if (!alive) return
        setEEmpResults(Array.isArray(data?.data) ? data.data : [])
      } catch {
        if (!alive) return
        setEEmpResults([])
      } finally {
        if (alive) setEEmpLoading(false)
      }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [editing, eTab, eEmpQuery])

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault()
    try {
      setCreating(true)
      const startIso = localToIso(startLocal)
      const endIso = localToIso(endLocal)
      const payload: any = { title, start_at: startIso, end_at: endIso }
      if (tab === 'internal') {
        const eids = selectedEmployees.map(e => e.id)
        if (eids.length === 0) {
          notify({ type: 'error', message: 'Select at least one employee' })
          setCreating(false)
          return
        }
        payload.employee_ids = eids
      } else {
        const contact: any = { name: extName.trim() }
        if (!contact.name) {
          notify({ type: 'error', message: 'External contact name is required' })
          setCreating(false)
          return
        }
        if (extEmail.trim()) contact.email = extEmail.trim()
        if (extPhone.trim()) contact.phone = extPhone.trim()
        payload.external_contacts = [contact]
      }
      await http.post('/meetings', payload)
      notify({ type: 'success', message: 'Meeting created' })
      setOpen(false)
      // reset form
      setTitle(''); setStartLocal(''); setEndLocal('');
      setTab('internal'); setEmpQuery(''); setEmpResults([]); setSelectedEmployees([]);
      setExtName(''); setExtEmail(''); setExtPhone('')
      // reload list
      const { data } = await http.get('/meetings', { params: { from: from.toISOString(), to: to.toISOString(), status: 'NOT_CANCELLED' } })
      setMeetings(data?.data || [])
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to create meeting'
      const details = e?.response?.data?.error?.details
      notify({ type: 'error', message: Array.isArray(details) ? `${msg}: ${details[0]}` : msg })
    } finally {
      setCreating(false)
    }
  }

  return (
    <section>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-semibold">Meetings</h2>
            <p className="opacity-80">Upcoming schedule and quick create.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
              {(['calendar', 'list'] as const).map((m) => (
                <button key={m}
                  className={`px-3 py-1.5 text-sm font-medium min-w-[100px] text-center ${mode === m ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                  onClick={() => setMode(m)}>{m}</button>
              ))}
            </div>
            {mode === 'calendar' && (
              <>
                <div className="inline-flex rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  {(['day', 'week', 'month'] as const).map((v) => (
                    <button key={v}
                      className={`px-2.5 py-1 text-sm ${view === v ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                      onClick={() => setView(v)}>{v}</button>
                  ))}
                </div>
                <div className="inline-flex rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <button className="px-2.5 py-1 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => setCursor(addDays(cursor, view === 'day' ? -1 : view === 'week' ? -7 : -30))}>Prev</button>
                  <button className="px-2.5 py-1 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => setCursor(new Date())}>Today</button>
                  <button className="px-2.5 py-1 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => setCursor(addDays(cursor, view === 'day' ? 1 : view === 'week' ? 7 : 30))}>Next</button>
                </div>
              </>
            )}
            <button className="px-3 py-1.5 text-sm rounded-md brand-gradient text-white shadow hover:opacity-95" onClick={() => setOpen(true)}>New Meeting</button>
          </div>
        </div>
        {mode === 'calendar' && error && (
          <div className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        {mode === 'calendar' ? (
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm opacity-80">{formatDate(from)} to {formatDate(addDays(to, -1))}</div>
              {loading && <div className="text-xs opacity-60">Loading...</div>}
            </div>
            {renderCalendar(view, cursor, meetings, loading, (d) => {
              const key = d.toDateString()
              const items = meetings.filter(m => new Date(m.start_at).toDateString() === key)
              setDayItems(items)
              setDayDate(d)
              setDayOpen(true)
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-800">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-sm mb-1">From</label>
                <input type="date" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={lFrom} onChange={(e) => { setLFrom(e.target.value); setLPage(1) }} />
              </div>
              <div>
                <label className="block text-sm mb-1">To</label>
                <input type="date" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={lTo} onChange={(e) => { setLTo(e.target.value); setLPage(1) }} />
              </div>
              <div>
                <label className="block text-sm mb-1">Attendee Type</label>
                <select className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={lAttType} onChange={(e) => { setLAttType(e.target.value as any); setLPage(1); setLEmpId(''); setLExtEmail(''); setLEmpQuery(''); setLEmpResults([]) }}>
                  <option value="employee">Employee</option>
                  <option value="external">External (name)</option>
                </select>
              </div>
              <div>
                {lAttType === 'employee' ? (
                  <div>
                    <label className="block text-sm mb-1">Search employee</label>
                    <input className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" placeholder="Type name/email/code" value={lEmpQuery} onChange={(e) => { const v = e.target.value; setLEmpQuery(v); if (!v.trim()) setLEmpId(''); setLPage(1) }} />
                    {lEmpLoading ? <div className="text-xs opacity-70 mt-1">Searching...</div> : null}
                    {lEmpResults.length > 0 && (
                      <ul className="mt-1 max-h-40 overflow-auto divide-y divide-gray-200 dark:divide-neutral-800 rounded border border-gray-200 dark:border-neutral-800">
                        {lEmpResults.map((e) => (
                          <li key={e.id} className="px-3 py-1.5 text-sm flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate">{e.name} <span className="opacity-70">{e.email}</span></div>
                            <button type="button" className="text-xs px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => { setLEmpId(e.id); setLEmpQuery(e.name); setLEmpResults([]); setLPage(1) }}>Use</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm mb-1">External name</label>
                    <input className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" placeholder="Name" value={lExtEmail} onChange={(e) => { setLExtEmail(e.target.value); setLPage(1) }} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Status</label>
                <select className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={lStatus} onChange={(e) => { setLStatus(e.target.value); setLPage(1) }}>
                  <option value="">All</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
            {lError && <div className="mb-2 text-sm text-red-600 dark:text-red-400">{lError}</div>}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="py-2 pr-2">Title</th>
                    <th className="py-2 pr-2">Start</th>
                    <th className="py-2 pr-2">End</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lLoading ? (
                    <tr><td colSpan={5} className="py-6 text-center opacity-70">Loading...</td></tr>
                  ) : lRows.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center opacity-70">No meetings found.</td></tr>
                  ) : (
                    lRows.map((m: any) => (
                      <tr key={m.id} className="border-t border-gray-200 dark:border-neutral-800">
                        <td className="py-2 pr-2">
                          <button className="font-medium hover:underline" onClick={async () => { try { setDetailError(''); setDetailLoading(true); setDrawerOpen(true); setEditing(false); setReplaceAtt(false); const { data } = await http.get(`/meetings/${m.id}`); setDetail(data) } finally { setDetailLoading(false) } }}>{m.title}</button>
                        </td>
                        <td className="py-2 pr-2">{new Date(m.start_at).toLocaleString()}</td>
                        <td className="py-2 pr-2">{new Date(m.end_at).toLocaleString()}</td>
                        <td className="py-2 pr-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${m.status === 'CANCELLED' ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400' : 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'}`}>{m.status}</span></td>
                        <td className="py-2 pr-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={async () => { try { setDetailError(''); setDetailLoading(true); setDrawerOpen(true); const { data } = await http.get(`/meetings/${m.id}`); setDetail(data); setEditTitle(data.title || ''); setEditStartLocal(isoToLocal(data.start_at)); setEditEndLocal(isoToLocal(data.end_at)); setReplaceAtt(false); setESelectedEmployees(data.attendees?.employees || []); const ex = (data.attendees?.externals || [])[0] || {}; setEExtName(ex.name || ''); setEExtEmail(ex.email || ''); setEExtPhone(ex.phone || ''); setETab('internal'); setEditing(true) } finally { setDetailLoading(false) } }}>Edit</button>
                            <button className={`text-xs px-2 py-1 rounded border bg-transparent ${m.status === 'CANCELLED' ? 'opacity-60' : 'hover:bg-red-50 dark:hover:bg-red-900/20'} text-red-600 dark:text-red-400 border-red-300 dark:border-red-700`} disabled={m.status === 'CANCELLED'} onClick={async () => { try { await http.delete(`/meetings/${m.id}`); notify({ type: 'success', message: 'Meeting cancelled' }); setLRows((arr) => arr.map((x: any) => x.id === m.id ? { ...x, status: 'CANCELLED' } : x)) } catch (e: any) { notify({ type: 'error', message: e?.response?.data?.error?.message || 'Failed to cancel meeting' }) } }}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <div>Page {lPage} of {Math.max(1, Math.ceil(lTotal / lPageSize))} · {lTotal} total</div>
              <div className="flex items-center gap-2">
                <select className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-2 py-1" value={lPageSize} onChange={(e) => { setLPageSize(Number(e.target.value) || 10); setLPage(1) }}>
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
                </select>
                <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={lPage <= 1} onClick={() => setLPage((p) => Math.max(1, p - 1))}>Prev</button>
                <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={(lPage * lPageSize) >= lTotal} onClick={() => setLPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => !creating && setOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form onSubmit={createMeeting} className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-lg">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold">New Meeting</h3>
                <button type="button" className="text-sm px-2 py-1 rounded border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => !creating && setOpen(false)}>Close</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">Title</label>
                  <input type="text" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Start</label>
                    <input type="datetime-local" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">End</label>
                    <input type="datetime-local" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} required />
                  </div>
                </div>
                <fieldset className="border rounded border-gray-200 dark:border-neutral-800 p-3">
                  <legend className="px-1 text-sm opacity-80">Attendees</legend>
                  <div className="mb-3 inline-flex rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
                    {(['internal', 'external'] as const).map((t) => (
                      <button key={t} type="button"
                        className={`px-4 py-1.5 text-sm font-medium min-w-[120px] text-center ${tab === t ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                        onClick={() => setTab(t)}>{t}</button>
                    ))}
                  </div>
                  {tab === 'internal' ? (
                    <div>
                      <label className="block text-sm mb-1">Search employees</label>
                      <input
                        placeholder="Type a name, email, or code..."
                        className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2"
                        value={empQuery}
                        onChange={(e) => setEmpQuery(e.target.value)}
                      />
                      <div className="mt-2">
                        {selectedEmployees.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {selectedEmployees.map((e) => (
                              <span key={e.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                                {e.name || e.email}
                                <button type="button" className="ml-1 opacity-80 hover:opacity-100" onClick={() => setSelectedEmployees((arr) => arr.filter((x) => x.id !== e.id))}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {empLoading ? (
                          <div className="text-xs opacity-70">Searching...</div>
                        ) : empResults.length > 0 ? (
                          <ul className="max-h-48 overflow-auto divide-y divide-gray-200 dark:divide-neutral-800 rounded border border-gray-200 dark:border-neutral-800">
                            {empResults.map((e) => (
                              <li key={e.id} className="px-3 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{e.name}</div>
                                  <div className="text-xs opacity-70 truncate">{e.email} {e.employee_code ? `· ${e.employee_code}` : ''}</div>
                                </div>
                                <button type="button"
                                  className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                  onClick={() => {
                                    setSelectedEmployees((arr) => (arr.some(x => x.id === e.id) ? arr : [...arr, e]))
                                  }}
                                >Add</button>
                              </li>
                            ))}
                          </ul>
                        ) : empQuery.trim() ? (
                          <div className="text-xs opacity-70">No results</div>
                        ) : (
                          <div className="text-xs opacity-60">Type to search employees.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input placeholder="Name (required)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={extName} onChange={(e) => setExtName(e.target.value)} />
                      <input placeholder="Email (optional)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} />
                      <input placeholder="Phone (optional)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={extPhone} onChange={(e) => setExtPhone(e.target.value)} />
                    </div>
                  )}
                </fieldset>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => !creating && setOpen(false)}>Cancel</button>
                <button type="submit" disabled={creating} className="px-3 py-1.5 text-sm rounded-md brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dayOpen && dayDate && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDayOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-lg">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold">Meetings on {dayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                <button type="button" className="text-sm px-2 py-1 rounded border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => setDayOpen(false)}>Close</button>
              </div>
              {dayItems.length === 0 ? (
                <div className="text-sm opacity-70">No meetings.</div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {dayItems
                    .slice()
                    .sort((a, b) => (a.start_at < b.start_at ? -1 : 1))
                    .map((m) => (
                      <li
                        key={m.id}
                        className="py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 px-2 -mx-2 rounded"
                        onClick={async () => {
                          try {
                            setDetailError('')
                            setDetailLoading(true)
                            setEditing(false)
                            setReplaceAtt(false)
                            setDrawerOpen(true)
                            const { data } = await http.get(`/meetings/${m.id}`)
                            setDetail(data)
                          } catch (e: any) {
                            setDetailError(e?.response?.data?.error?.message || 'Failed to load meeting')
                          } finally {
                            setDetailLoading(false)
                          }
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs opacity-70">{formatTime(m.start_at)} - {formatTime(m.end_at)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                setDetailError('')
                                setDetailLoading(true)
                                setDrawerOpen(true)
                                const { data } = await http.get(`/meetings/${m.id}`)
                                setDetail(data)
                                // Prefill edit state
                                setEditTitle(data.title || '')
                                setEditStartLocal(isoToLocal(data.start_at))
                                setEditEndLocal(isoToLocal(data.end_at))
                                setReplaceAtt(false)
                                setESelectedEmployees(data.attendees?.employees || [])
                                const ex = (data.attendees?.externals || [])[0] || {}
                                setEExtName(ex.name || '')
                                setEExtEmail(ex.email || '')
                                setEExtPhone(ex.phone || '')
                                setETab('internal')
                                setEditing(true)
                              } catch (err: any) {
                                const msg = err?.response?.data?.error?.message || 'Failed to open editor'
                                notify({ type: 'error', message: msg })
                              } finally {
                                setDetailLoading(false)
                              }
                            }}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async (e) => {
                              try {
                                setCancellingId(m.id)
                                e.stopPropagation()
                                await http.delete(`/meetings/${m.id}`)
                                notify({ type: 'success', message: 'Meeting cancelled' })
                                // remove from local lists
                                setMeetings((arr) => arr.filter((x) => x.id !== m.id))
                                setDayItems((arr) => arr.filter((x) => x.id !== m.id))
                              } catch (e: any) {
                                const msg = e?.response?.data?.error?.message || 'Failed to cancel meeting'
                                notify({ type: 'error', message: msg })
                              } finally {
                                setCancellingId('')
                              }
                            }}
                            disabled={cancellingId === m.id}
                            className={`text-xs px-2 py-1 rounded border bg-transparent 
                              ${cancellingId === m.id ? 'opacity-60' : 'hover:bg-red-50 dark:hover:bg-red-900/20'} 
                              text-red-600 dark:text-red-400 border-red-300 dark:border-red-700`}
                          >
                            {cancellingId === m.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {dayOpen && drawerOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0" onClick={() => { setEditing(false); setReplaceAtt(false); setDrawerOpen(false) }} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl p-4 overflow-auto">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Meeting' : 'Meeting Details'}</h3>
              <div className="flex items-center gap-2">
                {!editing && detail && detail.status !== 'CANCELLED' && (
                  <button
                    className={`text-xs px-2 py-1 rounded border bg-transparent ${drawerCancelling ? 'opacity-60' : 'hover:bg-red-50 dark:hover:bg-red-900/20'} text-red-600 dark:text-red-400 border-red-300 dark:border-red-700`}
                    disabled={drawerCancelling}
                    onClick={async () => {
                      try {
                        setDrawerCancelling(true)
                        await http.delete(`/meetings/${detail.id}`)
                        notify({ type: 'success', message: 'Meeting cancelled' })
                        // update UI
                        setMeetings((arr) => arr.filter((x) => x.id !== detail.id))
                        setDayItems((arr) => arr.filter((x) => x.id !== detail.id))
                        setDetail((d: any) => d ? { ...d, status: 'CANCELLED' } : d)
                      } catch (e: any) {
                        const msg = e?.response?.data?.error?.message || 'Failed to cancel meeting'
                        notify({ type: 'error', message: msg })
                      } finally {
                        setDrawerCancelling(false)
                      }
                    }}
                  >
                    {drawerCancelling ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
                {!editing && detail && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      // Prefill edit fields
                      setEditTitle(detail.title || '')
                      setEditStartLocal(isoToLocal(detail.start_at))
                      setEditEndLocal(isoToLocal(detail.end_at))
                      setReplaceAtt(false)
                      // Prefill attendee edit states from detail
                      setESelectedEmployees(detail.attendees?.employees || [])
                      const ex = (detail.attendees?.externals || [])[0] || {}
                      setEExtName(ex.name || '')
                      setEExtEmail(ex.email || '')
                      setEExtPhone(ex.phone || '')
                      setETab('internal')
                      setEditing(true)
                    }}
                  >Edit</button>
                )}
                {editing && (
                  <>
                    <button
                      disabled={savingEdit}
                      className={`text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 ${savingEdit ? 'opacity-60' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'} text-emerald-700 dark:text-emerald-300`}
                      onClick={async () => {
                        try {
                          setSavingEdit(true)
                          const payload: any = {}
                          if (editTitle && editTitle !== detail.title) payload.title = editTitle
                          if (editStartLocal) payload.start_at = localToIso(editStartLocal)
                          if (editEndLocal) payload.end_at = localToIso(editEndLocal)
                          if (replaceAtt) {
                            if (eTab === 'internal') {
                              const ids = eSelectedEmployees.map((e) => e.id)
                              if (ids.length === 0) { notify({ type: 'error', message: 'Select at least one employee' }); setSavingEdit(false); return }
                              payload.employee_ids = ids
                            } else {
                              if (!eExtName.trim()) { notify({ type: 'error', message: 'External contact name is required' }); setSavingEdit(false); return }
                              const contact: any = { name: eExtName.trim() }
                              if (eExtEmail.trim()) contact.email = eExtEmail.trim()
                              if (eExtPhone.trim()) contact.phone = eExtPhone.trim()
                              payload.external_contacts = [contact]
                            }
                          }
                          await http.put(`/meetings/${detail.id}`, payload)
                          notify({ type: 'success', message: 'Meeting updated' })
                          setEditing(false)
                          // Refresh details and list
                          const det = await http.get(`/meetings/${detail.id}`)
                          setDetail(det.data)
                          const { data } = await http.get('/meetings', { params: { from: from.toISOString(), to: to.toISOString(), status: 'NOT_CANCELLED' } })
                          setMeetings(data?.data || [])
                        } catch (e: any) {
                          const msg = e?.response?.data?.error?.message || 'Failed to update meeting'
                          const details = e?.response?.data?.error?.details
                          notify({ type: 'error', message: Array.isArray(details) ? `${msg}: ${details[0]}` : msg })
                        } finally {
                          setSavingEdit(false)
                        }
                      }}
                    >{savingEdit ? 'Saving...' : 'Save'}</button>
                    <button
                      disabled={savingEdit}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => setEditing(false)}
                    >Cancel</button>
                  </>
                )}
                <button type="button" className="text-sm px-2 py-1 rounded border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => setDrawerOpen(false)}>Close</button>
              </div>
            </div>
            {detailLoading ? (
              <div className="text-sm opacity-70">Loading...</div>
            ) : detailError ? (
              <div className="text-sm text-red-600 dark:text-red-400">{detailError}</div>
            ) : detail ? (
              editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Title</label>
                    <input className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Start</label>
                      <input type="datetime-local" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={editStartLocal} onChange={(e) => setEditStartLocal(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">End</label>
                      <input type="datetime-local" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={editEndLocal} onChange={(e) => setEditEndLocal(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input id="repAtt" type="checkbox" className="h-4 w-4" checked={replaceAtt} onChange={(e) => setReplaceAtt(e.target.checked)} />
                    <label htmlFor="repAtt" className="text-sm">Replace attendees</label>
                  </div>
                  {replaceAtt && (
                    <fieldset className="border rounded border-gray-200 dark:border-neutral-800 p-3">
                      <legend className="px-1 text-sm opacity-80">Attendees</legend>
                      <div className="mb-3 inline-flex rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
                        {(['internal', 'external'] as const).map((t) => (
                          <button key={t} type="button"
                            className={`px-4 py-1.5 text-sm font-medium min-w-[120px] text-center ${eTab === t ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                            onClick={() => setETab(t)}>{t}</button>
                        ))}
                      </div>
                      {eTab === 'internal' ? (
                        <div>
                          <label className="block text-sm mb-1">Search employees</label>
                          <input
                            placeholder="Type a name, email, or code..."
                            className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2"
                            value={eEmpQuery}
                            onChange={(e) => setEEmpQuery(e.target.value)}
                          />
                          <div className="mt-2">
                            {eSelectedEmployees.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {eSelectedEmployees.map((e) => (
                                  <span key={e.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                                    {e.name || e.email}
                                    <button type="button" className="ml-1 opacity-80 hover:opacity-100" onClick={() => setESelectedEmployees((arr) => arr.filter((x) => x.id !== e.id))}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {eEmpLoading ? (
                              <div className="text-xs opacity-70">Searching...</div>
                            ) : eEmpResults.length > 0 ? (
                              <ul className="max-h-48 overflow-auto divide-y divide-gray-200 dark:divide-neutral-800 rounded border border-gray-200 dark:border-neutral-800">
                                {eEmpResults.map((e) => (
                                  <li key={e.id} className="px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium truncate">{e.name}</div>
                                      <div className="text-xs opacity-70 truncate">{e.email} {e.employee_code ? `- ${e.employee_code}` : ''}</div>
                                    </div>
                                    <button type="button"
                                      className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                      onClick={() => {
                                        setESelectedEmployees((arr) => (arr.some(x => x.id === e.id) ? arr : [...arr, e]))
                                      }}
                                    >Add</button>
                                  </li>
                                ))}
                              </ul>
                            ) : eEmpQuery.trim() ? (
                              <div className="text-xs opacity-70">No results</div>
                            ) : (
                              <div className="text-xs opacity-60">Type to search employees.</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input placeholder="Name (required)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={eExtName} onChange={(e) => setEExtName(e.target.value)} />
                          <input placeholder="Email (optional)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={eExtEmail} onChange={(e) => setEExtEmail(e.target.value)} />
                          <input placeholder="Phone (optional)" className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" value={eExtPhone} onChange={(e) => setEExtPhone(e.target.value)} />
                        </div>
                      )}
                    </fieldset>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm opacity-70">Title</div>
                    <div className="font-medium">{detail.title}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm opacity-70">Start</div>
                      <div className="font-medium">{new Date(detail.start_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm opacity-70">End</div>
                      <div className="font-medium">{new Date(detail.end_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70">Status</div>
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${detail.status === 'CANCELLED' ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400' : 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'}`}>{detail.status}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">Attendees</div>
                    <div className="space-y-2">
                      {detail.attendees?.users?.length ? (
                        <div>
                          <div className="text-sm opacity-70">Internal Users</div>
                          <ul className="text-sm list-disc pl-5">
                            {detail.attendees.users.map((u: any) => (
                              <li key={`u-${u.id}`}>{u.fullName ? `${u.fullName} ` : ''}<span className="opacity-80">{u.email}</span></li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {detail.attendees?.employees?.length ? (
                        <div>
                          <div className="text-sm opacity-70">Employees</div>
                          <ul className="text-sm list-disc pl-5">
                            {detail.attendees.employees.map((e: any) => (
                              <li key={`e-${e.id}`}>{e.name} <span className="opacity-80">{e.email}</span></li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {detail.attendees?.externals?.length ? (
                        <div>
                          <div className="text-sm opacity-70">External Contacts</div>
                          <ul className="text-sm list-disc pl-5">
                            {detail.attendees.externals.map((x: any, idx: number) => (
                              <li key={`x-${idx}`}>{x.name ? `${x.name} ` : ''}<span className="opacity-80">{x.email}</span>{x.phone ? ` · ${x.phone}` : ''}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {!detail.attendees || (!detail.attendees.users?.length && !detail.attendees.employees?.length && !detail.attendees.externals?.length) ? (
                        <div className="text-sm opacity-70">No attendees.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

// Calendar helpers (duplicated from Dashboard for now)
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay() // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day) // Monday start
  return addDays(x, diff)
}
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }
function endOfMonth(d: Date) { const x = startOfDay(d); x.setMonth(x.getMonth() + 1, 1); return x }
function formatDate(d: Date) { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
function formatTime(iso: string) { const d = new Date(iso); return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
function localToIso(local: string) {
  // local like "YYYY-MM-DDTHH:mm"; interpret in local tz then toISOString
  if (!local) return ''
  const d = new Date(local)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}
function isoToLocal(iso: string) {
  try {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  } catch { return '' }
}
function rangeFor(view: 'day' | 'week' | 'month', cursor: Date) {
  if (view === 'day') { const from = startOfDay(cursor); return { from, to: addDays(from, 1) } }
  if (view === 'week') { const from = startOfWeek(cursor); return { from, to: addDays(from, 7) } }
  const from = startOfMonth(cursor); const to = endOfMonth(cursor); return { from, to }
}

function renderCalendar(view: 'day' | 'week' | 'month', cursor: Date, meetings: Meeting[], loading: boolean, onDayClick?: (d: Date) => void) {
  if (loading) return <div className="h-40 rounded bg-gray-100 dark:bg-neutral-900 animate-pulse" />
  if (view === 'day') return <DayView date={cursor} meetings={meetings} />
  if (view === 'week') return <WeekView date={cursor} meetings={meetings} />
  return <MonthView date={cursor} meetings={meetings} onDayClick={onDayClick} />
}

function DayView({ date, meetings }: { date: Date; meetings: Meeting[] }) {
  const key = date.toDateString()
  const items = meetings.filter(m => new Date(m.start_at).toDateString() === key)
  return (
    <div>
      <div className="text-sm font-medium mb-2">{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      {items.length === 0 ? (
        <div className="text-sm opacity-70">No meetings today.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              <div className="min-w-0">
                <div className="font-medium truncate">{m.title}</div>
                <div className="text-xs opacity-70">{formatTime(m.start_at)} - {formatTime(m.end_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WeekView({ date, meetings }: { date: Date; meetings: Meeting[] }) {
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
              <div className="text-xs opacity-60">-</div>
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

function MonthView({ date, meetings, onDayClick }: { date: Date; meetings: Meeting[]; onDayClick?: (d: Date) => void }) {
  const from = startOfMonth(date)
  const start = startOfWeek(from)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const thisMonth = from.getMonth()
  return (
    <div className="grid grid-cols-7 gap-2 min-h-[220px]">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="text-xs font-medium opacity-70 px-1">{d}</div>
      ))}
      {cells.map((d) => {
        const key = d.toDateString()
        const items = meetings.filter(e => new Date(e.start_at).toDateString() === key)
        const dim = d.getMonth() !== thisMonth
        return (
          <div
            key={key}
            className={`rounded border border-gray-200 dark:border-neutral-800 p-2 min-h-[84px] ${dim ? 'opacity-60' : ''} cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20`}
            onClick={() => onDayClick?.(d)}
            role="button"
            aria-label={`Open meetings for ${d.toDateString()}`}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick?.(d) } }}
          >
            <div className="text-xs font-medium mb-1">{d.getDate()}</div>
            <ul className="space-y-1">
              {items.slice(0, 3).map((m: any) => (
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

