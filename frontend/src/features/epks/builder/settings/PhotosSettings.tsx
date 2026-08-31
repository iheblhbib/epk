import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, PhotoItem, PhotosConfig } from '@/types'

export function PhotosSettings({ epkId, workspaceId, section }: { epkId: number; workspaceId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as PhotosConfig
  const setConfig = useDraftSectionConfig<PhotosConfig>(epkId, section)
  const items = config.items ?? []

  const updateItem = (index: number, patch: Partial<PhotoItem>) =>
    setConfig((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))

  return (
    <div className="space-y-3">
      <Label>{t('epkBuilder.sectionTypes.photos')}</Label>
      {items.map((item, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, items: moveItem(prev.items ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, items: moveItem(prev.items ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, items: (prev.items ?? []).filter((_, i) => i !== index) }))}
        >
          <MediaPickerSingle
            workspaceId={workspaceId}
            value={item.media_id}
            onChange={(id) => updateItem(index, { media_id: id })}
            type="image"
          />
          <Input
            placeholder={t('epkBuilder.photos.captionPlaceholder')}
            value={item.caption ?? ''}
            onChange={(event) => updateItem(index, { caption: event.target.value })}
          />
          <Input
            placeholder={t('epkBuilder.photos.creditPlaceholder')}
            value={item.credit ?? ''}
            onChange={(event) => updateItem(index, { credit: event.target.value })}
          />
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, items: [...(prev.items ?? []), { media_id: null }] }))}
      >
        <Plus className="size-4" />
        {t('epkBuilder.photos.addPhoto')}
      </Button>
    </div>
  )
}
