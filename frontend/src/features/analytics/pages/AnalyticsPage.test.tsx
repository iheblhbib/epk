import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage'
import { server } from '@/test/server'

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

function analyticsResponse() {
  return {
    data: {
      from: '2026-08-12',
      to: '2026-09-10',
      totals: { page_views: 42, unique_visitors: 30, downloads: 5, audio_plays: 0, video_plays: 0 },
      daily_page_views: [{ date: '2026-09-10', count: 42 }],
      top_referrers: [{ referrer: 'google.com', count: 12 }],
      top_countries: [{ country: 'US', count: 20 }],
      devices: [{ device_type: 'desktop', count: 10 }],
      top_downloads: [{ filename: 'press-kit.pdf', count: 6 }],
      top_private_links: [{ label: 'VIP link', count: 3 }],
    },
  }
}

function renderPage() {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] })),
    http.get(`${API_URL}/api/epks`, () => HttpResponse.json({ data: [epk] })),
    http.get(`${API_URL}/api/epks/7/analytics`, () => HttpResponse.json(analyticsResponse()))
  )

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  it('renders the country map, device donut, and ranking bar charts once data loads', async () => {
    const { container } = renderPage()

    await screen.findByText('Top referrers')
    expect(screen.getByText('Top countries')).toBeInTheDocument()
    expect(screen.getByText('Devices')).toBeInTheDocument()
    expect(screen.getByText('Top downloads')).toBeInTheDocument()
    expect(screen.getByText('Top private links')).toBeInTheDocument()

    // 5 charts (PageViewsChart + the 4 new canvas-based cards; the map also renders via <canvas>).
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(5)
  })
})
