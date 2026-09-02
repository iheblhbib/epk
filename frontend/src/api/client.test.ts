import { describe, expect, it, vi } from 'vitest'
import { HttpResponse, http } from 'msw'
import { apiClient, registerSubscriptionLockedHandler } from '@/api/client'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

describe('apiClient 402 handling', () => {
  it('calls the registered handler when a request comes back 402', async () => {
    server.use(http.get(`${API_URL}/api/workspaces/1`, () => HttpResponse.json({ message: 'locked' }, { status: 402 })))

    const handler = vi.fn()
    registerSubscriptionLockedHandler(handler)

    await expect(apiClient.get('/api/workspaces/1')).rejects.toThrow()
    expect(handler).toHaveBeenCalledOnce()
  })
})
