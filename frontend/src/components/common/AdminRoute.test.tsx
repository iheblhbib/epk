import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminRoute } from '@/components/common/AdminRoute'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function mockUser(role: 'user' | 'admin') {
  server.use(
    http.get(`${API_URL}/api/user`, () =>
      HttpResponse.json({
        data: {
          id: 1,
          name: 'Ada',
          email: 'ada@example.com',
          role,
          email_verified_at: '2026-01-01T00:00:00.000000Z',
        },
      })
    )
  )
}

function renderAdminRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            {/* AdminRoute's contract (see its own comment) is to run nested
                inside ProtectedRoute, which is what actually resolves the
                loading/auth state before it ever renders — reproduced here
                so this test matches how router.tsx really composes them. */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div>Dashboard home</div>} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<div>Admin panel</div>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('AdminRoute', () => {
  it('redirects a non-admin user away from the admin panel', async () => {
    mockUser('user')

    renderAdminRoute()

    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
  })

  it('renders the admin panel for an admin user', async () => {
    mockUser('admin')

    renderAdminRoute()

    await waitFor(() => expect(screen.getByText('Admin panel')).toBeInTheDocument())
  })
})
