import { Pause, Play, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MediaThumb } from '@/components/common/MediaThumb'
import { useMediaList } from '@/features/media/hooks/useMedia'
import { useAudioPreview } from '@/hooks/useAudioPreview'
import { formatBytes } from '@/lib/formatBytes'
import { cn } from '@/lib/utils'
import type { MediaType } from '@/types'

/** Single-file picker — used for Hero's profile/background image. */
export function MediaPickerSingle({
  workspaceId,
  value,
  onChange,
  type,
  label,
}: {
  workspaceId: number
  value: number | null | undefined
  onChange: (mediaId: number | null) => void
  type?: MediaType
  label?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { playingId, audioRef, toggle: togglePreview, stop: stopPreview } = useAudioPreview()
  const { data: media } = useMediaList(workspaceId, { type })
  const selected = media?.find((item) => item.id === value)
  const triggerLabel = label ?? t('epkBuilder.mediaPicker.selectImage')

  function closeDialog(open: boolean) {
    if (!open) stopPreview()
    setOpen(open)
  }

  return (
    <div className="flex items-center gap-2">
      {selected ? (
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          <MediaThumb media={selected} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          {selected ? t('epkBuilder.mediaPicker.change') : triggerLabel}
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('epkBuilder.mediaPicker.selectFromLibrary')}</DialogTitle>
          </DialogHeader>
          {!media || media.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('epkBuilder.mediaPicker.noFilesYet')}</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {media.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onChange(item.id)
                    closeDialog(false)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onChange(item.id)
                      closeDialog(false)
                    }
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-start text-sm hover:bg-muted',
                    value === item.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    <MediaThumb media={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.original_filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
                  </div>
                  {item.type === 'audio' && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        togglePreview(item.id, item.url)
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={
                        playingId === item.id
                          ? t('epkBuilder.mediaPicker.pausePreview')
                          : t('epkBuilder.mediaPicker.playPreview')
                      }
                    >
                      {playingId === item.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a preview scrubber, not content; captions don't apply */}
          <audio ref={audioRef} onEnded={stopPreview} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Multi-file picker — used for the Downloads section. */
export function MediaPickerMultiple({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: number
  value: number[]
  onChange: (mediaIds: number[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data: media } = useMediaList(workspaceId)
  const selectedItems = media?.filter((item) => value.includes(item.id)) ?? []

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      {selectedItems.length > 0 && (
        <ul className="space-y-1">
          {selectedItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-sm"
            >
              <span className="truncate">{item.original_filename}</span>
              <button type="button" onClick={() => toggle(item.id)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="w-full" />}>
          {t('epkBuilder.mediaPicker.addFiles')}
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('epkBuilder.mediaPicker.selectDownloadable')}</DialogTitle>
          </DialogHeader>
          {!media || media.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('epkBuilder.mediaPicker.noFilesYet')}</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-start text-sm hover:bg-muted',
                    value.includes(item.id) && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    <MediaThumb media={item} />
                  </div>
                  <span className="truncate">{item.original_filename}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
