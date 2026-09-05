import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted font-body">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Google/OTP sign-ups have no role until they finish this step.
  if (profile && !profile.role && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  return children
}
