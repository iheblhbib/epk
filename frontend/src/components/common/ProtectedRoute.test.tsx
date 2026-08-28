import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function renderProtected() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>Secret dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when the user is not authenticated', async () => {
    renderProtected()

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument())
  })

  it('renders the protected content when authenticated', async () => {
    server.use(
      http.get(`${API_URL}/api/user`, () =>
        HttpResponse.json({
          data: {
            id: 1,
            name: 'Ada',
            email: 'ada@example.com',
            role: 'user',
            email_verified_at: '2026-01-01T00:00:00.000000Z',
          },
        })
      )
    )

    renderProtected()

    await waitFor(() => expect(screen.getByText('Secret dashboard')).toBeInTheDocument())
  })
})
