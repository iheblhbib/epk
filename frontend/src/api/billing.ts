import { apiClient } from '@/api/client'
import type { ApiResource, BillingData, BillingInvoice, SubscriptionPlan } from '@/types'

export async function getBilling(workspaceId: number): Promise<BillingData> {
  const { data } = await apiClient.get<ApiResource<BillingData>>(`/api/workspaces/${workspaceId}/billing`)
  return data.data
}

export interface InvoiceHistory {
  invoices: BillingInvoice[]
  // True when Stripe couldn't be reached -- distinct from a genuinely
  // empty history, so the UI can say "unavailable" instead of "no
  // invoices yet".
  unavailable: boolean
}

export async function getInvoices(workspaceId: number): Promise<InvoiceHistory> {
  const { data } = await apiClient.get<{ data: BillingInvoice[]; unavailable?: boolean }>(
    `/api/workspaces/${workspaceId}/billing/invoices`
  )
  return { invoices: data.data, unavailable: data.unavailable ?? false }
}

export type BillingInterval = 'monthly' | 'yearly'

export async function createCheckoutSession(
  workspaceId: number,
  plan: SubscriptionPlan,
  interval: BillingInterval
): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/checkout`,
    { plan, interval }
  )
  return data.data.url
}

export async function createPortalSession(workspaceId: number): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/portal`
  )
  return data.data.url
}
