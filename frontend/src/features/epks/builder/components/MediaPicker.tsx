import { FileText, Film, ImageIcon, Music, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useMediaList } from '@/features/media/hooks/useMedia'
import { cn } from '@/lib/utils'
import type { Media, MediaType } from '@/types'

const TYPE_ICON: Record<MediaType, typeof Music> = {
  image: ImageIcon,
  audio: Music,
  video: Film,
  document: FileText,
}

function MediaThumb({ media }: { media: Media }) {
  const Icon = TYPE_ICON[media.type]

  return media.type === 'image' ? (
    <img src={media.thumbnail_url ?? media.url} alt={media.original_filename} className="size-full object-cover" />
  ) : (
    <Icon className="size-6 text-muted-foreground" />
  )
}

/** Single-file picker — used for Hero's profile/background image. */
export function MediaPickerSingle({
  workspaceId,
  value,
  onChange,
  type,
  label = 'Select image',
}: {
  workspaceId: number
  value: number | null | undefined
  onChange: (mediaId: number | null) => void
  type?: MediaType
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const { data: media } = useMediaList(workspaceId, { type })
  const selected = media?.find((item) => item.id === value)

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          {selected ? 'Change' : label}
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select from Media Library</DialogTitle>
          </DialogHeader>
          {!media || media.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No files yet — upload some in the Media Library first.
            </p>
          ) : (
            <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 border-transparent bg-muted hover:border-primary/50',
                    value === item.id && 'border-primary'
                  )}
                  title={item.original_filename}
                >
                  <MediaThumb media={item} />
                </button>
              ))}
            </div>
          )}
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
          Add files from Media Library
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select downloadable files</DialogTitle>
          </DialogHeader>
          {!media || media.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No files yet — upload some in the Media Library first.
            </p>
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
