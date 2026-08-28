import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Redirects an already-authenticated user away from auth pages
 * (login/register/etc.) back into the app.
 */
export function GuestRoute() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}
