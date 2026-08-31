import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
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
import { useCreateWorkspace } from '@/features/workspaces/hooks/useWorkspaces'

function createWorkspaceSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('workspaces.create.nameRequired')).max(255),
  })
}

type CreateWorkspaceValues = z.infer<ReturnType<typeof createWorkspaceSchema>>

export function CreateWorkspaceDialog({
  trigger,
  onCreated,
}: {
  /** Always a real <button> — see EpkFormDialog's controlled mode for the
   * pattern used when a trigger isn't a real button (e.g. a menu item). */
  trigger: ReactElement
  onCreated?: (workspaceId: number) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const createWorkspace = useCreateWorkspace()

  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema(t)),
    defaultValues: { name: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onSuccess: (workspace) => {
        toast.success(t('workspaces.create.created'))
        onCreated?.(workspace.id)
        setOpen(false)
        form.reset()
      },
      onError: () => toast.error(t('workspaces.create.error')),
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('workspaces.create.title')}</DialogTitle>
          <DialogDescription>{t('workspaces.create.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('workspaces.create.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Records" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createWorkspace.isPending}>
                {createWorkspace.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('workspaces.create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
