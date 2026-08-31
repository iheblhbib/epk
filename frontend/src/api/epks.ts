import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, CustomDomainSetup, Epk } from '@/types'

export interface CreateEpkPayload {
  workspace_id: number
  artist_id: number
  title: string
  seo_title?: string
  seo_description?: string
}

export interface UpdateEpkPayload {
  artist_id?: number
  title?: string
  theme?: string
  custom_settings?: Record<string, unknown>
  seo_title?: string
  seo_description?: string
}

export async function listEpks(workspaceId: number): Promise<Epk[]> {
  const { data } = await apiClient.get<ApiCollection<Epk>>('/api/epks', {
    params: { workspace_id: workspaceId },
  })
  return data.data
}

export async function getEpk(epkId: number): Promise<Epk> {
  const { data } = await apiClient.get<ApiResource<Epk>>(`/api/epks/${epkId}`)
  return data.data
}

export async function createEpk(payload: CreateEpkPayload): Promise<Epk> {
  const { data } = await apiClient.post<ApiResource<Epk>>('/api/epks', payload)
  return data.data
}

export async function updateEpk(epkId: number, payload: UpdateEpkPayload): Promise<Epk> {
  const { data } = await apiClient.put<ApiResource<Epk>>(`/api/epks/${epkId}`, payload)
  return data.data
}

export async function deleteEpk(epkId: number): Promise<void> {
  await apiClient.delete(`/api/epks/${epkId}`)
}

export async function duplicateEpk(epkId: number): Promise<Epk> {
  const { data } = await apiClient.post<ApiResource<Epk>>(`/api/epks/${epkId}/duplicate`)
  return data.data
}

export async function publishEpk(epkId: number): Promise<Epk> {
  const { data } = await apiClient.post<ApiResource<Epk>>(`/api/epks/${epkId}/publish`)
  return data.data
}

export async function unpublishEpk(epkId: number): Promise<Epk> {
  const { data } = await apiClient.post<ApiResource<Epk>>(`/api/epks/${epkId}/unpublish`)
  return data.data
}

export function epkPdfUrl(epkId: number): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  return `${apiUrl}/api/epks/${epkId}/pdf`
}

export async function getEpkCustomDomain(epkId: number): Promise<CustomDomainSetup | null> {
  const { data } = await apiClient.get<ApiResource<CustomDomainSetup | null>>(`/api/epks/${epkId}/custom-domain`)
  return data.data
}

export async function setEpkCustomDomain(epkId: number, domain: string): Promise<CustomDomainSetup> {
  const { data } = await apiClient.post<ApiResource<CustomDomainSetup>>(`/api/epks/${epkId}/custom-domain`, { domain })
  return data.data
}

export async function verifyEpkCustomDomain(epkId: number): Promise<CustomDomainSetup> {
  const { data } = await apiClient.post<ApiResource<CustomDomainSetup>>(`/api/epks/${epkId}/custom-domain/verify`)
  return data.data
}

export async function removeEpkCustomDomain(epkId: number): Promise<void> {
  await apiClient.delete(`/api/epks/${epkId}/custom-domain`)
}
