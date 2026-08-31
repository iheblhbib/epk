import { Layers } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BiographySettings } from '@/features/epks/builder/settings/BiographySettings'
import { ComingSoonSettings } from '@/features/epks/builder/settings/ComingSoonSettings'
import { ContactSettings } from '@/features/epks/builder/settings/ContactSettings'
import { CreditsSettings } from '@/features/epks/builder/settings/CreditsSettings'
import { CustomSettings } from '@/features/epks/builder/settings/CustomSettings'
import { DownloadsSettings } from '@/features/epks/builder/settings/DownloadsSettings'
import { HeroSettings } from '@/features/epks/builder/settings/HeroSettings'
import { MusicSettings } from '@/features/epks/builder/settings/MusicSettings'
import { PhotosSettings } from '@/features/epks/builder/settings/PhotosSettings'
import { PressSettings } from '@/features/epks/builder/settings/PressSettings'
import { ReleasesSettings } from '@/features/epks/builder/settings/ReleasesSettings'
import { SocialNetworksSettings } from '@/features/epks/builder/settings/SocialNetworksSettings'
import { VideosSettings } from '@/features/epks/builder/settings/VideosSettings'
import { useUpdateSection } from '@/features/epks/hooks/useEpkSections'
import type { EpkSection } from '@/types'

/**
 * A controlled input whose local state is only ever seeded from `section`
 * once, on mount — deliberately decoupled from later prop changes. Our own
 * onBlur save round-trips back through the section-list query and updates
 * `section.title`, which (with `defaultValue` instead of this) would flip
 * Base UI's uncontrolled-input warning every time you saved a title.
 * `key={section.id}` on the call site re-mounts (and reseeds) this when the
 * selected section actually changes.
 */
function SectionTitleInput({ epkId, section }: { epkId: number; section: EpkSection }) {
  const updateSection = useUpdateSection(epkId)
  const [title, setTitle] = useState(section.title ?? '')

  return (
    <Input
      placeholder={section.label}
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => {
        const next = title || null
        if (next !== section.title) {
          updateSection.mutate({ sectionId: section.id, payload: { title: next } })
        }
      }}
    />
  )
}

export function SectionSettingsPanel({
  epkId,
  workspaceId,
  section,
  canEdit,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection | null
  canEdit: boolean
}) {
  const { t } = useTranslation()

  if (!section) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Layers}
          title={t('epkBuilder.settingsPanel.noSectionTitle')}
          description={t('epkBuilder.settingsPanel.noSectionDescription')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.label}</p>
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('common.viewOnlyAccess')}</p>
      )}

      {/* pointer-events-none rather than gating every individual field
          across 13 different per-section-type settings components — a
          viewer can still see exactly what's configured, just can't
          interact with any of it. */}
      <div className={canEdit ? undefined : 'pointer-events-none opacity-60'} inert={!canEdit}>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>{t('epkBuilder.settingsPanel.titleOverride')}</Label>
            <SectionTitleInput key={section.id} epkId={epkId} section={section} />
          </div>

          {(() => {
            switch (section.type) {
              case 'hero':
                return <HeroSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'biography':
                return <BiographySettings epkId={epkId} section={section} />
              case 'social_networks':
                return <SocialNetworksSettings epkId={epkId} section={section} />
              case 'contact':
                return <ContactSettings epkId={epkId} section={section} />
              case 'downloads':
                return <DownloadsSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'credits':
                return <CreditsSettings epkId={epkId} section={section} />
              case 'custom':
                return <CustomSettings epkId={epkId} section={section} />
              case 'photos':
                return <PhotosSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'music':
                return <MusicSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'releases':
                return <ReleasesSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'videos':
                return <VideosSettings epkId={epkId} workspaceId={workspaceId} section={section} />
              case 'press':
                return <PressSettings epkId={epkId} section={section} />
              default:
                return <ComingSoonSettings label={section.label} type={section.type} />
            }
          })()}
        </div>
      </div>
    </div>
  )
}
