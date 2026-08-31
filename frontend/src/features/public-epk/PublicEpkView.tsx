import { Download, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { publicEpkPdfUrl, trackEvent } from '@/api/publicEpk'
import { renderSection } from '@/features/public-epk/sectionRenderers'
import { resolveTheme, themeToCssVars, type EpkCustomSettings } from '@/lib/epkThemes'
import type { PublicEpk } from '@/types'

function NotAvailable() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Sparkles className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">{t('publicEpk.notAvailable.title')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('publicEpk.notAvailable.description')}</p>
    </div>
  )
}

/**
 * The actual public-EPK page body — shared by PublicEpkPage (looked up by
 * :slug on the app's own domain) and CustomDomainEpkPage (looked up by
 * hostname, once App.tsx notices it's being loaded from somewhere else).
 * Both already have a resolved `epk` (same PublicEpk shape either way) and
 * its `slug`, which is what the PDF/download/analytics-event endpoints are
 * keyed by regardless of which domain served the page.
 */
export function PublicEpkView({
  epk,
  slug,
  isLoading,
  isError,
}: {
  epk: PublicEpk | undefined
  slug: string | undefined
  isLoading: boolean
  isError: boolean
}) {
  const { t } = useTranslation()
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
      document.title = 'KORAX'
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
      <a
        href={publicEpkPdfUrl(slug)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackEvent(slug, 'download', { filename: 'epk.pdf' })}
        className="fixed end-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-[var(--epk-border)] bg-[var(--epk-bg)]/90 px-3 py-1.5 text-xs font-medium text-[var(--epk-fg)] shadow-sm backdrop-blur transition-opacity hover:opacity-80"
      >
        <Download className="size-3.5" />
        {t('publicEpk.downloadPdf')}
      </a>
      {epk.sections.map((section) =>
        renderSection(section, epk.artist?.name ?? epk.title, theme, (type, meta) => trackEvent(slug, type, meta))
      )}
    </div>
  )
}
