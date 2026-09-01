import { Loader2, Pause, Play, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MediaThumb } from '@/components/common/MediaThumb'
import { useMediaList, useUploadMedia } from '@/features/media/hooks/useMedia'
import { useAudioPreview } from '@/hooks/useAudioPreview'
import { formatBytes } from '@/lib/formatBytes'
import { cn } from '@/lib/utils'
import type { Media, MediaType } from '@/types'

// Mirrors backend config/media.php's allowed_extensions, grouped by the
// type they map to, so the upload zone below never lets someone pick a
// file the server would reject anyway.
const TYPE_ACCEPT: Record<MediaType, string> = {
  image: '.jpg,.jpeg,.png,.webp',
  audio: '.mp3,.wav,.flac',
  video: '.mp4,.mov',
  document: '.pdf,.docx',
}
const ALL_ACCEPT = Object.values(TYPE_ACCEPT).join(',')

/**
 * A compact drag-and-drop/click uploader embedded directly in the picker
 * dialog — the whole point is letting someone add a brand-new file without
 * ever leaving the section they're editing to go to the Media Library and
 * back. Deliberately its own (smaller) styling rather than reusing
 * MediaUploadZone as-is, which is sized for a full page, not a dialog.
 */
function PickerUploadZone({
  workspaceId,
  type,
  multiple,
  onUploaded,
}: {
  workspaceId: number
  type?: MediaType
  multiple: boolean
  onUploaded: (uploaded: Media[]) => void
}) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadMedia(workspaceId)
  const accept = type ? TYPE_ACCEPT[type] : ALL_ACCEPT

  function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    upload.mutate(
      { files: fileArray },
      {
        onSuccess: (uploaded) => {
          toast.success(
            uploaded.length === 1
              ? t('media.upload.oneFileUploaded')
              : t('media.upload.filesUploaded', { count: uploaded.length })
          )
          onUploaded(uploaded)
        },
        onError: () => toast.error(t('media.upload.error')),
      }
    )
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        uploadFiles(event.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50',
        isDragging && 'border-primary bg-primary/5'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) uploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
      {upload.isPending ? t('media.upload.uploading') : t('epkBuilder.mediaPicker.uploadNew')}
    </div>
  )
}

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

          <PickerUploadZone
            workspaceId={workspaceId}
            type={type}
            multiple={false}
            onUploaded={(uploaded) => {
              // Uploading here *is* picking — auto-select the new file and
              // close, same as clicking an existing one, instead of making
              // the user upload and then separately click their own upload.
              onChange(uploaded[0].id)
              closeDialog(false)
            }}
          />

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

          <PickerUploadZone
            workspaceId={workspaceId}
            multiple
            onUploaded={(uploaded) => {
              // Stays open (unlike the single picker) — adding one file
              // from Downloads is rarely the only one someone wants to add.
              onChange([...value, ...uploaded.map((item) => item.id)])
            }}
          />

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
