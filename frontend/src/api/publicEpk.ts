import { apiClient } from '@/api/client'
import type { AnalyticsEventType, ApiResource, PublicEpk } from '@/types'

export async function getPublicEpk(slug: string): Promise<PublicEpk> {
  const { data } = await apiClient.get<ApiResource<PublicEpk>>(`/api/public/epks/${slug}`)
  return data.data
}

export async function getPublicEpkByDomain(domain: string): Promise<PublicEpk> {
  const { data } = await apiClient.get<ApiResource<PublicEpk>>('/api/public/epks/by-domain', {
    params: { domain },
  })
  return data.data
}

export function publicEpkPdfUrl(slug: string): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  return `${apiUrl}/api/public/epks/${slug}/pdf`
}

/**
 * Fire-and-forget: a visitor's page view/download/play must never fail (or
 * even appear to fail) because analytics reporting had trouble — errors are
 * swallowed here rather than surfaced to the caller.
 */
export function trackEvent(slug: string, type: AnalyticsEventType, meta?: { filename?: string }): void {
  apiClient.post(`/api/public/epks/${slug}/events`, { type, meta }).catch(() => {
    // Intentionally ignored — see above.
  })
}
