import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ReactElement, useState } from 'react'
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
import { useCreateArtist } from '@/features/epks/hooks/useArtists'
import { createArtistFormSchema, type ArtistFormValues } from '@/features/epks/schemas/epkSchemas'
import { COUNTRIES } from '@/lib/countries'
import type { Artist } from '@/types'

const COUNTRY_ITEMS = Object.fromEntries(COUNTRIES.map((country) => [country, country]))

export function ArtistQuickCreateDialog({
  workspaceId,
  trigger,
  onCreated,
}: {
  workspaceId: number
  /** Always a real <button> (e.g. the "+" icon button) — see EpkFormDialog's
   * controlled mode for the pattern used when a trigger isn't a real button. */
  trigger: ReactElement
  onCreated: (artist: Artist) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const createArtist = useCreateArtist(workspaceId)

  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(createArtistFormSchema(t)),
    defaultValues: { name: '', genre: '', country: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    createArtist.mutate(
      { name: values.name, genre: values.genre || undefined, country: values.country || undefined },
      {
        onSuccess: (artist) => {
          toast.success(t('epks.artistDialog.toastCreated'))
          onCreated(artist)
          setOpen(false)
          form.reset()
        },
        onError: () => toast.error(t('epks.artistDialog.toastError')),
      }
    )
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('epks.artistDialog.title')}</DialogTitle>
          <DialogDescription>{t('epks.artistDialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('epks.fields.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('epks.fields.namePlaceholder')} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="genre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('epks.fields.genre')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('epks.fields.genrePlaceholder')} {...field} />
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
                  <FormLabel>{t('epks.fields.country')}</FormLabel>
                  {/* value is always a defined string (never undefined) so the
                      Select doesn't flip between uncontrolled and controlled. */}
                  <Select items={COUNTRY_ITEMS} value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('epks.fields.selectCountry')} />
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
            <DialogFooter>
              <Button type="submit" disabled={createArtist.isPending}>
                {createArtist.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('epks.artistDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
