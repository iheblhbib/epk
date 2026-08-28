import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ReactElement, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { useCreateContact, useUpdateContact } from '@/features/contacts/hooks/useContacts'
import { contactFormSchema, type ContactFormValues } from '@/features/contacts/schemas/contactSchemas'
import type { Contact } from '@/types'

export const CATEGORY_ITEMS: Record<ContactFormValues['category'], string> = {
  journalist: 'Journalist',
  radio: 'Radio',
  blog: 'Blog',
  label: 'Label',
  booking: 'Booking',
  management: 'Management',
  pr: 'PR',
  other: 'Other',
}

type ContactFormDialogProps = {
  workspaceId: number
  contact?: Contact
} & (
  | { trigger: ReactElement; open?: never; onOpenChange?: never }
  | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
)

export function ContactFormDialog({
  workspaceId,
  contact,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ContactFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = setControlledOpen ?? setInternalOpen
  const createContact = useCreateContact(workspaceId)
  const updateContact = useUpdateContact(workspaceId)
  const isEditing = !!contact

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      category: contact?.category ?? 'other',
      organization: contact?.organization ?? '',
      notes: contact?.notes ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: contact?.name ?? '',
        email: contact?.email ?? '',
        phone: contact?.phone ?? '',
        category: contact?.category ?? 'other',
        organization: contact?.organization ?? '',
        notes: contact?.notes ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      category: values.category,
      organization: values.organization || undefined,
      notes: values.notes || undefined,
    }

    const mutation = isEditing
      ? updateContact.mutateAsync({ contactId: contact.id, payload })
      : createContact.mutateAsync(payload)

    mutation
      .then(() => {
        toast.success(isEditing ? 'Contact updated' : 'Contact added')
        setOpen(false)
        if (!isEditing) form.reset()
      })
      .catch(() => toast.error(isEditing ? 'Could not update the contact' : 'Could not add the contact'))
  })

  const isPending = createContact.isPending || updateContact.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>
            Journalists, radio, blogs, labels, and anyone else you work with on press and promo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Critic" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jane@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select items={CATEGORY_ITEMS} value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CATEGORY_ITEMS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <FormControl>
                      <Input placeholder="Music Weekly" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? 'Save changes' : 'Add contact'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
