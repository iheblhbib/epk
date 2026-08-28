import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { updateEpk } from '@/api/epks'
import { epkKey } from '@/features/epks/hooks/useEpks'
import type { EpkCustomSettings, ThemePreset } from '@/lib/epkThemes'
import type { Epk } from '@/types'

/**
 * Same instant-cache-write + debounced-PUT mechanism as
 * useDraftSectionConfig, but for the EPK's own theme/custom_settings fields
 * rather than a section's config — so the live preview (which reads the EPK
 * straight from this same cache entry) reflects theme edits immediately too.
 */
export function useDraftEpkTheme(epkId: number) {
  const queryClient = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const setTheme = useCallback(
    (preset: ThemePreset) => {
      queryClient.setQueryData<Epk>(epkKey(epkId), (old) => (old ? { ...old, theme: preset } : old))
      clearTimeout(timer.current)
      updateEpk(epkId, { theme: preset }).catch(() => {
        toast.error('Could not save the theme')
        queryClient.invalidateQueries({ queryKey: epkKey(epkId) })
      })
    },
    [queryClient, epkId]
  )

  const setCustomSettings = useCallback(
    (updater: (prev: EpkCustomSettings) => EpkCustomSettings) => {
      let next: EpkCustomSettings | undefined

      queryClient.setQueryData<Epk>(epkKey(epkId), (old) => {
        if (!old) return old
        next = updater((old.custom_settings as EpkCustomSettings | null) ?? {})
        return { ...old, custom_settings: next as Record<string, unknown> }
      })

      if (!next) return

      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        updateEpk(epkId, { custom_settings: next as Record<string, unknown> }).catch(() => {
          toast.error('Could not save the theme')
          queryClient.invalidateQueries({ queryKey: epkKey(epkId) })
        })
      }, 500)
    },
    [queryClient, epkId]
  )

  return { setTheme, setCustomSettings }
}
