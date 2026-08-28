import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { SOCIAL_PLATFORMS as PLATFORMS } from '@/features/epks/builder/socialPlatforms'
import type { EpkSection, SocialNetworksConfig } from '@/types'

export function SocialNetworksSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
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
    </div>
  )
}
