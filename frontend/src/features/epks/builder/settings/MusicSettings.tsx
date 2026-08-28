import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, MusicConfig, TrackItem } from '@/types'

export function MusicSettings({ epkId, workspaceId, section }: { epkId: number; workspaceId: number; section: EpkSection }) {
  const config = section.config as MusicConfig
  const setConfig = useDraftSectionConfig<MusicConfig>(epkId, section)
  const tracks = config.tracks ?? []

  const updateTrack = (index: number, patch: Partial<TrackItem>) =>
    setConfig((prev) => ({
      ...prev,
      tracks: (prev.tracks ?? []).map((track, i) => (i === index ? { ...track, ...patch } : track)),
    }))

  return (
    <div className="space-y-3">
      <Label>Tracks</Label>
      {tracks.map((track, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < tracks.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, tracks: moveItem(prev.tracks ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, tracks: moveItem(prev.tracks ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, tracks: (prev.tracks ?? []).filter((_, i) => i !== index) }))}
        >
          <Input
            placeholder="Track title (defaults to the filename)"
            value={track.title ?? ''}
            onChange={(event) => updateTrack(index, { title: event.target.value })}
          />
          <MediaPickerSingle
            workspaceId={workspaceId}
            value={track.audio_media_id}
            onChange={(id) => updateTrack(index, { audio_media_id: id })}
            type="audio"
            label="Select audio file"
          />
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, tracks: [...(prev.tracks ?? []), { audio_media_id: null }] }))}
      >
        <Plus className="size-4" />
        Add track
      </Button>
    </div>
  )
}
