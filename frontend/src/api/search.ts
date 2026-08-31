import { apiClient } from '@/api/client'
import type { ApiResource, GlobalSearchResults } from '@/types'

export async function searchWorkspace(workspaceId: number, query: string): Promise<GlobalSearchResults> {
  const { data } = await apiClient.get<ApiResource<GlobalSearchResults>>(`/api/workspaces/${workspaceId}/search`, {
    params: { q: query },
  })
  return data.data
}
