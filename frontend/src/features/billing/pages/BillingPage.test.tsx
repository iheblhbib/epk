import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BillingPage } from '@/features/billing/pages/BillingPage'
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

function billingResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      plan: 'starter',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      billing_interval: null,
      current_period_ends_at: null,
      has_stripe_customer: false,
      usage: {
        epks: { used: 0, limit: 3 },
        team_members: { used: 1, limit: 2 },
        storage_bytes: { used: 0, limit: 150 * 1024 * 1024 },
      },
      plans: {
        starter: { plan: 'starter', label: 'Starter', max_epks: 3, max_storage_bytes: 150 * 1024 * 1024, max_team_members: 2, custom_themes: false, private_links: false, white_label: false, custom_domains: false },
        pro: { plan: 'pro', label: 'Pro', max_epks: 10, max_storage_bytes: 2 * 1024 * 1024 * 1024, max_team_members: 10, custom_themes: true, private_links: true, white_label: false, custom_domains: false },
        business: { plan: 'business', label: 'Business', max_epks: null, max_storage_bytes: 20 * 1024 * 1024 * 1024, max_team_members: null, custom_themes: true, private_links: true, white_label: true, custom_domains: true },
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
})
