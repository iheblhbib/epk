import { apiClient } from '@/api/client'
import type { ApiResource, BillingData, SubscriptionPlan } from '@/types'

export async function getBilling(workspaceId: number): Promise<BillingData> {
  const { data } = await apiClient.get<ApiResource<BillingData>>(`/api/workspaces/${workspaceId}/billing`)
  return data.data
}

export async function createCheckoutSession(
  workspaceId: number,
  plan: Extract<SubscriptionPlan, 'pro' | 'business'>
): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/checkout`,
    { plan }
  )
  return data.data.url
}

export async function createPortalSession(workspaceId: number): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/portal`
  )
  return data.data.url
}
