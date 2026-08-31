import { useQuery } from '@tanstack/react-query'
import { getPublicEpk, getPublicEpkByDomain } from '@/api/publicEpk'

export const publicEpkKey = (slug: string) => ['public-epk', slug] as const
export const publicEpkByDomainKey = (domain: string) => ['public-epk-by-domain', domain] as const

export function usePublicEpk(slug: string | undefined) {
  return useQuery({
    queryKey: publicEpkKey(slug ?? ''),
    queryFn: () => getPublicEpk(slug as string),
    enabled: slug !== undefined,
    retry: false, // 404 (unpublished/unknown slug) shouldn't be retried
  })
}

export function usePublicEpkByDomain(domain: string) {
  return useQuery({
    queryKey: publicEpkByDomainKey(domain),
    queryFn: () => getPublicEpkByDomain(domain),
    retry: false, // 404 (no epk claims this domain, or it's unverified) shouldn't be retried
  })
}
