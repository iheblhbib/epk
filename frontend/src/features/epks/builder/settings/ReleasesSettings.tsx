import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, ReleaseItem, ReleaseLinks, ReleasesConfig } from '@/types'

const TYPE_ITEMS = { album: 'Album', ep: 'EP', single: 'Single' }
const LINK_PLATFORMS: { key: keyof ReleaseLinks; label: string; placeholder: string }[] = [
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/album/…' },
  { key: 'apple_music', label: 'Apple Music', placeholder: 'https://music.apple.com/…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/…' },
  { key: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/…' },
  { key: 'deezer', label: 'Deezer', placeholder: 'https://deezer.com/…' },
  { key: 'bandcamp', label: 'Bandcamp', placeholder: 'https://…bandcamp.com/…' },
]

export function ReleasesSettings({ epkId, workspaceId, section }: { epkId: number; workspaceId: number; section: EpkSection }) {
  const config = section.config as ReleasesConfig
  const setConfig = useDraftSectionConfig<ReleasesConfig>(epkId, section)
  const releases = config.releases ?? []

  const updateRelease = (index: number, patch: Partial<ReleaseItem>) =>
    setConfig((prev) => ({
      ...prev,
      releases: (prev.releases ?? []).map((release, i) => (i === index ? { ...release, ...patch } : release)),
    }))

  return (
    <div className="space-y-3">
      <Label>Releases</Label>
      {releases.map((release, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < releases.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, releases: moveItem(prev.releases ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, releases: moveItem(prev.releases ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, releases: (prev.releases ?? []).filter((_, i) => i !== index) }))}
        >
          <Input
            placeholder="Release title"
            value={release.title ?? ''}
            onChange={(event) => updateRelease(index, { title: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              items={TYPE_ITEMS}
              value={release.type ?? 'album'}
              onValueChange={(value) => updateRelease(index, { type: value as ReleaseItem['type'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={release.release_date ?? ''}
              onChange={(event) => updateRelease(index, { release_date: event.target.value || null })}
            />
          </div>
          <MediaPickerSingle
            workspaceId={workspaceId}
            value={release.cover_media_id}
            onChange={(id) => updateRelease(index, { cover_media_id: id })}
            type="image"
            label="Select cover art"
          />
          <div className="space-y-1.5 border-t border-border pt-2">
            <p className="text-xs font-medium text-muted-foreground">Streaming links (optional)</p>
            {LINK_PLATFORMS.map(({ key, label, placeholder }) => (
              <Input
                key={key}
                placeholder={`${label}: ${placeholder}`}
                value={release.links?.[key] ?? ''}
                onChange={(event) =>
                  updateRelease(index, { links: { ...release.links, [key]: event.target.value } })
                }
              />
            ))}
          </div>
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, releases: [...(prev.releases ?? []), { type: 'album' }] }))}
      >
        <Plus className="size-4" />
        Add release
      </Button>
    </div>
  )
}
