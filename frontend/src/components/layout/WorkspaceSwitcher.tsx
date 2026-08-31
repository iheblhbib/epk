import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
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
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { useCreateWorkspace } from '@/features/workspaces/hooks/useWorkspaces'

function createWorkspaceSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('workspaces.create.nameRequired')).max(255),
  })
}

type CreateWorkspaceValues = z.infer<ReturnType<typeof createWorkspaceSchema>>

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useCurrentWorkspace()
  const [createOpen, setCreateOpen] = useState(false)
  const createWorkspace = useCreateWorkspace()

  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema(t)),
    defaultValues: { name: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onSuccess: (workspace) => {
        toast.success(t('workspaces.create.created'))
        setCurrentWorkspaceId(workspace.id)
        setCreateOpen(false)
        form.reset()
      },
      onError: () => toast.error(t('workspaces.create.error')),
    })
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-between font-normal sm:w-56"
            />
          }
        >
          <span className="truncate">{currentWorkspace?.name ?? t('workspaces.selectWorkspace')}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('workspaces.label')}</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setCurrentWorkspaceId(workspace.id)}
              >
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === currentWorkspace?.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('workspaces.newWorkspace')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
    </>
  )
}
