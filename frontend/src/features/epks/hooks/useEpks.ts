import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEpk,
  deleteEpk,
  duplicateEpk,
  getEpk,
  listEpks,
  publishEpk,
  unpublishEpk,
  updateEpk,
  type CreateEpkPayload,
  type UpdateEpkPayload,
} from '@/api/epks'

export const epksKey = (workspaceId: number) => ['workspaces', workspaceId, 'epks'] as const
export const epkKey = (epkId: number) => ['epks', epkId] as const

export function useEpks(workspaceId: number | undefined) {
  return useQuery({
    queryKey: epksKey(workspaceId ?? 0),
    queryFn: () => listEpks(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

export function useEpk(epkId: number | undefined) {
  return useQuery({
    queryKey: epkKey(epkId ?? 0),
    queryFn: () => getEpk(epkId as number),
    enabled: epkId !== undefined,
  })
}

export function useCreateEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateEpkPayload) => createEpk(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}

export function useUpdateEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ epkId, payload }: { epkId: number; payload: UpdateEpkPayload }) =>
      updateEpk(epkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}

export function useDeleteEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEpk,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}

export function useDuplicateEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: duplicateEpk,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}

export function usePublishEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: publishEpk,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}

export function useUnpublishEpk(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unpublishEpk,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: epksKey(workspaceId) }),
  })
}
