import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { trackEvent } from '@/api/publicEpk'
import { usePublicEpk } from '@/features/public-epk/hooks/usePublicEpk'
import { renderSection } from '@/features/public-epk/sectionRenderers'
import { resolveTheme, themeToCssVars, type EpkCustomSettings } from '@/lib/epkThemes'

function NotAvailable() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Sparkles className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">This press kit isn&apos;t available</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        It may have been unpublished or the link may be incorrect.
      </p>
    </div>
  )
}

export function PublicEpkPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: epk, isLoading, isError } = usePublicEpk(slug)
  const hasTrackedView = useRef(false)

  useEffect(() => {
    if (!epk || !slug || hasTrackedView.current) return
    hasTrackedView.current = true
    trackEvent(slug, 'page_view')
  }, [epk, slug])

  useEffect(() => {
    if (!epk) return
    document.title = epk.seo_title || epk.title
    const description = epk.seo_description || epk.artist?.short_bio || ''
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    return () => {
      document.title = 'Kitfolio'
    }
  }, [epk])

  if (isLoading) {
    return <div className="min-h-screen bg-background" />
  }

  if (isError || !epk || !slug) {
    return <NotAvailable />
  }

  const theme = resolveTheme(epk.theme, epk.custom_settings as EpkCustomSettings | null)

  return (
    <div
      className="min-h-screen bg-[var(--epk-bg)] text-[var(--epk-fg)]"
      style={{ ...themeToCssVars(theme), fontFamily: 'var(--epk-font)' }}
    >
      {epk.sections.map((section) =>
        renderSection(section, epk.artist?.name ?? epk.title, theme, (type, meta) => trackEvent(slug, type, meta))
      )}
    </div>
  )
}
