import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="p-8" role="alert" aria-live="assertive">
      <h2 className="text-2xl font-semibold mb-2">404 — Page Not Found</h2>
      <p className="mb-4 opacity-80">The page you’re looking for does not exist.</p>
      <Link to="/" className="underline brand-text">
        Go back home
      </Link>
    </div>
  )
}

