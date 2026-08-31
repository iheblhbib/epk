import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
  })

  it('logs in and navigates to the dashboard on valid credentials', async () => {
    server.use(
      http.get(`${API_URL}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API_URL}/api/login`, () =>
        HttpResponse.json({
          data: { id: 1, name: 'Ada', email: 'ada@example.com', role: 'user' },
        })
      )
    )

    const user = userEvent.setup()
    renderLoginPage()

    // Exact label match: the show/hide toggle button's "Show password" aria-label
    // would also match a loose /password/i query and cause an ambiguous lookup.
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
  })

  it('does not blame the password for a 429 rate-limit response the way it does a real credentials mismatch', async () => {
    server.use(
      http.get(`${API_URL}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
      http.post(
        `${API_URL}/api/login`,
        () => HttpResponse.json({ message: 'Too Many Attempts.' }, { status: 429 })
      )
    )

    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)

    // Waits for the mutation to actually settle (the button re-enables once
    // login.isPending flips back to false) before asserting on its outcome.
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    // The bug this guards: every login failure — a real wrong password *and*
    // being rate-limited — used to set this same "credentials do not match"
    // field error, making a 429 indistinguishable from just another typo.
    expect(screen.queryByText(/credentials do not match/i)).not.toBeInTheDocument()
  })
})
