import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSection,
  deleteSection,
  duplicateSection,
  listSections,
  reorderSections,
  updateSection,
  type UpdateSectionPayload,
} from '@/api/epkSections'
import type { EpkSection, SectionType } from '@/types'

export const sectionsKey = (epkId: number) => ['epks', epkId, 'sections'] as const

export function useSections(epkId: number | undefined) {
  return useQuery({
    queryKey: sectionsKey(epkId ?? 0),
    queryFn: () => listSections(epkId as number),
    enabled: epkId !== undefined,
  })
}

export function useAddSection(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ type, title }: { type: SectionType; title?: string }) => addSection(epkId, type, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionsKey(epkId) }),
  })
}

export function useUpdateSection(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sectionId, payload }: { sectionId: number; payload: UpdateSectionPayload }) =>
      updateSection(epkId, sectionId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionsKey(epkId) }),
  })
}

export function useDeleteSection(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sectionId: number) => deleteSection(epkId, sectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionsKey(epkId) }),
  })
}

export function useDuplicateSection(epkId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sectionId: number) => duplicateSection(epkId, sectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionsKey(epkId) }),
  })
}

export function useReorderSections(epkId: number) {
  const queryClient = useQueryClient()
  const key = sectionsKey(epkId)

  return useMutation({
    mutationFn: (sectionIds: number[]) => reorderSections(epkId, sectionIds),
    // Optimistic: apply the new order to the cache immediately so drag-and-drop
    // feels instant, rather than waiting on the round trip.
    onMutate: async (sectionIds) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<EpkSection[]>(key)

      if (previous) {
        const byId = new Map(previous.map((section) => [section.id, section]))
        const reordered = sectionIds
          .map((id, index) => {
            const section = byId.get(id)
            return section ? { ...section, position: index } : null
          })
          .filter((section): section is EpkSection => section !== null)

        queryClient.setQueryData(key, reordered)
      }

      return { previous }
    },
    onError: (_error, _sectionIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
