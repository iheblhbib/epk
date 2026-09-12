import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function statsResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      users: { total: 42, new_last_7_days: 3, new_last_30_days: 10 },
      workspaces: { total: 20 },
      epks: { total: 30, published: 15, draft: 10, archived: 5 },
      media: { total: 100, storage_bytes: 1024 },
      contacts: { total: 50 },
      analytics: { total_page_views: 500, page_views_last_30_days: 200 },
      billing: {
        mrr: 48.88,
        active_by_plan: { starter: 1, pro: 2, business: 0 },
        by_status: { trialing: 5, active: 3, past_due: 0, unpaid: 0, canceled: 1 },
        trial_conversion_rate: 33.3,
        canceled_last_30_days: 1,
      },
      growth: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
        new_users: i === 29 ? 2 : 0,
        new_workspaces: i === 29 ? 1 : 0,
      })),
      ...overrides,
    },
  }
}

function activityResponse() {
  return {
    data: [
      { kind: 'user_signed_up', label: 'Ada Lovelace', detail: 'ada@example.com', created_at: new Date().toISOString() },
      { kind: 'workspace_created', label: 'Acme Records', detail: 'Ada Lovelace', created_at: new Date().toISOString() },
    ],
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboardPage />
    </QueryClientProvider>
  )
}

describe('AdminDashboardPage', () => {
  it('shows MRR, trial conversion rate, and cancellations', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    expect(await screen.findByText('€48.88')).toBeInTheDocument()
    expect(screen.getByText('33.3%')).toBeInTheDocument()
  })

  it('shows the active-by-plan breakdown', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    await screen.findByText('€48.88')
    expect(screen.getByText('Starter')).toBeInTheDocument()
  })

  it('shows recent activity entries for both signups and workspace creations', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    // Regexes scoped tightly enough not to collide: activityResponse()'s
    // "Ada Lovelace" appears in BOTH rows (once as the signup label, once
    // as the workspace's creator name), so a bare /Ada Lovelace/ matches
    // two elements and findByText throws "found multiple elements" --
    // match each row's full, distinguishing sentence instead.
    expect(await screen.findByText(/Ada Lovelace signed up/)).toBeInTheDocument()
    expect(await screen.findByText(/Acme Records/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no recent activity', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json({ data: [] }))
    )

    renderPage()

    await screen.findByText('€48.88')
    expect(await screen.findByText(/No recent activity/i)).toBeInTheDocument()
  })

  it('shows an error message when activity fetch fails', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.error())
    )

    renderPage()

    await screen.findByText('€48.88')
    expect(await screen.findByText(/Couldn't load recent activity/i)).toBeInTheDocument()
  })
})
