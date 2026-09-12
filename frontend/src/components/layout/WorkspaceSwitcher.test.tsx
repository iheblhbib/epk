import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const workspaces = [
  { id: 1, name: 'Acme Records', slug: 'acme', description: null, logo_url: null, my_role: 'owner', members_count: 3, created_at: '', updated_at: '' },
  { id: 2, name: 'Beta Label', slug: 'beta', description: null, logo_url: null, my_role: 'editor', members_count: 2, created_at: '', updated_at: '' },
]

function mockBaseline(overrides: { invitations?: unknown[] } = {}) {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: workspaces })),
    http.get(`${API_URL}/api/invitations`, () => HttpResponse.json({ data: overrides.invitations ?? [] }))
  )
}

function renderSwitcher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkspaceSwitcher />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WorkspaceSwitcher', () => {
  it('shows a role badge for each workspace', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(await screen.findByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('does not show a search input at 2 workspaces', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
  })

  it('shows and filters a search input at more than 5 workspaces', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Workspace ${i + 1}`,
      slug: `ws-${i + 1}`,
      description: null,
      logo_url: null,
      my_role: 'owner',
      members_count: 1,
      created_at: '',
      updated_at: '',
    }))
    server.use(
      http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: many })),
      http.get(`${API_URL}/api/invitations`, () => HttpResponse.json({ data: [] }))
    )
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /workspace 1/i }))
    const search = await screen.findByPlaceholderText(/search/i)

    await user.type(search, 'Workspace 3')

    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Workspace 3')).toBeInTheDocument()
    expect(within(menu).queryByText('Workspace 1')).not.toBeInTheDocument()
  })

  it('shows a pending invitation with working accept and decline', async () => {
    mockBaseline({
      invitations: [
        { token: 'tok-1', workspace: { id: 9, name: 'Gamma Studio' }, role: 'viewer', invited_by: 'Ada Lovelace', created_at: '2026-09-01T00:00:00.000000Z' },
      ],
    })
    let declineCalled = false
    server.use(
      http.delete(`${API_URL}/api/invitations/tok-1`, () => {
        declineCalled = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(await screen.findByText(/Gamma Studio/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /decline/i }))

    await waitFor(() => expect(declineCalled).toBe(true))
  })

  it('renders no pending-invitations section when there are none', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(screen.queryByText(/invited/i)).not.toBeInTheDocument()
  })

  it('opens a confirm dialog for leave-workspace without switching or closing the dropdown menu item', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))
    const leaveButtons = await screen.findAllByRole('button', { name: /leave/i })
    await user.click(leaveButtons[1]) // Beta Label's leave button

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Leave workspace?')).toBeInTheDocument()
    expect(within(dialog).getByText(/beta label/i)).toBeInTheDocument()
  })

  it('navigates to /settings when the settings item is clicked', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))
    await user.click(await screen.findByRole('menuitem', { name: /settings/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })
})
