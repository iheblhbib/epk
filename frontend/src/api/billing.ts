import { apiClient } from '@/api/client'
import type { ApiResource, BillingData } from '@/types'

export async function getBilling(workspaceId: number): Promise<BillingData> {
  const { data } = await apiClient.get<ApiResource<BillingData>>(`/api/workspaces/${workspaceId}/billing`)
  return data.data
}
