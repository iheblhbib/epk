import { useParams } from 'react-router-dom'
import { usePublicEpk } from '@/features/public-epk/hooks/usePublicEpk'
import { PublicEpkView } from '@/features/public-epk/PublicEpkView'

export function PublicEpkPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: epk, isLoading, isError } = usePublicEpk(slug)

  return <PublicEpkView epk={epk} slug={slug} isLoading={isLoading} isError={isError} />
}
