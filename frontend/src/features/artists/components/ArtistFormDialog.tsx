import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useCreateArtist, useUpdateArtist } from '@/features/epks/hooks/useArtists'
import { createArtistFormSchema, type ArtistFormValues } from '@/features/artists/schemas/artistSchemas'
import { COUNTRIES } from '@/lib/countries'
import type { Artist } from '@/types'

const COUNTRY_ITEMS = Object.fromEntries(COUNTRIES.map((country) => [country, country]))

type ArtistFormDialogProps = {
  workspaceId: number
  artist?: Artist
} & (
  | { trigger: ReactElement; open?: never; onOpenChange?: never }
  | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
)

function defaultsFor(artist?: Artist): ArtistFormValues {
  return {
    name: artist?.name ?? '',
    stage_name: artist?.stage_name ?? '',
    genre: artist?.genre ?? '',
    country: artist?.country ?? '',
    city: artist?.city ?? '',
    short_bio: artist?.short_bio ?? '',
    website: artist?.website ?? '',
    booking_email: artist?.booking_email ?? '',
    press_email: artist?.press_email ?? '',
    management_email: artist?.management_email ?? '',
  }
}

export function ArtistFormDialog({
  workspaceId,
  artist,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ArtistFormDialogProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = setControlledOpen ?? setInternalOpen
  const createArtist = useCreateArtist(workspaceId)
  const updateArtist = useUpdateArtist(workspaceId)
  const isEditing = !!artist

  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(createArtistFormSchema(t)),
    defaultValues: defaultsFor(artist),
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(artist))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      stage_name: values.stage_name || undefined,
      genre: values.genre || undefined,
      country: values.country || undefined,
      city: values.city || undefined,
      short_bio: values.short_bio || undefined,
      website: values.website || undefined,
      booking_email: values.booking_email || undefined,
      press_email: values.press_email || undefined,
      management_email: values.management_email || undefined,
    }

    const mutation = isEditing
      ? updateArtist.mutateAsync({ artistId: artist.id, payload })
      : createArtist.mutateAsync(payload)

    mutation
      .then(() => {
        toast.success(isEditing ? t('artists.toasts.updated') : t('artists.toasts.created'))
        setOpen(false)
        if (!isEditing) form.reset(defaultsFor())
      })
      .catch(() => toast.error(isEditing ? t('artists.toasts.updateError') : t('artists.toasts.createError')))
  })

  const isPending = createArtist.isPending || updateArtist.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('artists.dialog.editTitle') : t('artists.dialog.addTitle')}</DialogTitle>
          <DialogDescription>{t('artists.dialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.name')}</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.stageName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.genre')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.country')}</FormLabel>
                    <Select items={COUNTRY_ITEMS} value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('artists.fields.selectCountry')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.city')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="short_bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('artists.fields.shortBio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('artists.fields.website')}</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="booking_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.bookingEmail')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="press_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.pressEmail')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="management_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('artists.fields.managementEmail')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? t('common.save') : t('artists.dialog.addTitle')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
