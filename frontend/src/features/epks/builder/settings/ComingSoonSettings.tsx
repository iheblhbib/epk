import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SectionType } from '@/types'

/**
 * Events is the last section type still addable/reorderable/toggleable
 * without a dedicated content editor — Photos/Music/Releases/Videos/Press
 * got theirs in Phase 7. No specific phase is committed for Events yet.
 */
export function ComingSoonSettings({ label, type: _type }: { label: string; type: SectionType }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <Sparkles className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{t('epkBuilder.comingSoon.title', { label })}</p>
      <p className="text-xs text-muted-foreground">{t('epkBuilder.comingSoon.description')}</p>
    </div>
  )
}
