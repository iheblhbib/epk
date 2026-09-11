import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DashboardHome } from '@/pages/DashboardHome'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'
import type { AppNotification } from '@/types'

const API_URL = 'http://localhost:8000'

const workspace = {
  id: 1,
  name: 'Acme Records',
  slug: 'acme-records',
  description: null,
  logo_url: null,
  my_role: 'owner',
  members_count: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

const epk = {
  id: 7,
  title: 'Summer Tour EPK',
  status: 'published',
  slug: 'summer-tour',
  workspace_id: 1,
  artist_id: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

function analyticsResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      from: '2026-08-12',
      to: '2026-09-10',
      totals: { page_views: 42, unique_visitors: 30, downloads: 5, audio_plays: 0, video_plays: 0 },
      daily_page_views: [{ date: '2026-09-10', count: 42 }],
      top_referrers: [],
      top_countries: [],
      devices: [],
      top_downloads: [],
      top_private_links: [],
      top_epk: { id: 7, title: 'Summer Tour EPK', views: 42 },
      ...overrides,
    },
  }
}

function activityResponse(notifications: AppNotification[] = []) {
  return { data: notifications, meta: { current_page: 1, last_page: 1, total: notifications.length } }
}

function mockBaseline() {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] })),
    http.get(`${API_URL}/api/epks`, () => HttpResponse.json({ data: [epk] }))
  )
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <DashboardHome />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardHome', () => {
  it('shows real total views and downloads instead of the old hardcoded zeros', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows the top-performing EPK callout when one exists', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('Summer Tour EPK')).toBeInTheDocument()
  })

  it('hides the top-performing EPK callout when there is no traffic yet', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () =>
        HttpResponse.json(analyticsResponse({ top_epk: null }))
      ),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    await screen.findByText('42') // wait for load
    expect(screen.queryByText('Summer Tour EPK')).not.toBeInTheDocument()
  })

  it('shows recent activity notifications for this workspace', async () => {
    mockBaseline()
    const notification: AppNotification = {
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      kind: 'view_milestone',
      payload: { kind: 'view_milestone', epk_id: 7, epk_title: 'Summer Tour EPK', workspace_id: 1, milestone: 1000 },
      read_at: null,
      created_at: new Date().toISOString(),
    }
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse([notification])))
    )

    renderDashboard()

    // i18next's default interpolation does no thousands-grouping (no
    // custom number formatter is registered in src/i18n/index.ts), so
    // {{count}} in viewMilestoneBlurb renders the raw number, "1000", not
    // "1,000".
    expect(await screen.findByText(/1000/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no recent activity', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('No recent activity yet.')).toBeInTheDocument()
  })
})
