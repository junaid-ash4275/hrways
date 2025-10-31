import { useEffect, useMemo, useState } from 'react'
import { http } from '../api/http'
import { useUI } from '../ui/UIContext'

type PayrollRun = { id: string; run_month: string; status: string; created_at: string; total_gross: number; total_net: number; payslip_count: number }

export default function Payroll() {
  const { notify } = useUI()

  // Create run state
  const [month, setMonth] = useState<string>(() => {
    const d = new Date(); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`
  })
  const [creating, setCreating] = useState(false)

  // Runs list
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [rTotal, setRTotal] = useState(0)
  const [rPage, setRPage] = useState(1)
  const [rPageSize, setRPageSize] = useState(10)
  const [rLoading, setRLoading] = useState(false)
  const [rError, setRError] = useState('')

  // Payslips for selected run
  const [selRun, setSelRun] = useState<PayrollRun | null>(null)
  const [slips, setSlips] = useState<any[]>([])
  const [sTotal, setSTotal] = useState(0)
  const [sPage, setSPage] = useState(1)
  const [sPageSize, setSPageSize] = useState(10)
  const [sLoading, setSLoading] = useState(false)
  const [sError, setSError] = useState('')

  // Salary profile quick add
  const [empQ, setEmpQ] = useState('')
  const [empResults, setEmpResults] = useState<any[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [selEmp, setSelEmp] = useState<any | null>(null)
  const [base, setBase] = useState('')
  const [allow, setAllow] = useState('0')
  const [deduct, setDeduct] = useState('0')
  const [eff, setEff] = useState<string>(() => {
    const d = new Date(); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`
  })
  const [savingProfile, setSavingProfile] = useState(false)

  // Load runs
  async function loadRuns(page = rPage, pageSize = rPageSize) {
    try {
      setRLoading(true); setRError('')
      const { data } = await http.get('/payroll/runs', { params: { page, pageSize } })
      setRuns(data?.data || [])
      setRTotal(data?.total || 0)
    } catch (e: any) {
      setRError(e?.response?.data?.error?.message || 'Failed to load payroll runs')
    } finally {
      setRLoading(false)
    }
  }
  useEffect(() => { loadRuns() }, [])

  // Load payslips when selRun changes
  useEffect(() => {
    if (!selRun) return
    let alive = true
    ;(async () => {
      try {
        setSLoading(true); setSError('')
        const { data } = await http.get(`/payroll/runs/${selRun.id}/payslips`, { params: { page: sPage, pageSize: sPageSize } })
        if (!alive) return
        setSlips(data?.data || [])
        setSTotal(data?.total || 0)
      } catch (e: any) {
        if (!alive) return
        setSError(e?.response?.data?.error?.message || 'Failed to load payslips')
      } finally {
        if (alive) setSLoading(false)
      }
    })()
    return () => { alive = false }
  }, [selRun?.id, sPage, sPageSize])

  // Employee search for salary profiles
  useEffect(() => {
    const q = empQ.trim()
    if (!q) { setEmpResults([]); return }
    let alive = true
    const t = window.setTimeout(async () => {
      try {
        setEmpLoading(true)
        const { data } = await http.get('/employees', { params: { q, page: 1, pageSize: 10 } })
        if (!alive) return
        setEmpResults(data?.data || [])
      } catch {
        if (!alive) return
        setEmpResults([])
      } finally {
        if (alive) setEmpLoading(false)
      }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [empQ])

  async function createRun(e: React.FormEvent) {
    e.preventDefault()
    try {
      setCreating(true)
      await http.post('/payroll/runs', { month })
      notify({ type: 'success', message: 'Payroll run created' })
      setSPage(1); setSelRun(null)
      await loadRuns()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to create payroll run'
      notify({ type: 'error', message: msg })
    } finally {
      setCreating(false)
    }
  }

  async function saveSalaryProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!selEmp) { notify({ type: 'error', message: 'Select an employee' }); return }
    const b = Number(base); const a = Number(allow || 0); const d = Number(deduct || 0)
    if (!Number.isFinite(b) || b < 0) { notify({ type: 'error', message: 'Base must be a non-negative number' }); return }
    if (!Number.isFinite(a) || a < 0) { notify({ type: 'error', message: 'Allowances must be non-negative' }); return }
    if (!Number.isFinite(d) || d < 0) { notify({ type: 'error', message: 'Deductions must be non-negative' }); return }
    try {
      setSavingProfile(true)
      await http.post('/payroll/salary-profiles', { employee_id: selEmp.id, base: b, allowances: a, deductions: d, effective_from: eff })
      notify({ type: 'success', message: 'Salary profile saved' })
      setBase(''); setAllow('0'); setDeduct('0'); setSelEmp(null); setEmpQ('')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to save salary profile'
      const details = e?.response?.data?.error?.details
      notify({ type: 'error', message: Array.isArray(details) ? `${msg}: ${details[0]}` : msg })
    } finally { setSavingProfile(false) }
  }

  return (
    <section>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Payroll</h2>
          <p className="opacity-80">Create payroll runs and manage salary profiles.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create payroll run */}
          <div className="rounded border border-gray-200 dark:border-neutral-800 p-4">
            <h3 className="font-semibold mb-3">New Payroll Run</h3>
            <form onSubmit={createRun} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Month</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" />
              </div>
              <button disabled={creating} className={`px-3 py-2 rounded brand-gradient text-white disabled:opacity-50`}>{creating ? 'Creating...' : 'Run Payroll'}</button>
              <p className="text-xs opacity-70">Generates payslips for active employees with a salary profile effective on/before the selected month.</p>
            </form>
          </div>

          {/* Quick salary profile */}
          <div className="rounded border border-gray-200 dark:border-neutral-800 p-4">
            <h3 className="font-semibold mb-3">Quick Salary Profile</h3>
            <form onSubmit={saveSalaryProfile} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Employee</label>
                <input value={empQ} onChange={(e) => { setEmpQ(e.target.value); setSelEmp(null) }} placeholder="Search by name, email, code" className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" />
                {empQ.trim() && (
                  <div className="mt-2 max-h-40 overflow-auto rounded border border-gray-200 dark:border-neutral-800">
                    {empLoading ? (
                      <div className="p-2 text-sm opacity-70">Searching...</div>
                    ) : (empResults.length === 0 ? (
                      <div className="p-2 text-sm opacity-70">No matches.</div>
                    ) : (
                      <ul>
                        {empResults.map((e: any) => (
                          <li key={e.id}>
                            <button type="button" onClick={() => { setSelEmp(e); setEmpQ(`${e.employee_code} — ${e.name}`) }} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800">
                              <div className="text-sm font-medium">{e.name}</div>
                              <div className="text-xs opacity-70">{e.employee_code} · {e.email}</div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Base</label>
                  <input value={base} onChange={(e) => setBase(e.target.value)} className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Allowances</label>
                  <input value={allow} onChange={(e) => setAllow(e.target.value)} className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Deductions</label>
                  <input value={deduct} onChange={(e) => setDeduct(e.target.value)} className="w-full rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Effective From</label>
                <input type="month" value={eff} onChange={(e) => setEff(e.target.value)} className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2" />
              </div>
              <button disabled={savingProfile || !selEmp} className={`px-3 py-2 rounded brand-gradient text-white disabled:opacity-50`}>{savingProfile ? 'Saving...' : 'Save Profile'}</button>
              <p className="text-xs opacity-70">Add or update an employee's salary. Latest effective month is used for a payroll run.</p>
            </form>
          </div>
        </div>

        {/* Runs list */}
        <div className="rounded border border-gray-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Payroll Runs</h3>
            <div className="text-sm opacity-70">Page {rPage} of {Math.max(1, Math.ceil(rTotal / rPageSize))} · {rTotal} total</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-neutral-800">
                  <th className="py-2 pr-2">Month</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Payslips</th>
                  <th className="py-2 pr-2">Total Net</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rLoading ? (
                  <tr><td colSpan={5} className="py-6 text-center opacity-70">Loading...</td></tr>
                ) : runs.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center opacity-70">No payroll runs yet.</td></tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id} className="border-t border-gray-200 dark:border-neutral-800">
                      <td className="py-2 pr-2">{formatMonth(r.run_month)}</td>
                      <td className="py-2 pr-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${r.status === 'COMPLETED' ? 'brand-text brand-border-soft' : 'border-gray-300 dark:border-neutral-700'}`}>{r.status}</span></td>
                      <td className="py-2 pr-2">{r.payslip_count}</td>
                      <td className="py-2 pr-2">{formatCurrency(r.total_net)}</td>
                      <td className="py-2 pr-2 text-right"><button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => { setSelRun(r); setSPage(1) }}>View</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <select className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-2 py-1" value={rPageSize} onChange={async (e) => { const n = Number(e.target.value) || 10; setRPageSize(n); setRPage(1); await loadRuns(1, n) }}>
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
            <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={rPage <= 1} onClick={async () => { const p = Math.max(1, rPage - 1); setRPage(p); await loadRuns(p, rPageSize) }}>Prev</button>
            <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={(rPage * rPageSize) >= rTotal} onClick={async () => { const p = rPage + 1; setRPage(p); await loadRuns(p, rPageSize) }}>Next</button>
          </div>
        </div>

        {/* Payslips drawer/section */}
        {selRun && (
          <div className="rounded border border-gray-200 dark:border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Payslips — {formatMonth(selRun.run_month)}</h3>
                <div className="text-sm opacity-70">{selRun.payslip_count} payslips · Total net {formatCurrency(selRun.total_net)}</div>
              </div>
              <div>
                <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700" onClick={() => setSelRun(null)}>Close</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-neutral-800">
                    <th className="py-2 pr-2">Employee</th>
                    <th className="py-2 pr-2">Code</th>
                    <th className="py-2 pr-2">Gross</th>
                    <th className="py-2 pr-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {sLoading ? (
                    <tr><td colSpan={4} className="py-6 text-center opacity-70">Loading...</td></tr>
                  ) : slips.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center opacity-70">No payslips.</td></tr>
                  ) : (
                    slips.map((s: any) => (
                      <tr key={s.id} className="border-t border-gray-200 dark:border-neutral-800">
                        <td className="py-2 pr-2">{s.name} <span className="opacity-60">({s.email})</span></td>
                        <td className="py-2 pr-2">{s.employee_code}</td>
                        <td className="py-2 pr-2">{formatCurrency(s.gross)}</td>
                        <td className="py-2 pr-2">{formatCurrency(s.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <select className="rounded border border-gray-300 dark:border-neutral-700 bg-transparent px-2 py-1" value={sPageSize} onChange={(e) => { setSPageSize(Number(e.target.value) || 10); setSPage(1) }}>
                {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
              </select>
              <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={sPage <= 1} onClick={() => setSPage((p) => Math.max(1, p - 1))}>Prev</button>
              <button className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-60" disabled={(sPage * sPageSize) >= sTotal} onClick={() => setSPage((p) => p + 1)}>Next</button>
            </div>
            {sError && <div className="text-sm text-red-600 dark:text-red-400 mt-2">{sError}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

function formatMonth(isoDate: string) {
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return isoDate
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  } catch { return isoDate }
}

function formatCurrency(n: number | string) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  try { return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) } catch { return v.toFixed(2) }
}

