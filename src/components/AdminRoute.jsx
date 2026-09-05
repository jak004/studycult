import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted font-body">Loading…</div>
  }

  if (!session) return <Navigate to="/login" replace />
  if (!profile?.is_admin) return <Navigate to="/dashboard" replace />

  return children
}
