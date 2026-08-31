import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, ApiToken, CreatedApiToken } from '@/types'

export async function listApiTokens(): Promise<ApiToken[]> {
  const { data } = await apiClient.get<ApiCollection<ApiToken>>('/api/user/api-tokens')
  return data.data
}

export async function createApiToken(name: string): Promise<CreatedApiToken> {
  const { data } = await apiClient.post<ApiResource<CreatedApiToken>>('/api/user/api-tokens', { name })
  return data.data
}

export async function revokeApiToken(id: number): Promise<void> {
  await apiClient.delete(`/api/user/api-tokens/${id}`)
}
