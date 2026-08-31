import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="icon-xs" disabled={!canMoveUp} onClick={onMoveUp} title={t('epkBuilder.gallery.moveUp')}>
          <ChevronUp className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={!canMoveDown} onClick={onMoveDown} title={t('epkBuilder.gallery.moveDown')}>
          <ChevronDown className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} title={t('epkBuilder.gallery.remove')}>
          <X className="size-3.5" />
        </Button>
      </div>
      {children}
    </div>
  )
}
