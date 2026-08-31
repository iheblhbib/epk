import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/features/epks/builder/components/RichTextEditor'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { CustomConfig, EpkSection } from '@/types'

export function CustomSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as CustomConfig
  const setConfig = useDraftSectionConfig<CustomConfig>(epkId, section)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.custom.heading')}</Label>
        <Input
          value={config.heading ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, heading: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.custom.content')}</Label>
        <RichTextEditor
          value={config.html ?? ''}
          onChange={(html) => setConfig((prev) => ({ ...prev, html }))}
          placeholder={t('epkBuilder.custom.placeholder')}
        />
      </div>
    </div>
  )
}
