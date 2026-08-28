import { useQuery } from '@tanstack/react-query'
import { getPublicEpk } from '@/api/publicEpk'

export const publicEpkKey = (slug: string) => ['public-epk', slug] as const

export function usePublicEpk(slug: string | undefined) {
  return useQuery({
    queryKey: publicEpkKey(slug ?? ''),
    queryFn: () => getPublicEpk(slug as string),
    enabled: slug !== undefined,
    retry: false, // 404 (unpublished/unknown slug) shouldn't be retried
  })
}
