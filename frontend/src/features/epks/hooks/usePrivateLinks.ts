import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPrivateLink,
  deletePrivateLink,
  listPrivateLinks,
  updatePrivateLink,
  type CreatePrivateLinkPayload,
  type UpdatePrivateLinkPayload,
} from '@/api/privateLinks'

export const privateLinksKey = (epkId: number) => ['epks', epkId, 'private-links'] as const

export function usePrivateLinks(epkId: number | undefined) {
  return useQuery({
    queryKey: privateLinksKey(epkId ?? 0),
    queryFn: () => listPrivateLinks(epkId as number),
    enabled: epkId !== undefined,
  })
}

export function useCreatePrivateLink(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePrivateLinkPayload) => createPrivateLink(epkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: privateLinksKey(epkId) }),
  })
}

export function useUpdatePrivateLink(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ linkId, payload }: { linkId: number; payload: UpdatePrivateLinkPayload }) =>
      updatePrivateLink(epkId, linkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: privateLinksKey(epkId) }),
  })
}

export function useDeletePrivateLink(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (linkId: number) => deletePrivateLink(epkId, linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: privateLinksKey(epkId) }),
  })
}
