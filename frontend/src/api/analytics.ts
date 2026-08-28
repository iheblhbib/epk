import { apiClient } from '@/api/client'
import type { AnalyticsSummary, ApiResource } from '@/types'

export async function getEpkAnalytics(epkId: number, range?: { from?: string; to?: string }): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<ApiResource<AnalyticsSummary>>(`/api/epks/${epkId}/analytics`, {
    params: range,
  })
  return data.data
}
