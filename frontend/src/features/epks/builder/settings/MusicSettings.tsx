import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, MusicConfig, TrackItem } from '@/types'

export function MusicSettings({ epkId, workspaceId, section }: { epkId: number; workspaceId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as MusicConfig
  const setConfig = useDraftSectionConfig<MusicConfig>(epkId, section)
  const tracks = config.tracks ?? []
  const providerItems = {
    upload: t('epkBuilder.music.directUpload'),
    spotify: 'Spotify',
    soundcloud: 'SoundCloud',
  }

  const updateTrack = (index: number, patch: Partial<TrackItem>) =>
    setConfig((prev) => ({
      ...prev,
      tracks: (prev.tracks ?? []).map((track, i) => (i === index ? { ...track, ...patch } : track)),
    }))

  return (
    <div className="space-y-3">
      <Label>{t('epkBuilder.sectionTypes.music')}</Label>
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
            placeholder={t('epkBuilder.music.trackTitlePlaceholder')}
            value={track.title ?? ''}
            onChange={(event) => updateTrack(index, { title: event.target.value })}
          />
          <Select
            items={providerItems}
            value={track.provider ?? 'upload'}
            onValueChange={(value) => updateTrack(index, { provider: value as TrackItem['provider'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(providerItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(track.provider ?? 'upload') === 'upload' ? (
            <MediaPickerSingle
              workspaceId={workspaceId}
              value={track.audio_media_id ?? null}
              onChange={(id) => updateTrack(index, { audio_media_id: id })}
              type="audio"
              label={t('epkBuilder.music.selectAudioFile')}
            />
          ) : (
            <Input
              placeholder={track.provider === 'soundcloud' ? 'https://soundcloud.com/artist/track' : 'https://open.spotify.com/track/…'}
              value={track.url ?? ''}
              onChange={(event) => updateTrack(index, { url: event.target.value })}
            />
          )}
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, tracks: [...(prev.tracks ?? []), { provider: 'upload', audio_media_id: null }] }))}
      >
        <Plus className="size-4" />
        {t('epkBuilder.music.addTrack')}
      </Button>
    </div>
  )
}
