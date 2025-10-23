import { useEffect, useState } from 'react'
import { http } from '../api/http'

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

  return (
    <section>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold mb-2">Birthdays & Work Anniversaries</h2>
        <p className="opacity-80 mb-4">This month&apos;s celebrations.</p>
        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
        {loading ? (
          <div className="text-sm opacity-70">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-4">
              <h3 className="text-lg font-semibold mb-2">Birthdays</h3>
              {birthdays.length === 0 ? (
                <div className="text-sm opacity-70">No birthdays this month.</div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {birthdays.map((e) => (
                    <li key={`b-${e.id}`} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-xs opacity-70 truncate">{e.email}</div>
                      </div>
                      <div className="text-xs opacity-70">Day {e.day ?? ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-4">
              <h3 className="text-lg font-semibold mb-2">Work Anniversaries</h3>
              {anniv.length === 0 ? (
                <div className="text-sm opacity-70">No anniversaries this month.</div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {anniv.map((e) => (
                    <li key={`a-${e.id}`} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-xs opacity-70 truncate">{e.email}</div>
                      </div>
                      <div className="text-xs opacity-70">{e.years} yr • Day {e.day ?? ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
