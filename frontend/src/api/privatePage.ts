import { apiClient } from '@/api/client'
import type { AnalyticsEventType, ApiResource, PublicEpk } from '@/types'

export async function getPrivatePage(token: string): Promise<PublicEpk> {
  const { data } = await apiClient.get<ApiResource<PublicEpk>>(`/api/private/${token}`)
  return data.data
}

export async function verifyPrivatePagePassword(token: string, password: string): Promise<PublicEpk> {
  const { data } = await apiClient.post<ApiResource<PublicEpk>>(`/api/private/${token}/verify`, { password })
  return data.data
}

/** Fire-and-forget, same rationale as trackEvent() in api/publicEpk.ts. */
export function trackPrivateEvent(token: string, type: AnalyticsEventType, meta?: { filename?: string }): void {
  apiClient.post(`/api/private/${token}/events`, { type, meta }).catch(() => {
    // Intentionally ignored — a visitor's page view/download/play must
    // never fail (or even appear to fail) because analytics had trouble.
  })
}
