export default function Forbidden() {
  return (
    <div className="p-8" role="alert" aria-live="assertive">
      <h2 className="text-2xl font-semibold mb-2">403 — Forbidden</h2>
      <p className="opacity-80">You don’t have permission to access this page.</p>
    </div>
  )
}

