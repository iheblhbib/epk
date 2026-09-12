import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { useDeclineInvitation, usePendingInvitations } from '@/features/workspaces/hooks/useWorkspaces'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('usePendingInvitations', () => {
  it('fetches the list of pending invitations', async () => {
    server.use(
      http.get(`${API_URL}/api/invitations`, () =>
        HttpResponse.json({
          data: [
            { token: 'abc123', workspace: { id: 1, name: 'Acme Records' }, role: 'editor', invited_by: 'Ada Lovelace', created_at: '2026-09-01T00:00:00.000000Z' },
          ],
        })
      )
    )

    const { result } = renderHook(() => usePendingInvitations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].workspace.name).toBe('Acme Records')
  })
})

describe('useDeclineInvitation', () => {
  it('calls the decline endpoint with the token', async () => {
    server.use(http.delete(`${API_URL}/api/invitations/abc123`, () => new HttpResponse(null, { status: 204 })))

    const { result } = renderHook(() => useDeclineInvitation(), { wrapper })

    result.current.mutate('abc123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
