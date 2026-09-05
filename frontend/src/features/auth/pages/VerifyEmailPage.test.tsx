import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage'
import { server } from '@/test/server'
import { AuthProvider } from '@/providers/AuthProvider'

const API_URL = 'http://localhost:8000'

function mockUnverifiedUser() {
  server.use(
    http.get(`${API_URL}/api/user`, () =>
      HttpResponse.json({ data: { id: 1, name: 'Ada', email: 'ada@example.com', email_verified_at: null } })
    )
  )
}

function renderVerifyEmailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/verify-email']}>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables the resend button for 30 seconds after a successful resend, showing a countdown', async () => {
    mockUnverifiedUser()
    server.use(http.post(`${API_URL}/api/email/verification-notification`, () => HttpResponse.json({}, { status: 202 })))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderVerifyEmailPage()

    const button = await screen.findByRole('button', { name: /resend verification email/i })
    await user.click(button)

    // Immediately after a successful resend: disabled, counting down from 30.
    // Same element throughout -- its accessible name changes as the label does.
    await waitFor(() => expect(button).toHaveTextContent('30'))
    expect(button).toBeDisabled()

    // Not yet re-enabled partway through the cooldown.
    await act(() => vi.advanceTimersByTimeAsync(15_000))
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('15')

    // Re-enabled, and back to its normal label, once the full 30s have passed.
    await act(() => vi.advanceTimersByTimeAsync(15_000))
    await waitFor(() => expect(button).not.toBeDisabled())
    expect(button).toHaveTextContent(/resend verification email/i)
  })

  it('does not start a cooldown when the resend request fails', async () => {
    mockUnverifiedUser()
    server.use(
      http.post(`${API_URL}/api/email/verification-notification`, () => HttpResponse.json({ message: 'fail' }, { status: 503 }))
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderVerifyEmailPage()

    const button = await screen.findByRole('button', { name: /resend verification email/i })
    await user.click(button)

    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
