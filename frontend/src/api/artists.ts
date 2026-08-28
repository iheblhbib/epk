import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, Artist } from '@/types'

export interface ArtistPayload {
  name: string
  stage_name?: string
  short_bio?: string
  country?: string
  city?: string
  genre?: string
  website?: string
  booking_email?: string
  press_email?: string
  management_email?: string
}

export async function listArtists(workspaceId: number): Promise<Artist[]> {
  const { data } = await apiClient.get<ApiCollection<Artist>>(`/api/workspaces/${workspaceId}/artists`)
  return data.data
}

export async function createArtist(workspaceId: number, payload: ArtistPayload): Promise<Artist> {
  const { data } = await apiClient.post<ApiResource<Artist>>(
    `/api/workspaces/${workspaceId}/artists`,
    payload
  )
  return data.data
}

export async function updateArtist(artistId: number, payload: Partial<ArtistPayload>): Promise<Artist> {
  const { data } = await apiClient.put<ApiResource<Artist>>(`/api/artists/${artistId}`, payload)
  return data.data
}

export async function deleteArtist(artistId: number): Promise<void> {
  await apiClient.delete(`/api/artists/${artistId}`)
}
