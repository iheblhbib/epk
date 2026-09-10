import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BillingPage } from '@/features/billing/pages/BillingPage'
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

function billingResponse(overrides: Partial<BillingData> = {}) {
  return {
    data: {
      // A trialing workspace's `plan` is always 'starter' — see
      // Workspace::booted() on the backend, which grants every new
      // workspace a 14-day trial at Starter-tier limits and features.
      // "Currently subscribed" is derived from `subscription_status`, never
      // from `plan` alone — that conflation is what hid the BillingPage bug
      // this file also covers (a trialing workspace being unable to check
      // out into any plan because `plan` matched a card).
      plan: 'starter',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      billing_interval: null,
      current_period_ends_at: null,
      has_stripe_customer: false,
      usage: {
        epks: { used: 0, limit: 1 },
        team_members: { used: 1, limit: 2 },
        artists: { used: 0, limit: 1 },
        storage_bytes: { used: 0, limit: 150 * 1024 * 1024 },
      },
      plans: {
        starter: { plan: 'starter', label: 'Starter', max_epks: 1, max_storage_bytes: 150 * 1024 * 1024, max_team_members: 2, max_artists: 1, custom_themes: false, private_links: false, white_label: false, custom_domains: false },
        pro: { plan: 'pro', label: 'Pro', max_epks: 5, max_storage_bytes: 2 * 1024 * 1024 * 1024, max_team_members: 10, max_artists: 5, custom_themes: true, private_links: true, white_label: false, custom_domains: false },
        business: { plan: 'business', label: 'Business', max_epks: null, max_storage_bytes: 20 * 1024 * 1024 * 1024, max_team_members: null, max_artists: null, custom_themes: true, private_links: true, white_label: true, custom_domains: true },
      },
      ...overrides,
    },
  }
}

function mockWorkspace() {
  server.use(http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] })))
}

function renderBillingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing']}>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BillingPage', () => {
  it('shows a trial countdown banner while trialing', async () => {
    mockWorkspace()
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    expect(await screen.findByText(/5 days left/i)).toBeInTheDocument()
  })

  it('shows all three plan prices in monthly mode by default, and switches to yearly on toggle', async () => {
    mockWorkspace()
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    expect(await screen.findByText('€6.66')).toBeInTheDocument()
    expect(screen.getByText('€26.66')).toBeInTheDocument()
    expect(screen.getByText('€99.99')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: /yearly/i }))

    expect(await screen.findByText('€5.55')).toBeInTheDocument()
    expect(screen.getByText('€22.22')).toBeInTheDocument()
    expect(screen.getByText('€83.33')).toBeInTheDocument()
  })

  it('sends the selected interval when starting checkout', async () => {
    mockWorkspace()
    // jsdom doesn't implement navigation ("Not implemented: navigation to
    // another Document"), so BillingPage's `window.location.href = url` in
    // its checkout onSuccess never actually takes effect here — capture the
    // request body instead of asserting on window.location.href, the same
    // workaround the pre-existing BillingPage tests already relied on.
    let checkoutRequestBody: { plan: string; interval: string } | null = null
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())),
      http.post(`${API_URL}/api/workspaces/:id/billing/checkout`, async ({ request }) => {
        checkoutRequestBody = (await request.json()) as { plan: string; interval: string }
        return HttpResponse.json({ data: { url: 'https://checkout.stripe.com/fake' } })
      })
    )

    renderBillingPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /upgrade to pro/i }))

    await waitFor(() => expect(checkoutRequestBody).toEqual({ plan: 'pro', interval: 'monthly' }))
  })

  it('hides the trial banner once trial_ends_at has passed, even if status is still trialing', async () => {
    mockWorkspace()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () =>
        HttpResponse.json(
          billingResponse({ trial_ends_at: new Date(Date.now() - 60 * 1000).toISOString() })
        )
      )
    )

    renderBillingPage()

    await screen.findByText('Starter')
    expect(screen.queryByText(/left in your trial/i)).not.toBeInTheDocument()
  })

  it('scrolls to the plans section when the trial banner CTA is clicked', async () => {
    mockWorkspace()
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))
    const scrollIntoView = vi.fn()
    // jsdom doesn't implement scrollIntoView at all — stub it so the click
    // handler (document.getElementById('plans-section')?.scrollIntoView(...))
    // doesn't throw, and so we can assert it was actually invoked.
    Element.prototype.scrollIntoView = scrollIntoView

    renderBillingPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /choose a plan/i }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('shows no current-plan badge and offers an upgrade CTA on all three tiers (including Business) while trialing', async () => {
    mockWorkspace()
    // Default billingResponse() is plan: 'starter', subscription_status:
    // 'trialing' — the real shape of a never-subscribed workspace. Before
    // the fix, isCurrent was computed from `plan` alone, so a trialing
    // workspace showed a "Current plan" badge with no way to actually
    // check out into that tier.
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    await screen.findByText('Business')
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to starter/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to business/i })).toBeInTheDocument()
  })

  it('shows a current-plan badge and hides upgrade CTAs on tiers at or below the actually-subscribed plan', async () => {
    mockWorkspace()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () =>
        HttpResponse.json(billingResponse({ plan: 'pro', subscription_status: 'active', trial_ends_at: null }))
      )
    )

    renderBillingPage()

    expect(await screen.findByText('Current plan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade to starter/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to business/i })).toBeInTheDocument()
  })

  it('describes the workspace as on a free trial (not "on the Business plan") in the header while trialing', async () => {
    mockWorkspace()
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    expect(await screen.findByText(/free trial/i)).toBeInTheDocument()
    expect(screen.queryByText(/is on the business plan/i)).not.toBeInTheDocument()
  })

  it('names the actual subscribed plan in the header once out of trial', async () => {
    mockWorkspace()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () =>
        HttpResponse.json(billingResponse({ plan: 'pro', subscription_status: 'active', trial_ends_at: null }))
      )
    )

    renderBillingPage()

    expect(await screen.findByText(/is on the pro plan/i)).toBeInTheDocument()
  })

  it('shows a persistent locked-out banner for a canceled subscription', async () => {
    mockWorkspace()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () =>
        HttpResponse.json(billingResponse({ subscription_status: 'canceled', trial_ends_at: null }))
      )
    )

    renderBillingPage()

    expect(await screen.findByText(/choose a plan to keep using this workspace/i)).toBeInTheDocument()
  })

  it('shows a persistent locked-out banner once the trial has expired', async () => {
    mockWorkspace()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () =>
        HttpResponse.json(billingResponse({ trial_ends_at: new Date(Date.now() - 60 * 1000).toISOString() }))
      )
    )

    renderBillingPage()

    expect(await screen.findByText(/choose a plan to keep using this workspace/i)).toBeInTheDocument()
  })
})
