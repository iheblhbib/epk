import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Nested inside ProtectedRoute, so loading/auth/verified-email states are
 * already handled by the time this renders — this only adds the admin-role
 * check on top.
 */
export function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
