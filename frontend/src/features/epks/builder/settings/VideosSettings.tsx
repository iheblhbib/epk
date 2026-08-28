import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, VideoItem, VideosConfig } from '@/types'

const PROVIDER_ITEMS = { youtube: 'YouTube', vimeo: 'Vimeo', upload: 'Direct upload' }

export function VideosSettings({ epkId, workspaceId, section }: { epkId: number; workspaceId: number; section: EpkSection }) {
  const config = section.config as VideosConfig
  const setConfig = useDraftSectionConfig<VideosConfig>(epkId, section)
  const videos = config.videos ?? []

  const updateVideo = (index: number, patch: Partial<VideoItem>) =>
    setConfig((prev) => ({
      ...prev,
      videos: (prev.videos ?? []).map((video, i) => (i === index ? { ...video, ...patch } : video)),
    }))

  return (
    <div className="space-y-3">
      <Label>Videos</Label>
      {videos.map((video, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < videos.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, videos: moveItem(prev.videos ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, videos: moveItem(prev.videos ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, videos: (prev.videos ?? []).filter((_, i) => i !== index) }))}
        >
          <Input
            placeholder="Video title (optional)"
            value={video.title ?? ''}
            onChange={(event) => updateVideo(index, { title: event.target.value })}
          />
          <Select
            items={PROVIDER_ITEMS}
            value={video.provider ?? 'youtube'}
            onValueChange={(value) => updateVideo(index, { provider: value as VideoItem['provider'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {video.provider === 'upload' ? (
            <MediaPickerSingle
              workspaceId={workspaceId}
              value={video.media_id}
              onChange={(id) => updateVideo(index, { media_id: id })}
              type="video"
              label="Select video file"
            />
          ) : (
            <Input
              placeholder={video.provider === 'vimeo' ? 'https://vimeo.com/…' : 'https://youtube.com/watch?v=…'}
              value={video.url ?? ''}
              onChange={(event) => updateVideo(index, { url: event.target.value })}
            />
          )}
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, videos: [...(prev.videos ?? []), { provider: 'youtube' }] }))}
      >
        <Plus className="size-4" />
        Add video
      </Button>
    </div>
  )
}
