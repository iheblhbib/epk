import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, EpkSection, SectionType } from '@/types'

export async function listSections(epkId: number): Promise<EpkSection[]> {
  const { data } = await apiClient.get<ApiCollection<EpkSection>>(`/api/epks/${epkId}/sections`)
  return data.data
}

export async function addSection(epkId: number, type: SectionType, title?: string): Promise<EpkSection> {
  const { data } = await apiClient.post<ApiResource<EpkSection>>(`/api/epks/${epkId}/sections`, {
    type,
    title,
  })
  return data.data
}

export interface UpdateSectionPayload {
  title?: string | null
  is_enabled?: boolean
  config?: Record<string, unknown>
}

export async function updateSection(
  epkId: number,
  sectionId: number,
  payload: UpdateSectionPayload
): Promise<EpkSection> {
  const { data } = await apiClient.put<ApiResource<EpkSection>>(
    `/api/epks/${epkId}/sections/${sectionId}`,
    payload
  )
  return data.data
}

export async function deleteSection(epkId: number, sectionId: number): Promise<void> {
  await apiClient.delete(`/api/epks/${epkId}/sections/${sectionId}`)
}

export async function duplicateSection(epkId: number, sectionId: number): Promise<EpkSection> {
  const { data } = await apiClient.post<ApiResource<EpkSection>>(
    `/api/epks/${epkId}/sections/${sectionId}/duplicate`
  )
  return data.data
}

export async function reorderSections(epkId: number, sectionIds: number[]): Promise<EpkSection[]> {
  const { data } = await apiClient.put<ApiCollection<EpkSection>>(`/api/epks/${epkId}/sections/reorder`, {
    section_ids: sectionIds,
  })
  return data.data
}
