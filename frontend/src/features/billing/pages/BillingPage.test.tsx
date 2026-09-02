import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { BillingPage } from '@/features/billing/pages/BillingPage'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'
import type { BillingData } from '@/types'

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

function billingData(overrides: Partial<BillingData> = {}): BillingData {
  return {
    plan: 'free',
    subscription_status: 'active',
    current_period_ends_at: null,
    has_stripe_customer: false,
    usage: {
      epks: { used: 0, limit: 1 },
      team_members: { used: 1, limit: 2 },
      storage_bytes: { used: 0, limit: 500 * 1024 * 1024 },
    },
    plans: {
      free: { plan: 'free', label: 'Free', max_epks: 1, max_storage_bytes: 500 * 1024 * 1024, max_team_members: 2, custom_themes: false, private_links: false, white_label: false, custom_domains: false },
      pro: { plan: 'pro', label: 'Pro', max_epks: 10, max_storage_bytes: 10 * 1024 * 1024 * 1024, max_team_members: 10, custom_themes: true, private_links: true, white_label: false, custom_domains: false },
      business: { plan: 'business', label: 'Business', max_epks: null, max_storage_bytes: 100 * 1024 * 1024 * 1024, max_team_members: null, custom_themes: true, private_links: true, white_label: true, custom_domains: true },
    },
    ...overrides,
  }
}

function mockSignedIn() {
  server.use(
    http.get(`${API_URL}/api/user`, () =>
      HttpResponse.json({
        data: { id: 1, name: 'Ada', email: 'ada@example.com', role: 'user', email_verified_at: '2026-01-01T00:00:00.000000Z' },
      })
    ),
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] }))
  )
}

function renderBillingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing']}>
        <AuthProvider>
          <BillingPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BillingPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('starts a Stripe Checkout session when upgrading to a paid plan', async () => {
    mockSignedIn()
    let checkoutRequestedPlan: string | null = null
    server.use(
      http.get(`${API_URL}/api/workspaces/1/billing`, () => HttpResponse.json({ data: billingData() })),
      http.post(`${API_URL}/api/workspaces/1/billing/checkout`, async ({ request }) => {
        const body = (await request.json()) as { plan: string }
        checkoutRequestedPlan = body.plan
        return HttpResponse.json({ data: { url: 'https://checkout.stripe.com/fake' } })
      })
    )

    const user = userEvent.setup()
    renderBillingPage()

    const upgradeButtons = await screen.findAllByText(/Upgrade to Pro/i)
    await user.click(upgradeButtons[0])

    // The actual browser redirect (window.location.href = url, in
    // BillingPage's onSuccess) isn't asserted here — jsdom's window.location
    // resists being safely stubbed and restored across tests, and the
    // meaningful behavior is which plan Checkout was started for, not the
    // one-line browser API call that follows it.
    await waitFor(() => expect(checkoutRequestedPlan).toBe('pro'))
  })

  it('shows a past-due warning banner when the subscription payment failed', async () => {
    mockSignedIn()
    server.use(
      http.get(`${API_URL}/api/workspaces/1/billing`, () =>
        HttpResponse.json({ data: billingData({ plan: 'pro', subscription_status: 'past_due', has_stripe_customer: true }) })
      )
    )

    renderBillingPage()

    expect(await screen.findByText(/Your last payment failed/i)).toBeInTheDocument()
  })

  it('only shows "Manage billing" once the workspace has a Stripe customer', async () => {
    mockSignedIn()
    server.use(
      http.get(`${API_URL}/api/workspaces/1/billing`, () => HttpResponse.json({ data: billingData({ has_stripe_customer: false }) }))
    )

    renderBillingPage()

    await screen.findByText('Billing')
    expect(screen.queryByText('Manage billing')).not.toBeInTheDocument()
  })
})
