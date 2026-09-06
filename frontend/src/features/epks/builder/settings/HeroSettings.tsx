import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { clearDeviceOverride, isInherited, normalizeResponsive, withDeviceOverride, type DeviceWidth } from '@/lib/responsiveValue'
import type { AlignValue, EpkSection, HeightValue, HeroConfig } from '@/types'

// Literal (rather than dynamically-templated) i18n keys so static
// key-checking tools can see both possible keys directly in source.
const INHERITS_FROM_LABEL_KEY = {
  tablet: 'epkBuilder.device.tabletShort',
  desktop: 'epkBuilder.device.desktopShort',
} as const

export function HeroSettings({
  epkId,
  workspaceId,
  section,
  deviceWidth,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
  deviceWidth: DeviceWidth
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

  const alignmentValues = normalizeResponsive<AlignValue>(config.alignment, 'center')
  const heightValues = normalizeResponsive<HeightValue>(config.height, 'large')
  const alignmentInherited = isInherited(config.alignment, deviceWidth)
  const heightInherited = isInherited(config.height, deviceWidth)

  function setAlignment(value: AlignValue) {
    setConfig((prev) => ({ ...prev, alignment: withDeviceOverride(prev.alignment, deviceWidth, value, 'center') }))
  }

  function setHeight(value: HeightValue) {
    setConfig((prev) => ({ ...prev, height: withDeviceOverride(prev.height, deviceWidth, value, 'large') }))
  }

  // Desktop has no parent breakpoint to inherit from, so there's nothing to
  // reset it to -- both clear functions are only ever rendered/reachable for
  // tablet/mobile, but guard here too so the narrowed deviceWidth type flows
  // cleanly into clearDeviceOverride without a cast.
  function clearAlignment() {
    if (deviceWidth === 'desktop') return
    setConfig((prev) => ({ ...prev, alignment: clearDeviceOverride(prev.alignment, deviceWidth) }))
  }

  function clearHeight() {
    if (deviceWidth === 'desktop') return
    setConfig((prev) => ({ ...prev, height: clearDeviceOverride(prev.height, deviceWidth) }))
  }

  // Tablet inherits from desktop; mobile inherits from tablet (which may
  // itself be inheriting from desktop) -- always name the *immediate*
  // parent breakpoint, matching normalizeResponsive()'s own fallback chain.
  const inheritsFromDevice = deviceWidth === 'mobile' ? 'tablet' : 'desktop'
  const inheritsFromLabel = t(INHERITS_FROM_LABEL_KEY[inheritsFromDevice])

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
          <div className="flex items-center justify-between gap-2">
            <Label>{t('epkBuilder.hero.alignment')}</Label>
            {deviceWidth !== 'desktop' && !alignmentInherited && (
              <button
                type="button"
                onClick={clearAlignment}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('epkBuilder.hero.resetToInherited')}
              </button>
            )}
          </div>
          <Select
            items={alignmentItems}
            value={alignmentValues[deviceWidth]}
            onValueChange={(value) => setAlignment(value as AlignValue)}
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
          {alignmentInherited && (
            <p className="text-xs text-muted-foreground">
              {t('epkBuilder.hero.inheritsFrom', { device: inheritsFromLabel, value: alignmentItems[alignmentValues[deviceWidth]] })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>{t('epkBuilder.hero.height')}</Label>
            {deviceWidth !== 'desktop' && !heightInherited && (
              <button
                type="button"
                onClick={clearHeight}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('epkBuilder.hero.resetToInherited')}
              </button>
            )}
          </div>
          <Select
            items={heightItems}
            value={heightValues[deviceWidth]}
            onValueChange={(value) => setHeight(value as HeightValue)}
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
          {heightInherited && (
            <p className="text-xs text-muted-foreground">
              {t('epkBuilder.hero.inheritsFrom', { device: inheritsFromLabel, value: heightItems[heightValues[deviceWidth]] })}
            </p>
          )}
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
