import { zodResolver } from '@hookform/resolvers/zod'
import { Download, FileText, Film, Loader2, MoreHorizontal, Music, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { mediaDownloadUrl } from '@/api/media'
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

const renameSchema = z.object({
  base_name: z.string().min(1, 'Name is required').max(255),
})

export function MediaCard({
  media,
  workspaceId,
  myRole,
}: {
  media: Media
  workspaceId: number
  myRole: WorkspaceRole | null
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const renameMedia = useRenameMedia(workspaceId)
  const deleteMedia = useDeleteMedia(workspaceId)
  const canEdit = isEditorLevel(myRole)

  const { baseName, extension } = splitFilename(media.original_filename)

  // defaultValues + reset-on-open (not RHF's `values` option): a fresh object
  // there would resync the form on every re-render of this card — including a
  // background refetch of the media list while the rename dialog is open —
  // silently discarding whatever the user is mid-typing.
  const form = useForm<z.infer<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
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
          toast.success('Renamed')
          setRenameOpen(false)
        },
        onError: () => toast.error('Could not rename the file'),
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
                Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<a href={mediaDownloadUrl(media.id)} />}>
              <Download className="size-4" />
              Download
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive">
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="base_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete file"
        description={`"${media.original_filename}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMedia.isPending}
        onConfirm={() =>
          deleteMedia.mutate(media.id, {
            onSuccess: () => {
              toast.success('File deleted')
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error('Could not delete the file'),
          })
        }
      />
    </Card>
  )
}
