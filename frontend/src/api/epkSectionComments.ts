import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, EpkSectionComment } from '@/types'

export async function listSectionComments(epkId: number, sectionId: number): Promise<EpkSectionComment[]> {
  const { data } = await apiClient.get<ApiCollection<EpkSectionComment>>(
    `/api/epks/${epkId}/sections/${sectionId}/comments`
  )
  return data.data
}

export async function addSectionComment(epkId: number, sectionId: number, body: string): Promise<EpkSectionComment> {
  const { data } = await apiClient.post<ApiResource<EpkSectionComment>>(
    `/api/epks/${epkId}/sections/${sectionId}/comments`,
    { body }
  )
  return data.data
}

export async function updateSectionComment(
  epkId: number,
  sectionId: number,
  commentId: number,
  body: string
): Promise<EpkSectionComment> {
  const { data } = await apiClient.put<ApiResource<EpkSectionComment>>(
    `/api/epks/${epkId}/sections/${sectionId}/comments/${commentId}`,
    { body }
  )
  return data.data
}

export async function deleteSectionComment(epkId: number, sectionId: number, commentId: number): Promise<void> {
  await apiClient.delete(`/api/epks/${epkId}/sections/${sectionId}/comments/${commentId}`)
}
