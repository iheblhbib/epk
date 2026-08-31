import { usePublicEpkByDomain } from '@/features/public-epk/hooks/usePublicEpk'
import { PublicEpkView } from '@/features/public-epk/PublicEpkView'

/**
 * Rendered instead of the normal router (see App.tsx) whenever the SPA
 * notices it's loaded from a hostname other than its own — i.e. someone's
 * DNS CNAME pointed a custom domain at this same static build. Everything
 * downstream (theme, sections, download/analytics endpoints) is identical
 * to the slug-based public page; only the initial lookup differs.
 */
export function CustomDomainEpkPage() {
  const domain = window.location.hostname
  const { data: epk, isLoading, isError } = usePublicEpkByDomain(domain)

  return <PublicEpkView epk={epk} slug={epk?.slug} isLoading={isLoading} isError={isError} />
}
