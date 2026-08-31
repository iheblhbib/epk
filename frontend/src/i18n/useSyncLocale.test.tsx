import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { useSyncLocale } from '@/i18n/useSyncLocale'
import { AuthProvider } from '@/providers/AuthProvider'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function TestHarness() {
  useSyncLocale()
  return null
}

function renderWithUser(locale: string) {
  server.use(
    http.get(`${API_URL}/api/user`, () =>
      HttpResponse.json({
        data: {
          id: 1,
          name: 'Ada',
          email: 'ada@example.com',
          role: 'user',
          locale,
          email_verified_at: '2026-01-01T00:00:00.000000Z',
        },
      })
    )
  )

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('useSyncLocale', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it("switches the app language to the signed-in user's saved locale", async () => {
    renderWithUser('fr')

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('fr'))
  })

  it('sets dir="rtl" and lang="ar" on <html> for Arabic, and flips back for an LTR language', async () => {
    renderWithUser('ar')

    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
    expect(document.documentElement.lang).toBe('ar')

    await i18n.changeLanguage('en')
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'))
  })
})
