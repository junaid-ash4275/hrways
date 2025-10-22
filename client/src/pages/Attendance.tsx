import { useEffect, useMemo, useRef, useState } from 'react'
import { http } from '../api/http'
import { useUI } from '../ui/UIContext'
import { MagnifyingGlassIcon, ChevronDownIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

type Employee = { id: string; employee_code: string; name: string; email: string }

export default function Attendance() {
  const { notify } = useUI()
  const [q, setQ] = useState('')
  const [empOptions, setEmpOptions] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0,10)
  })
  const [dateTo, setDateTo] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [status, setStatus] = useState<'PRESENT'|'ABSENT'|'LEAVE'|'HALF_DAY'>('ABSENT')
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [lastApplied, setLastApplied] = useState<{ status: string; days: string[] } | null>(null)
  const [list, setList] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  // Review search state (separate from form "Employee")
  const [reviewQ, setReviewQ] = useState('')
  const [reviewOptions, setReviewOptions] = useState<Employee[]>([])
  const [reviewSelected, setReviewSelected] = useState<Employee | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  // Exceptions-only list by default
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const h = setTimeout(async () => {
      if (!q.trim()) { setEmpOptions([]); return }
      try {
        const { data } = await http.get('/employees', { params: { q, page: 1, pageSize: 5 } })
        setEmpOptions((data?.data || []).map((r:any) => ({ id: r.id, employee_code: r.employee_code, name: r.name, email: r.email })))
      } catch {}
    }, 250)
    return () => clearTimeout(h)
  }, [q])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { notify({ type: 'error', message: 'Please select an employee' }); return }
    if (!dateFrom) { notify({ type: 'error', message: 'Please select a start date' }); return }
    try {
      setLoading(true)
      const payload: any = { employee_id: selected.id, date_from: dateFrom, status }
      if (dateTo) payload.date_to = dateTo
      if (includeWeekends) payload.includeWeekends = 'true'
      if (clockIn) payload.clock_in = clockIn
      if (clockOut) payload.clock_out = clockOut
      const { data } = await http.post('/attendance', payload)
      notify({ type: 'success', message: 'Attendance recorded' })
      if (data?.ok && Array.isArray(data?.days)) {
        setLastApplied({ status: data.status || status, days: data.days })
      } else {
        setLastApplied(null)
      }
      setClockIn(''); setClockOut(''); setStatus('ABSENT')
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to record attendance'
      notify({ type: 'error', message: m })
    } finally { setLoading(false) }
  }

  // Load exceptions by default on mount
  useEffect(() => {
    (async () => {
      try {
        setListLoading(true)
        const params: any = { from: dateFrom, to: (dateTo || dateFrom) }
        const { data } = await http.get('/attendance', { params })
        setList(data?.data || [])
      } catch {
      } finally { setListLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Review search (typeahead)
  useEffect(() => {
    const h = setTimeout(async () => {
      if (!reviewQ.trim()) { setReviewOptions([]); return }
      try {
        const { data } = await http.get('/employees', { params: { q: reviewQ, page: 1, pageSize: 5 } })
        setReviewOptions((data?.data || []).map((r:any) => ({ id: r.id, employee_code: r.employee_code, name: r.name, email: r.email })))
      } catch {}
    }, 250)
    return () => clearTimeout(h)
  }, [reviewQ])

  // When selecting an employee for review, load their history (detail list)
  useEffect(() => {
    (async () => {
      if (!reviewSelected) return
      try {
        setListLoading(true)
        const params: any = { employee_id: reviewSelected.id, detail: 'true' }
        const { data } = await http.get('/attendance', { params })
        setList(data?.data || [])
      } catch {}
      finally { setListLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewSelected])

  // Close export dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!exportRef.current) return
      if (!exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [])

  async function downloadBlob(url: string, params: Record<string, any>, fallbackName: string) {
    const resp = await http.get(url, { params, responseType: 'blob' })
    const blob = resp.data
    let filename = fallbackName
    const cd = resp.headers?.['content-disposition'] || resp.headers?.['Content-Disposition']
    if (cd && typeof cd === 'string') {
      const m = /filename="?([^";]+)"?/i.exec(cd)
      if (m) filename = m[1]
    }
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  const exportCsv = async () => {
    try {
      setCsvLoading(true)
      const params: any = {}
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
      if (includeWeekends) params.includeWeekends = 'true'
      if (reviewSelected?.id) params.employee_id = reviewSelected.id
      else if (selected?.id) params.employee_id = selected.id
      // Exceptions-only by default (no includeComputed)
      await downloadBlob('/attendance/export.csv', params, 'attendance.csv')
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to export CSV'
      notify({ type: 'error', message: m })
    } finally { setCsvLoading(false) }
  }

  const exportPdf = async () => {
    const from = dateFrom
    const to = dateTo || dateFrom
    if (!from || !to) { notify({ type: 'error', message: 'Please select date(s) first' }); return }
    try {
      setPdfLoading(true)
      const params: any = { from, to }
      if (includeWeekends) params.includeWeekends = 'true'
      if (reviewSelected?.id) params.employee_id = reviewSelected.id
      else if (selected?.id) params.employee_id = selected.id
      await downloadBlob('/attendance/summary.pdf', params, 'attendance_summary.pdf')
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to export PDF'
      notify({ type: 'error', message: m })
    } finally { setPdfLoading(false) }
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-1">Attendance</h2>
      <p className="opacity-80 mb-5 text-sm">Quickly mark exceptions and review employee history. Exports are available from the review card.</p>

      <form onSubmit={onSubmit} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm p-5 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Employee</label>
            <input
              type="text"
              placeholder="Search name, email, code"
              value={selected ? `${selected.employee_code} — ${selected.name}` : q}
              onChange={(e) => { setSelected(null); setQ(e.target.value) }}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {!selected && empOptions.length > 0 && (
              <ul className="mt-1 rounded border border-gray-200 dark:border-neutral-700 divide-y divide-gray-200 dark:divide-neutral-800 max-h-40 overflow-auto bg-white dark:bg-neutral-900">
                {empOptions.map((e) => (
                  <li key={e.id} className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer" onClick={() => { setSelected(e); setQ('') }}>
                    <div className="font-medium text-sm">{e.name} <span className="opacity-60">({e.employee_code})</span></div>
                    <div className="text-xs opacity-70">{e.email}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm mb-1">To (optional)</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100" />
            <p className="mt-1 text-xs opacity-70">Marks status for all weekdays in the range.</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Clock In</label>
            <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm mb-1">Clock Out</label>
            <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
              <option value="PRESENT">PRESENT</option>
              <option value="ABSENT">ABSENT</option>
              <option value="LEAVE">LEAVE</option>
              <option value="HALF_DAY">HALF_DAY</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="wknd" type="checkbox" checked={includeWeekends} onChange={(e) => setIncludeWeekends(e.target.checked)} />
            <label htmlFor="wknd" className="text-sm">Include weekends</label>
          </div>
        </div>
        <div className="mt-4">
          <button disabled={loading || !selected || !dateFrom} className="px-3 py-2 rounded brand-gradient text-white disabled:opacity-50 shadow-sm">{loading ? 'Saving…' : 'Apply Status'}</button>
        </div>
      </form>

      {lastApplied && (
        <div className="mt-4 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 max-w-4xl mx-auto">
          <div className="font-medium mb-2">Last Applied</div>
          <div className="text-sm opacity-80 mb-2">Status: <span className="font-semibold">{lastApplied.status}</span> • Days: {lastApplied.days.length}</div>
          <ul className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
            {lastApplied.days.map((d) => (
              <li key={d} className="px-2 py-1 rounded border border-gray-200 dark:border-neutral-700">{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-medium">Review & History</div>
            <div className="text-xs opacity-70 mb-2">Exceptions: shows employees with ABSENT/LEAVE/HALF_DAY.</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-2.5 opacity-60" />
              <input
                type="text"
                placeholder="Search employee for history"
                value={reviewSelected ? `${reviewSelected.employee_code} — ${reviewSelected.name}` : reviewQ}
                onChange={(e) => { setReviewSelected(null); setReviewQ(e.target.value) }}
                className="pl-8 pr-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ minWidth: 280 }}
              />
              {!reviewSelected && reviewOptions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 overflow-auto rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
                  {reviewOptions.map((e) => (
                    <li key={e.id} className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer" onClick={() => { setReviewSelected(e); setReviewQ('') }}>
                      <div className="font-medium text-sm">{e.name} <span className="opacity-60">({e.employee_code})</span></div>
                      <div className="text-xs opacity-70">{e.email}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={async () => {
                // If an employee is selected in review, this button clears the selection
                if (reviewSelected) {
                  setReviewSelected(null);
                  setReviewQ('');
                  // Reload today's (or selected dates') exceptions without employee filter
                  try {
                    setListLoading(true)
                    const params: any = { from: dateFrom, to: (dateTo || dateFrom) }
                    const { data } = await http.get('/attendance', { params })
                    setList(data?.data || [])
                  } catch {}
                  finally { setListLoading(false) }
                  return
                }

                // Default behavior: Show list for selected dates
                if (!dateFrom) return
                try {
                  setListLoading(true)
                  const params: any = { from: dateFrom, to: (dateTo || dateFrom) }
                  const { data } = await http.get('/attendance', { params })
                  setList(data?.data || [])
                } catch {}
                finally { setListLoading(false) }
              }}
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700"
            >{reviewSelected ? 'Clear' : 'Show'}</button>
            <div ref={exportRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setExportOpen((v) => !v) }}
                className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 flex items-center gap-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> Export <ChevronDownIcon className="w-4 h-4 opacity-70" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-40 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                  <button onClick={() => { setExportOpen(false); exportCsv() }} className="block w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Export CSV</button>
                  <button onClick={() => { setExportOpen(false); exportPdf() }} className="block w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Export PDF</button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {listLoading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-sm opacity-70">No exceptions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-neutral-700">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Date / Range</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const start = (r.start_date || r.work_date || '').slice(0,10)
                const end = (r.end_date || '').slice(0,10)
                const dateCell = r.days && r.days > 1 && end ? `${start} - ${end}` : start
                return (
                  <tr key={`${r.employee_id}-${start}-${end || ''}-${r.status}`} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10">
                    <td className="py-2 pr-3 whitespace-nowrap font-medium">{r.employee_code} — {r.name}</td>
                    <td className="py-2 pr-3">{dateCell || '-'}</td>
                    <td className="py-2 pr-3">{r.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
