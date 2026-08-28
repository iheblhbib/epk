import { useQuery } from '@tanstack/react-query'
import { getEpkAnalytics } from '@/api/analytics'

export const analyticsKey = (epkId: number | undefined, from?: string, to?: string) =>
  ['epks', epkId ?? 0, 'analytics', from ?? null, to ?? null] as const

export function useEpkAnalytics(epkId: number | undefined, range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: analyticsKey(epkId, range?.from, range?.to),
    queryFn: () => getEpkAnalytics(epkId as number, range),
    enabled: epkId !== undefined,
  })
}
