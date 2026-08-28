import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, PressConfig, PressItem } from '@/types'

export function PressSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const config = section.config as PressConfig
  const setConfig = useDraftSectionConfig<PressConfig>(epkId, section)
  const items = config.items ?? []

  const updateItem = (index: number, patch: Partial<PressItem>) =>
    setConfig((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))

  return (
    <div className="space-y-3">
      <Label>Press coverage</Label>
      {items.map((item, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, items: moveItem(prev.items ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, items: moveItem(prev.items ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, items: (prev.items ?? []).filter((_, i) => i !== index) }))}
        >
          <Input
            placeholder="Outlet (e.g. Pitchfork)"
            value={item.outlet ?? ''}
            onChange={(event) => updateItem(index, { outlet: event.target.value })}
          />
          <Textarea
            rows={2}
            placeholder="Quote"
            value={item.quote ?? ''}
            onChange={(event) => updateItem(index, { quote: event.target.value })}
          />
          <Input
            placeholder="Article URL (optional)"
            value={item.article_url ?? ''}
            onChange={(event) => updateItem(index, { article_url: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Author (optional)"
              value={item.author ?? ''}
              onChange={(event) => updateItem(index, { author: event.target.value })}
            />
            <Input
              type="date"
              value={item.published_at ?? ''}
              onChange={(event) => updateItem(index, { published_at: event.target.value || null })}
            />
          </div>
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, items: [...(prev.items ?? []), { outlet: '' }] }))}
      >
        <Plus className="size-4" />
        Add press mention
      </Button>
    </div>
  )
}
