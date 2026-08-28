import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createArtist, deleteArtist, listArtists, updateArtist, type ArtistPayload } from '@/api/artists'

export const artistsKey = (workspaceId: number) => ['workspaces', workspaceId, 'artists'] as const

export function useArtists(workspaceId: number | undefined) {
  return useQuery({
    queryKey: artistsKey(workspaceId ?? 0),
    queryFn: () => listArtists(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

export function useCreateArtist(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ArtistPayload) => createArtist(workspaceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: artistsKey(workspaceId) }),
  })
}

export function useUpdateArtist(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ artistId, payload }: { artistId: number; payload: Partial<ArtistPayload> }) =>
      updateArtist(artistId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: artistsKey(workspaceId) }),
  })
}

export function useDeleteArtist(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteArtist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: artistsKey(workspaceId) }),
  })
}
