import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSectionComment,
  deleteSectionComment,
  listSectionComments,
  updateSectionComment,
} from '@/api/epkSectionComments'

export const sectionCommentsKey = (epkId: number, sectionId: number) =>
  ['epks', epkId, 'sections', sectionId, 'comments'] as const

export function useSectionComments(epkId: number, sectionId: number | null) {
  return useQuery({
    queryKey: sectionCommentsKey(epkId, sectionId ?? 0),
    queryFn: () => listSectionComments(epkId, sectionId as number),
    enabled: sectionId !== null,
  })
}

export function useAddSectionComment(epkId: number, sectionId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => addSectionComment(epkId, sectionId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionCommentsKey(epkId, sectionId) }),
  })
}

export function useUpdateSectionComment(epkId: number, sectionId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      updateSectionComment(epkId, sectionId, commentId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionCommentsKey(epkId, sectionId) }),
  })
}

export function useDeleteSectionComment(epkId: number, sectionId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: number) => deleteSectionComment(epkId, sectionId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionCommentsKey(epkId, sectionId) }),
  })
}
