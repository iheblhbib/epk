import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shared row shell for the gallery-style settings editors (Photos, Music,
 * Releases, Videos, Press) — an up/down/remove control cluster wrapping
 * whatever fields that item type needs.
 */
export function GalleryItemRow({
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  children,
}: {
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="icon-xs" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">
          <ChevronUp className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">
          <ChevronDown className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} title="Remove">
          <X className="size-3.5" />
        </Button>
      </div>
      {children}
    </div>
  )
}
