import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteMedia,
  listMedia,
  renameMedia,
  uploadMedia,
  type MediaListParams,
} from '@/api/media'

export const mediaKey = (workspaceId: number, params: MediaListParams = {}) =>
  ['workspaces', workspaceId, 'media', params] as const

export function useMediaList(workspaceId: number | undefined, params: MediaListParams = {}) {
  return useQuery({
    queryKey: mediaKey(workspaceId ?? 0, params),
    queryFn: () => listMedia(workspaceId as number, params),
    enabled: workspaceId !== undefined,
  })
}

export function useUploadMedia(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress?: (percent: number) => void }) =>
      uploadMedia(workspaceId, files, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'media'] }),
  })
}

export function useRenameMedia(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ mediaId, name }: { mediaId: number; name: string }) => renameMedia(mediaId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'media'] }),
  })
}

export function useDeleteMedia(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'media'] }),
  })
}
