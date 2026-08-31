import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { EpkSection, HeroConfig } from '@/types'

export function HeroSettings({
  epkId,
  workspaceId,
  section,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
}) {
  const { t } = useTranslation()
  const config = section.config as HeroConfig
  const setConfig = useDraftSectionConfig<HeroConfig>(epkId, section)
  const alignmentItems = {
    left: t('epkBuilder.hero.alignmentLeft'),
    center: t('epkBuilder.hero.alignmentCenter'),
    right: t('epkBuilder.hero.alignmentRight'),
  }
  const heightItems = {
    small: t('epkBuilder.hero.heightSmall'),
    medium: t('epkBuilder.hero.heightMedium'),
    large: t('epkBuilder.hero.heightLarge'),
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.headline')}</Label>
        <Input
          placeholder={t('epkBuilder.hero.headlinePlaceholder')}
          value={config.headline ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, headline: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.subtitle')}</Label>
        <Input
          value={config.subtitle ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, subtitle: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.description')}</Label>
        <Textarea
          rows={3}
          value={config.description ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.profileImage')}</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.profile_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, profile_media_id: id }))}
          type="image"
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.backgroundImage')}</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.background_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, background_media_id: id }))}
          type="image"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('epkBuilder.hero.alignment')}</Label>
          <Select
            items={alignmentItems}
            value={config.alignment ?? 'center'}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, alignment: value as HeroConfig['alignment'] }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(alignmentItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('epkBuilder.hero.height')}</Label>
          <Select
            items={heightItems}
            value={config.height ?? 'large'}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, height: value as HeroConfig['height'] }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(heightItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('epkBuilder.hero.darkOverlay')}</Label>
        <Switch
          checked={config.overlay ?? true}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, overlay: checked }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.ctaLabel')}</Label>
        <Input
          placeholder={t('epkBuilder.hero.ctaLabelPlaceholder')}
          value={config.cta_label ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_label: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.ctaUrl')}</Label>
        <Input
          placeholder="https://…"
          value={config.cta_url ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_url: event.target.value }))}
        />
      </div>
    </div>
  )
}
