import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotificationBell } from '@/components/common/NotificationBell'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'
import type { AppNotification } from '@/types'

const API_URL = 'http://localhost:8000'

const invitationNotification: AppNotification = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  kind: 'workspace_invitation',
  payload: {
    kind: 'workspace_invitation',
    member_id: 1,
    workspace_id: 1,
    workspace_name: 'Acme Records',
    role: 'editor',
    inviter_name: 'Ada Lovelace',
    invite_token: 'a-real-invite-token',
  },
  read_at: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
}

function mockAuthenticated() {
  server.use(
    http.get(`${API_URL}/api/user`, () =>
      HttpResponse.json({
        data: { id: 1, name: 'Ada', email: 'ada@example.com', role: 'user', email_verified_at: '2026-01-01T00:00:00.000000Z' },
      })
    )
  )
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <NotificationBell />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('NotificationBell', () => {
  it('shows the unread count badge when there are unread notifications', async () => {
    mockAuthenticated()
    server.use(http.get(`${API_URL}/api/notifications/unread-count`, () => HttpResponse.json({ count: 2 })))

    renderBell()

    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('shows no badge when there are no unread notifications', async () => {
    mockAuthenticated()
    server.use(http.get(`${API_URL}/api/notifications/unread-count`, () => HttpResponse.json({ count: 0 })))

    renderBell()

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('lists notifications with the inviter, workspace, and role once opened', async () => {
    mockAuthenticated()
    server.use(
      http.get(`${API_URL}/api/notifications/unread-count`, () => HttpResponse.json({ count: 1 })),
      http.get(`${API_URL}/api/notifications`, () =>
        HttpResponse.json({ data: [invitationNotification], meta: { current_page: 1, last_page: 1, total: 1 } })
      )
    )

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByRole('button'))

    const link = await screen.findByRole('link')
    expect(within(link).getByText(/Ada Lovelace/)).toBeInTheDocument()
    expect(within(link).getByText(/Acme Records/)).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/invitations/a-real-invite-token')
  })

  it('shows an empty state when there are no notifications', async () => {
    mockAuthenticated()
    server.use(
      http.get(`${API_URL}/api/notifications/unread-count`, () => HttpResponse.json({ count: 0 })),
      http.get(`${API_URL}/api/notifications`, () =>
        HttpResponse.json({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
      )
    )

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByRole('button'))

    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
  })

  it('marks all notifications as read', async () => {
    mockAuthenticated()
    let markAllCalled = false
    server.use(
      http.get(`${API_URL}/api/notifications/unread-count`, () =>
        HttpResponse.json({ count: markAllCalled ? 0 : 1 })
      ),
      http.get(`${API_URL}/api/notifications`, () =>
        HttpResponse.json({ data: [invitationNotification], meta: { current_page: 1, last_page: 1, total: 1 } })
      ),
      http.post(`${API_URL}/api/notifications/mark-all-read`, () => {
        markAllCalled = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByRole('button'))
    await user.click(await screen.findByText('Mark all as read'))

    await waitFor(() => expect(markAllCalled).toBe(true))
  })
})
