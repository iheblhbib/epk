import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { type ReactElement, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArtistQuickCreateDialog } from '@/features/epks/components/ArtistQuickCreateDialog'
import { useArtists } from '@/features/epks/hooks/useArtists'
import { useCreateEpk, useUpdateEpk } from '@/features/epks/hooks/useEpks'
import { createEpkFormSchema, type EpkFormValues } from '@/features/epks/schemas/epkSchemas'
import type { Epk } from '@/types'

type EpkFormDialogProps = {
  workspaceId: number
  epk?: Epk
} & (
  // Self-managed open state behind a trigger element (always a real <button>,
  // e.g. the "Create EPK" button) — DialogTrigger renders it directly.
  | { trigger: ReactElement; open?: never; onOpenChange?: never }
  // Fully controlled, no trigger of its own: for callers that open it from
  // something that isn't a real <button> (e.g. a DropdownMenuItem in
  // EpkCard's "⋯" menu). Composing DialogTrigger's `render` prop onto a
  // DropdownMenuItem previously clobbered the item's `role="menuitem"` with
  // DialogTrigger's own role, breaking the menu — this mode avoids that by
  // never rendering a DialogTrigger at all; the caller manages `open` itself
  // and triggers it however it likes (e.g. the menu item's onClick).
  | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
)

export function EpkFormDialog({
  workspaceId,
  epk,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EpkFormDialogProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = setControlledOpen ?? setInternalOpen
  const { data: artists } = useArtists(workspaceId)
  // Base UI's Select.Value only shows the selected item's label automatically
  // when Select.Root is given this value->label map — otherwise it falls
  // back to displaying the raw value (here, the numeric artist id).
  const artistItems = Object.fromEntries((artists ?? []).map((artist) => [String(artist.id), artist.name]))
  const createEpk = useCreateEpk(workspaceId)
  const updateEpk = useUpdateEpk(workspaceId)
  const isEditing = !!epk

  const form = useForm<EpkFormValues>({
    resolver: zodResolver(createEpkFormSchema(t)),
    defaultValues: {
      title: epk?.title ?? '',
      artist_id: epk?.artist?.id ?? 0,
      seo_title: epk?.seo_title ?? '',
      seo_description: epk?.seo_description ?? '',
    },
  })

  // Reset only when the dialog opens, not on every render: using RHF's
  // `values` option here (instead of `defaultValues` + this effect) resynced
  // the form from a fresh object literal on every re-render — including the
  // one triggered by creating a new artist inline — silently wiping the
  // artist_id the user had just set back to its initial value.
  useEffect(() => {
    if (open) {
      form.reset({
        title: epk?.title ?? '',
        artist_id: epk?.artist?.id ?? 0,
        seo_title: epk?.seo_title ?? '',
        seo_description: epk?.seo_description ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      title: values.title,
      artist_id: values.artist_id,
      seo_title: values.seo_title || undefined,
      seo_description: values.seo_description || undefined,
    }

    const mutation = isEditing
      ? updateEpk.mutateAsync({ epkId: epk.id, payload })
      : createEpk.mutateAsync({ workspace_id: workspaceId, ...payload })

    mutation
      .then(() => {
        toast.success(isEditing ? t('epks.toasts.updated') : t('epks.toasts.created'))
        setOpen(false)
        if (!isEditing) form.reset()
      })
      .catch(() => toast.error(isEditing ? t('epks.toasts.updateError') : t('epks.toasts.createError')))
  })

  const isPending = createEpk.isPending || updateEpk.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('epks.formDialog.editTitle') : t('epks.formDialog.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('epks.formDialog.editDescription') : t('epks.formDialog.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('epks.fields.title')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('epks.fields.titlePlaceholder')} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="artist_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('epks.fields.artist')}</FormLabel>
                  <div className="flex gap-2">
                    {/* value is always a defined string (never undefined) so the
                        Select doesn't flip between uncontrolled and controlled
                        as artist_id goes from its 0 sentinel to a real id. */}
                    <Select
                      items={artistItems}
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('epks.fields.selectArtist')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {artists?.map((artist) => (
                          <SelectItem key={artist.id} value={String(artist.id)}>
                            {artist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ArtistQuickCreateDialog
                      workspaceId={workspaceId}
                      trigger={
                        <Button type="button" variant="outline" size="icon">
                          <Plus className="size-4" />
                        </Button>
                      }
                      onCreated={(artist) => field.onChange(artist.id)}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seo_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('epks.fields.seoTitle')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('epks.fields.seoTitlePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? t('common.save') : t('epks.formDialog.submitCreate')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
