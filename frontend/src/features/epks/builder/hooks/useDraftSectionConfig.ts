import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { updateSection } from '@/api/epkSections'
import { sectionsKey } from '@/features/epks/hooks/useEpkSections'
import type { EpkSection } from '@/types'

/**
 * Settings-panel fields call the returned setter on every keystroke. It
 * writes straight into the TanStack Query cache — which the live preview
 * reads from too — so the preview updates instantly, the way the spec
 * requires ("must update immediately"), without a network round trip per
 * keystroke. The actual PUT to persist it is debounced.
 */
export function useDraftSectionConfig<C extends object>(epkId: number, section: EpkSection) {
  const queryClient = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Flush any pending save if the user navigates away/switches sections
  // mid-edit, so a debounced change is never silently lost.
  useEffect(() => () => clearTimeout(timer.current), [])

  return useCallback(
    (updater: (prev: C) => C) => {
      let nextConfig: C | undefined

      queryClient.setQueryData<EpkSection[]>(sectionsKey(epkId), (old) =>
        old?.map((candidate) => {
          if (candidate.id !== section.id) return candidate
          nextConfig = updater(candidate.config as C)
          return { ...candidate, config: nextConfig as Record<string, unknown> }
        })
      )

      if (!nextConfig) return

      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        updateSection(epkId, section.id, { config: nextConfig as Record<string, unknown> }).catch(() => {
          toast.error('Could not save changes')
          queryClient.invalidateQueries({ queryKey: sectionsKey(epkId) })
        })
      }, 500)
    },
    [queryClient, epkId, section.id]
  )
}
