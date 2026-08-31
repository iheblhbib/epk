import { zodResolver } from '@hookform/resolvers/zod'
import { Download, FileText, Film, Loader2, MoreHorizontal, Music, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { Media, WorkspaceRole } from '@/types'

const TYPE_ICON: Record<Media['type'], typeof Music> = {
  image: FileText, // unused: images render their thumbnail instead
  audio: Music,
  video: Film,
  document: FileText,
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
}: {
  media: Media
  workspaceId: number
  myRole: WorkspaceRole | null
}) {
  const { t } = useTranslation()
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

  const Icon = TYPE_ICON[media.type]

  return (
    <Card className="overflow-hidden">
      <div className="flex aspect-video items-center justify-center bg-muted">
        {media.type === 'image' ? (
          <img
            src={media.thumbnail_url ?? media.url}
            alt={media.original_filename}
            className="size-full object-cover"
          />
        ) : (
          <Icon className="size-8 text-muted-foreground" />
        )}
      </div>
      <CardContent className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground" title={media.original_filename}>
            {media.original_filename}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(media.size)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
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
      </CardContent>

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
    </Card>
  )
}
