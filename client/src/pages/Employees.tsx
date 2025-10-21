import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import { http } from '../api/http'
import { useUI } from '../ui/UIContext'

export default function Employees() {
  const { notify } = useUI()
  const [employee_code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [join_date, setJoinDate] = useState('')
  const [birthday, setBirthday] = useState('')
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loadingList, setLoadingList] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fDept, setFDept] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sort, setSort] = useState<'created_at' | 'name' | 'code'>('created_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<any>({})
  const editingRowRef = useRef<HTMLTableRowElement | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [docsEmployeeId, setDocsEmployeeId] = useState<string | null>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize) || 1), [total, pageSize])

  // Compute visible page buttons with ellipsis
  const pageButtons = useMemo<(number | '...')[]>(() => {
    const items: (number | '...')[] = []
    const totalPages = pages
    const cur = page
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i)
      return items
    }
    items.push(1)
    if (cur > 3) items.push('...')
    const start = Math.max(2, cur - 1)
    const end = Math.min(totalPages - 1, cur + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (cur < totalPages - 2) items.push('...')
    items.push(totalPages)
    return items
  }, [page, pages])

  const fetchList = async (
    p = page,
    ps = pageSize,
    nextQ = q,
    nextStatus = fStatus,
    nextDept = fDept,
  ) => {
    try {
      setLoadingList(true)
      const params: any = { page: p, pageSize: ps, sort, dir }
      if (nextQ && nextQ.trim()) params.q = nextQ.trim()
      if (nextStatus) params.status = nextStatus
      if (nextDept && nextDept.trim()) params.department = nextDept.trim()
      if (includeArchived) params.includeArchived = 'true'
      const { data } = await http.get('/employees', { params })
      setList(data?.data || [])
      setTotal(data?.total || 0)
      setPage(data?.page || p)
      setPageSize(data?.pageSize || ps)
    } catch {}
    finally { setLoadingList(false) }
  }

  useEffect(() => { fetchList(1, pageSize, q, fStatus, fDept) }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // quick client validation
    if (!employee_code || !name || !email) {
      notify({ type: 'error', message: 'employee_code, name, and email are required' })
      return
    }
    if (!/^[A-Za-z0-9_\\-]{3,20}$/.test(employee_code)) {
      notify({ type: 'error', message: 'Invalid employee_code (3-20 chars, letters/numbers/_/-)' })
      return
    }
    try {
      setLoading(true)
      await http.post('/employees', { employee_code, name, email, phone, department, title, status, join_date, birthday })
      notify({ type: 'success', message: 'Employee created' })
      setCode(''); setName(''); setEmail(''); setPhone(''); setDepartment(''); setTitle(''); setStatus('ACTIVE'); setJoinDate(''); setBirthday('')
      fetchList(1, pageSize, q, fStatus, fDept)
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to create employee'
      notify({ type: 'error', message: m })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (row: any) => {
    setEditingId(row.id)
    setEditRow({
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      department: row.department || '',
      title: row.title || '',
      status: row.status || 'ACTIVE',
      join_date: row.join_date ? String(row.join_date).slice(0,10) : '',
      birth_date: row.birth_date ? String(row.birth_date).slice(0,10) : '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditRow({}) }

  const saveEdit = async (id: string) => {
    try {
      const payload: any = {}
      Object.keys(editRow).forEach((k) => { if (editRow[k] !== undefined) payload[k] = editRow[k] })
      const { data } = await http.put(`/employees/${id}`, payload)
      setList((old) => old.map((r) => r.id === id ? { ...r, ...data } : r))
      setEditingId(null)
      setEditRow({})
      notify({ type: 'success', message: 'Employee updated' })
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to update employee'
      notify({ type: 'error', message: m })
    }
  }

  const triggerUpload = (id: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,image/*'
    input.onchange = async () => {
      const file = input.files && input.files[0]
      if (!file) return
      try {
        setUploadingId(id)
        const fd = new FormData()
        fd.append('file', file)
        await http.post(`/employees/${id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        notify({ type: 'success', message: 'Document uploaded' })
      } catch (err: any) {
        const m = err?.response?.data?.error?.message || 'Failed to upload document'
        notify({ type: 'error', message: m })
      } finally {
        setUploadingId(null)
      }
    }
    input.click()
  }

  const openDocs = async (id: string) => {
    try {
      setDocsLoading(true)
      setDocsEmployeeId(id)
      const { data } = await http.get(`/employees/${id}/documents`)
      setDocs(data?.data || [])
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to load documents'
      notify({ type: 'error', message: m })
    } finally { setDocsLoading(false) }
  }

  const closeDocs = () => { setDocsEmployeeId(null); setDocs([]) }

  const downloadDoc = async (empId: string, d: any) => {
    try {
      const resp = await http.get(`/employees/${empId}/documents/${d.id}/download`, { responseType: 'blob' })
      const blob = new Blob([resp.data], { type: d.mime })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = d.filename || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to download document'
      notify({ type: 'error', message: m })
    }
  }

  const deleteDoc = async (empId: string, d: any) => {
    try {
      await http.delete(`/employees/${empId}/documents/${d.id}`)
      setDocs((old) => old.filter((x) => x.id !== d.id))
      notify({ type: 'success', message: 'Document deleted' })
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to delete document'
      notify({ type: 'error', message: m })
    }
  }

  const toggleArchive = async (row: any) => {
    try {
      if (row.status === 'ACTIVE') {
        await http.patch(`/employees/${row.id}/archive`)
        setList((old) => old.map((r) => r.id === row.id ? { ...r, status: 'INACTIVE' } : r))
      } else {
        await http.patch(`/employees/${row.id}/activate`)
        setList((old) => old.map((r) => r.id === row.id ? { ...r, status: 'ACTIVE' } : r))
      }
    } catch (err: any) {
      const m = err?.response?.data?.error?.message || 'Failed to update status'
      notify({ type: 'error', message: m })
    }
  }

  const handleRowBlur = (rowId: string) => {
    // Defer to allow focus to move within row
    setTimeout(() => {
      const rowEl = editingRowRef.current
      const active = document.activeElement as HTMLElement | null
      if (!rowEl) return
      if (!active || !rowEl.contains(active)) {
        // Focus left the edit row; save changes
        saveEdit(rowId)
      }
    }, 0)
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Employees</h2>
      <div className="flex items-center justify-between mb-4">
        <p className="opacity-80">Create and manage employees.</p>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search (code, name, email...)"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100"
            value={q}
            onChange={(e) => { const v = e.target.value; setQ(v); if (!v.trim()) fetchList(1, pageSize, '', fStatus, fDept); }}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchList(1, pageSize, q, fStatus, fDept) }}
          />
          {q && (
            <button
              aria-label="Clear search"
              title="Clear search"
              onClick={() => { setQ(''); fetchList(1, pageSize, '', fStatus, fDept); }}
              className="p-2 rounded-lg border border-gray-300 dark:border-neutral-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
          <button onClick={() => fetchList(1, pageSize, q, fStatus, fDept)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700">Search</button>
          <button onClick={() => setShowForm(true)} className="px-3 py-2 rounded-lg brand-gradient text-white shadow">New employee</button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Employee directory</h3>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="fst">Status</label>
            <select id="fst" value={fStatus} onChange={(e) => { const v = (e.target.value || '').toUpperCase(); setFStatus(v); fetchList(1, pageSize, q, v, fDept) }} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]">
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <label htmlFor="fd" className="ml-3">Department</label>
            <input
              id="fd"
              value={fDept}
              onChange={(e) => { const v = e.target.value; setFDept(v); fetchList(1, pageSize, q, fStatus, v); }}
              placeholder="e.g., HR"
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100"
            />
            <label htmlFor="ia" className="ml-3">Include archived</label>
            <input id="ia" type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); fetchList(1, pageSize, q, fStatus, fDept); }} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-neutral-700">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Join Date</th>
                <th className="py-2 pr-3">Birthday</th>
                <th className="py-2 pr-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr><td colSpan={9} className="py-6 text-center opacity-70">Loading…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center opacity-70">No employees yet</td></tr>
              ) : (
                list.map((e) => {
                  const isEdit = editingId === e.id
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50/50 dark:hover:bg-neutral-800/40 cursor-pointer"
                      onClick={() => { if (!isEdit) startEdit(e) }}
                      ref={isEdit ? editingRowRef : null}
                    >
                      <td className="py-2 pr-3">{e.employee_code}</td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input value={editRow.name} onChange={(ev) => setEditRow((r:any) => ({ ...r, name: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id) }} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-transparent" />
                        ) : e.name}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input type="email" value={editRow.email} onChange={(ev) => setEditRow((r:any) => ({ ...r, email: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id) }} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-transparent" />
                        ) : e.email}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input value={editRow.phone} onChange={(ev) => setEditRow((r:any) => ({ ...r, phone: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id) }} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-transparent" />
                        ) : (e.phone || '-')}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input value={editRow.department} onChange={(ev) => setEditRow((r:any) => ({ ...r, department: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id) }} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-transparent" />
                        ) : (e.department || '-')}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input value={editRow.title} onChange={(ev) => setEditRow((r:any) => ({ ...r, title: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id) }} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-transparent" />
                        ) : (e.title || '-')}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <select value={editRow.status} onChange={(ev) => setEditRow((r:any) => ({ ...r, status: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]">
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        ) : e.status}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input type="date" value={editRow.join_date} onChange={(ev) => setEditRow((r:any) => ({ ...r, join_date: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" />
                        ) : (e.join_date ? new Date(e.join_date).toLocaleDateString() : '-')}
                      </td>
                      <td className="py-2 pr-3">
                        {isEdit ? (
                          <input type="date" value={editRow.birth_date} onChange={(ev) => setEditRow((r:any) => ({ ...r, birth_date: ev.target.value }))} onBlur={() => handleRowBlur(e.id)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" />
                        ) : (e.birth_date ? new Date(e.birth_date).toLocaleDateString() : '-')}
                      </td>
                      <td className="py-2 pr-0">
                        <div className="flex items-center gap-2">
                          <button onClick={(ev) => { ev.stopPropagation(); toggleArchive(e) }} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700">{e.status === 'ACTIVE' ? 'Archive' : 'Activate'}</button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); triggerUpload(e.id) }}
                            disabled={uploadingId === e.id}
                            className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50"
                          >{uploadingId === e.id ? 'Uploading…' : 'Upload Doc'}</button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); openDocs(e.id) }}
                            className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700"
                          >Docs</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {docsEmployeeId && (
          <div className="mt-4 border border-gray-200 dark:border-neutral-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Documents</div>
              <button onClick={closeDocs} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700">Close</button>
            </div>
            {docsLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : docs.length === 0 ? (
              <div className="text-sm opacity-70">No documents uploaded.</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-neutral-700">
                {docs.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate">{d.filename}</div>
                      <div className="text-xs opacity-70">{d.mime} • {formatSize(d.size_bytes)} • {new Date(d.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => downloadDoc(docsEmployeeId, d)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700">Download</button>
                      <button onClick={() => deleteDoc(docsEmployeeId!, d)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 text-sm border-t border-gray-200 dark:border-neutral-700 pt-3 sticky bottom-0 bg-white dark:bg-neutral-800">
          <div className="opacity-70">Page {page} of {pages} | {total} total</div>
          <nav aria-label="Pagination" className="flex items-center gap-2">
            <label htmlFor="pg" className="sr-only">Go to page</label>
            <input
              id="pg"
              type="number"
              min={1}
              max={pages}
              value={page}
              onChange={(e) => { const p = Math.max(1, Math.min(pages, Number(e.target.value) || 1)); setPage(p); }}
              onBlur={() => fetchList(page, pageSize, q, fStatus, fDept)}
              className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100"
            />
            <button
              disabled={page <= 1 || loadingList}
              onClick={() => fetchList(1, pageSize, q, fStatus, fDept)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50 flex items-center gap-1"
              aria-label="First page"
              title="First page"
            >
              <ChevronDoubleLeftIcon className="h-4 w-4" />
              <span className="hidden sm:inline">First</span>
      </button>
            <button
              disabled={page <= 1 || loadingList}
              onClick={() => fetchList(page - 1, pageSize, q, fStatus, fDept)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50 flex items-center gap-1"
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Numeric buttons */}
            {pageButtons.map((it, idx) => (
              it === '...'
                ? <span key={`dots-${idx}`} className="px-2">…</span>
                : (
                  <button
                    key={it}
                    onClick={() => fetchList(it as number, pageSize, q, fStatus, fDept)}
                    aria-label={`Page ${it}`}
                    aria-current={it === page ? 'page' : undefined}
                    className={`px-2 py-1 rounded border text-sm ${it === page
                      ? 'brand-gradient text-white border-transparent'
                      : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
                  >{it}</button>
                )
            ))}

            <button
              disabled={page >= pages || loadingList}
              onClick={() => fetchList(page + 1, pageSize, q, fStatus, fDept)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50 flex items-center gap-1"
              aria-label="Next page"
              title="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pages || loadingList}
              onClick={() => fetchList(pages, pageSize, q, fStatus, fDept)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50 flex items-center gap-1"
              aria-label="Last page"
              title="Last page"
            >
              <span className="hidden sm:inline">Last</span>
              <ChevronDoubleRightIcon className="h-4 w-4" />
            </button>

            <label htmlFor="ps" className="ml-3">Rows</label>
            <select id="ps" value={pageSize} onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); fetchList(1, ps, q, fStatus, fDept) }} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </nav>
        </div>
      </div>
      {/* Modal for create */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-4xl bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Create employee</h3>
              <button onClick={() => setShowForm(false)} className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700">Close</button>
            </div>
            <form onSubmit={onSubmit}>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="code">Employee code</label>
            <input id="code" value={employee_code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., EMP-001" required />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., Alex Johnson" required />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., alex@example.com" required />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="phone">Phone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., +1 (555) 123-4567" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="dept">Department</label>
            <input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., HR" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent" placeholder="e.g., HR Manager" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="jd">Join date</label>
            <input id="jd" type="date" value={join_date} onChange={(e) => setJoinDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="bd">Birthday (optional)</label>
            <input id="bd" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button disabled={loading} className="px-4 py-2 rounded-lg brand-gradient text-white shadow hover:opacity-95 disabled:opacity-60 transition">{loading ? 'Creating…' : 'Create employee'}</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700">Cancel</button>
        </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function formatSize(n?: number) {
  if (!n || n <= 0) return '0 B'
  const units = ['B','KB','MB','GB']
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++ }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}







