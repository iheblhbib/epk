import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, PrivateLink } from '@/types'

export interface CreatePrivateLinkPayload {
  label?: string | null
  password?: string | null
  expires_at?: string | null
}

export interface UpdatePrivateLinkPayload {
  label?: string | null
  password?: string | null
  expires_at?: string | null
  revoked?: boolean
}

export async function listPrivateLinks(epkId: number): Promise<PrivateLink[]> {
  const { data } = await apiClient.get<ApiCollection<PrivateLink>>(`/api/epks/${epkId}/private-links`)
  return data.data
}

export async function createPrivateLink(epkId: number, payload: CreatePrivateLinkPayload): Promise<PrivateLink> {
  const { data } = await apiClient.post<ApiResource<PrivateLink>>(`/api/epks/${epkId}/private-links`, payload)
  return data.data
}

export async function updatePrivateLink(
  epkId: number,
  linkId: number,
  payload: UpdatePrivateLinkPayload
): Promise<PrivateLink> {
  const { data } = await apiClient.put<ApiResource<PrivateLink>>(`/api/epks/${epkId}/private-links/${linkId}`, payload)
  return data.data
}

export async function deletePrivateLink(epkId: number, linkId: number): Promise<void> {
  await apiClient.delete(`/api/epks/${epkId}/private-links/${linkId}`)
}
