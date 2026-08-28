import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function ProtectedRoute() {
  const { isLoading, isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Most actions (e.g. creating a workspace) require a verified email on the
  // backend, so route there first rather than letting the user hit dead-end
  // 403s throughout the app.
  if (!user?.email_verified_at) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}
