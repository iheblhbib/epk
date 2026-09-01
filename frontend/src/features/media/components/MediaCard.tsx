import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Loader2, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { MediaThumb } from '@/components/common/MediaThumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteMedia, useRenameMedia } from '@/features/media/hooks/useMedia'
import { downloadAuthenticatedFile } from '@/lib/downloadFile'
import { formatBytes } from '@/lib/formatBytes'
import { isEditorLevel } from '@/lib/permissions'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { Media, WorkspaceRole } from '@/types'

const TYPE_LABEL_KEYS: Record<Media['type'], string> = {
  image: 'media.typeBadge.image',
  audio: 'media.typeBadge.audio',
  video: 'media.typeBadge.video',
  document: 'media.typeBadge.document',
}

/**
 * Splits "photo.jpg" into { baseName: "photo", extension: "jpg" }. The
 * extension always comes from the real stored file (the backend re-derives
 * and enforces it independently on save), so the rename dialog only ever
 * lets the user edit the base name — they can't accidentally strip or
 * change it into something that no longer matches the actual file.
 */
function splitFilename(filename: string): { baseName: string; extension: string } {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return { baseName: filename, extension: '' }
  return { baseName: filename.slice(0, lastDot), extension: filename.slice(lastDot + 1) }
}

function renameSchema(t: TFunction) {
  return z.object({
    base_name: z.string().min(1, t('validation.nameRequired')).max(255),
  })
}

export function MediaCard({
  media,
  workspaceId,
  myRole,
  isPlaying,
  onTogglePreview,
}: {
  media: Media
  workspaceId: number
  myRole: WorkspaceRole | null
  /** Whether this row's audio is the one currently playing — the list page
   * owns the actual <audio> element so only one row ever plays at a time. */
  isPlaying: boolean
  onTogglePreview: () => void
}) {
  const { t, i18n } = useTranslation()
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const renameMedia = useRenameMedia(workspaceId)
  const deleteMedia = useDeleteMedia(workspaceId)
  const canEdit = isEditorLevel(myRole)

  const { baseName, extension } = splitFilename(media.original_filename)

  // defaultValues + reset-on-open (not RHF's `values` option): a fresh object
  // there would resync the form on every re-render of this card — including a
  // background refetch of the media list while the rename dialog is open —
  // silently discarding whatever the user is mid-typing.
  const form = useForm<z.infer<ReturnType<typeof renameSchema>>>({
    resolver: zodResolver(renameSchema(t)),
    defaultValues: { base_name: baseName },
  })

  useEffect(() => {
    if (renameOpen) {
      form.reset({ base_name: baseName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameOpen])

  const onSubmit = form.handleSubmit((values) => {
    const newName = extension ? `${values.base_name}.${extension}` : values.base_name

    renameMedia.mutate(
      { mediaId: media.id, name: newName },
      {
        onSuccess: () => {
          toast.success(t('media.toasts.renamed'))
          setRenameOpen(false)
        },
        onError: () => toast.error(t('media.toasts.renameError')),
      }
    )
  })

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        <MediaThumb media={media} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={media.original_filename}>
          {media.original_filename}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="px-1.5 text-[10px]">
            {t(TYPE_LABEL_KEYS[media.type])}
          </Badge>
          <span>{formatBytes(media.size)}</span>
          <span className="hidden sm:inline">
            {t('media.addedRelative', { when: formatRelativeTime(media.created_at, i18n.resolvedLanguage ?? 'en') })}
          </span>
          {media.uploaded_by && (
            <span className="hidden sm:inline">{t('media.uploadedBy', { name: media.uploaded_by.name })}</span>
          )}
        </div>
      </div>

      {media.type === 'audio' && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onTogglePreview}
          aria-label={isPlaying ? t('media.pausePreview') : t('media.playPreview')}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              {t('media.rename')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(event) => event.preventDefault()}
            disabled={isDownloading}
            onClick={() => {
              setIsDownloading(true)
              downloadAuthenticatedFile(`/api/media/${media.id}/download`, media.original_filename)
                .catch(() => toast.error(t('media.toasts.downloadError')))
                .finally(() => setIsDownloading(false))
            }}
          >
            {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('media.download')}
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive">
              <Trash2 className="size-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('media.renameDialog.title')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="base_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contacts.fields.name')}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1.5">
                        <Input autoFocus className="flex-1" {...field} />
                        {extension && (
                          <span className="shrink-0 text-sm text-muted-foreground">.{extension}</span>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={renameMedia.isPending}>
                  {renameMedia.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('media.renameDialog.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('media.deleteDialog.title')}
        description={t('media.deleteDialog.description', { name: media.original_filename })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteMedia.isPending}
        onConfirm={() =>
          deleteMedia.mutate(media.id, {
            onSuccess: () => {
              toast.success(t('media.toasts.deleted'))
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error(t('media.toasts.deleteError')),
          })
        }
      />
    </div>
  )
}
