import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/features/epks/builder/components/RichTextEditor'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { BiographyConfig, EpkSection } from '@/types'

export function BiographySettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as BiographyConfig
  const setConfig = useDraftSectionConfig<BiographyConfig>(epkId, section)

  return (
    <div className="space-y-1.5">
      <Label>{t('epkBuilder.sectionTypes.biography')}</Label>
      <RichTextEditor
        value={config.html ?? ''}
        onChange={(html) => setConfig((prev) => ({ ...prev, html }))}
        placeholder={t('epkBuilder.biography.placeholder')}
      />
    </div>
  )
}
