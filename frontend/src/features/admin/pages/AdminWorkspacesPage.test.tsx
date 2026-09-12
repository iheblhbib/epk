import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AdminWorkspacesPage } from '@/features/admin/pages/AdminWorkspacesPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function workspacesResponse(status: string) {
  return {
    data: [
      {
        id: 1,
        name: 'Acme Records',
        slug: 'acme-records',
        members_count: 3,
        epks_count: 2,
        plan: 'pro',
        subscription_status: status,
        access_ends_at: null,
        creator: { id: 1, name: 'Ada Lovelace' },
        created_at: '2026-01-01T00:00:00.000000Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, total: 1 },
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminWorkspacesPage />
    </QueryClientProvider>
  )
}

describe('AdminWorkspacesPage', () => {
  it('shows the subscription status for each workspace', async () => {
    server.use(http.get(`${API_URL}/api/admin/workspaces`, () => HttpResponse.json(workspacesResponse('active'))))

    renderPage()

    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('shows a canceled workspace with a distinct destructive-styled badge', async () => {
    server.use(http.get(`${API_URL}/api/admin/workspaces`, () => HttpResponse.json(workspacesResponse('canceled'))))

    renderPage()

    const badge = await screen.findByText('Canceled')
    expect(badge.className).toMatch(/destructive/)
  })
})
