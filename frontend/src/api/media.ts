import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, Media, MediaType } from '@/types'

export interface MediaListParams {
  search?: string
  type?: MediaType
  sortBy?: 'created_at' | 'name' | 'size'
  sortDir?: 'asc' | 'desc'
}

export async function listMedia(workspaceId: number, params: MediaListParams = {}): Promise<Media[]> {
  const { data } = await apiClient.get<ApiCollection<Media>>(`/api/workspaces/${workspaceId}/media`, {
    params: {
      search: params.search || undefined,
      type: params.type || undefined,
      sort_by: params.sortBy,
      sort_dir: params.sortDir,
    },
  })
  return data.data
}

export async function uploadMedia(
  workspaceId: number,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<Media[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files[]', file))

  const { data } = await apiClient.post<ApiCollection<Media>>(
    `/api/workspaces/${workspaceId}/media`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    }
  )
  return data.data
}

export async function renameMedia(mediaId: number, originalFilename: string): Promise<Media> {
  const { data } = await apiClient.put<ApiResource<Media>>(`/api/media/${mediaId}`, {
    original_filename: originalFilename,
  })
  return data.data
}

export async function deleteMedia(mediaId: number): Promise<void> {
  await apiClient.delete(`/api/media/${mediaId}`)
}

export function mediaDownloadUrl(mediaId: number): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  return `${apiUrl}/api/media/${mediaId}/download`
}
