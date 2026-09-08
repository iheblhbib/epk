import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { SOCIAL_PLATFORMS as PLATFORMS } from '@/features/epks/builder/socialPlatforms'
import type { EpkSection, SocialLink, SocialNetworksConfig } from '@/types'

export function SocialNetworksSettings({
  epkId,
  workspaceId,
  section,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
}) {
  const { t } = useTranslation()
  const config = section.config as SocialNetworksConfig
  const setConfig = useDraftSectionConfig<SocialNetworksConfig>(epkId, section)
  const links = config.links ?? []

  const urlFor = (platform: string) => links.find((link) => link.platform === platform)?.url ?? ''

  const setUrl = (platform: string, url: string) => {
    setConfig((prev) => {
      const existing = prev.links ?? []
      const withoutPlatform = existing.filter((link) => link.platform !== platform)
      const next = url ? [...withoutPlatform, { platform, url }] : withoutPlatform
      return { ...prev, links: next }
    })
  }

  // Custom links share the same `links` array as the fixed platforms above
  // (platform: 'custom'), so every mutation below operates on the *absolute*
  // index into the full array -- keeping that array's real order/composition
  // intact for whichever fixed-platform entries happen to sit alongside them
  // -- while up/down movement only ever swaps a custom entry with its
  // nearest custom neighbor, never with an interleaved fixed-platform one.
  const customLinks = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => link.platform === 'custom')

  function updateCustomLink(index: number, patch: Partial<SocialLink>) {
    setConfig((prev) => ({
      ...prev,
      links: (prev.links ?? []).map((link, i) => (i === index ? { ...link, ...patch } : link)),
    }))
  }

  function removeCustomLink(index: number) {
    setConfig((prev) => ({ ...prev, links: (prev.links ?? []).filter((_, i) => i !== index) }))
  }

  function addCustomLink() {
    setConfig((prev) => ({
      ...prev,
      links: [...(prev.links ?? []), { platform: 'custom', url: '', label: '', icon_media_id: null }],
    }))
  }

  function moveCustomLink(customPosition: number, direction: 'up' | 'down') {
    setConfig((prev) => {
      const allLinks = prev.links ?? []
      const customIndices = allLinks.map((link, i) => (link.platform === 'custom' ? i : -1)).filter((i) => i !== -1)
      const swapWith = direction === 'up' ? customPosition - 1 : customPosition + 1
      if (swapWith < 0 || swapWith >= customIndices.length) return prev

      const next = [...allLinks]
      const a = customIndices[customPosition]
      const b = customIndices[swapWith]
      ;[next[a], next[b]] = [next[b], next[a]]

      return { ...prev, links: next }
    })
  }

  return (
    <div className="space-y-4">
      {PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
        <div key={key} className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {label}
          </Label>
          <Input
            placeholder={placeholder}
            value={urlFor(key)}
            onChange={(event) => setUrl(key, event.target.value)}
          />
        </div>
      ))}

      <div className="space-y-2 border-t border-border pt-3">
        <Label>{t('epkBuilder.socialNetworks.customLinks')}</Label>
        {customLinks.map(({ link, index }, position) => (
          <GalleryItemRow
            key={index}
            canMoveUp={position > 0}
            canMoveDown={position < customLinks.length - 1}
            onMoveUp={() => moveCustomLink(position, 'up')}
            onMoveDown={() => moveCustomLink(position, 'down')}
            onRemove={() => removeCustomLink(index)}
          >
            <Input
              placeholder={t('epkBuilder.socialNetworks.customLabelPlaceholder')}
              value={link.label ?? ''}
              onChange={(event) => updateCustomLink(index, { label: event.target.value })}
            />
            <Input
              placeholder={t('epkBuilder.socialNetworks.customUrlPlaceholder')}
              value={link.url}
              onChange={(event) => updateCustomLink(index, { url: event.target.value })}
            />
            <MediaPickerSingle
              workspaceId={workspaceId}
              value={link.icon_media_id}
              onChange={(id) => updateCustomLink(index, { icon_media_id: id })}
              type="image"
              label={t('epkBuilder.socialNetworks.selectCustomIcon')}
            />
          </GalleryItemRow>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addCustomLink}>
          <Plus className="size-4" />
          {t('epkBuilder.socialNetworks.addCustomLink')}
        </Button>
      </div>
    </div>
  )
}
