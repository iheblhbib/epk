import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Loader2, LogOut, Plus, Search, Settings } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
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
import { WorkspaceAvatar } from '@/components/layout/WorkspaceAvatar'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import {
  useAcceptInvitation,
  useCreateWorkspace,
  useDeclineInvitation,
  useLeaveWorkspace,
  usePendingInvitations,
} from '@/features/workspaces/hooks/useWorkspaces'
import type { Workspace } from '@/types'

function createWorkspaceSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('workspaces.create.nameRequired')).max(255),
  })
}

type CreateWorkspaceValues = z.infer<ReturnType<typeof createWorkspaceSchema>>

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useCurrentWorkspace()
  const { data: invitations } = usePendingInvitations()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [leaveTarget, setLeaveTarget] = useState<Workspace | null>(null)
  const createWorkspace = useCreateWorkspace()
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()
  const leaveWorkspace = useLeaveWorkspace()

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

  const visibleWorkspaces = search.trim()
    ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(search.trim().toLowerCase()))
    : workspaces

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
        <DropdownMenuContent className="w-64">
          {invitations && invitations.length > 0 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('workspaces.invitations.title')}</DropdownMenuLabel>
                {invitations.map((invitation) => (
                  <div key={invitation.token} className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm">
                    <WorkspaceAvatar id={invitation.workspace.id} name={invitation.workspace.name} logoUrl={null} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate">
                        {t('workspaces.invitations.invitedBy', {
                          name: invitation.invited_by ?? t('notifications.someone'),
                          workspace: invitation.workspace.name,
                          role: t(`common.roles.${invitation.role}`),
                        })}
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={acceptInvitation.isPending}
                          onClick={() =>
                            acceptInvitation.mutate(invitation.token, {
                              onSuccess: () => {
                                toast.success(t('workspaces.invitations.accepted'))
                                setCurrentWorkspaceId(invitation.workspace.id)
                              },
                              onError: () => toast.error(t('workspaces.invitations.acceptError')),
                            })
                          }
                        >
                          {t('workspaces.invitations.accept')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={declineInvitation.isPending}
                          onClick={() =>
                            declineInvitation.mutate(invitation.token, {
                              onError: () => toast.error(t('workspaces.invitations.declineError')),
                            })
                          }
                        >
                          {t('workspaces.invitations.decline')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          {workspaces.length > 5 && (
            <div className="relative px-1.5 pb-1.5">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('workspaces.search.placeholder')}
                className="h-8 ps-7 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                // Base UI's Menu popup applies its own keydown listener
                // (typeahead-to-jump-to-item) with no exemption for a
                // focused form control, so every keystroke here would
                // otherwise be preventDefault()'d before reaching the input.
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('workspaces.label')}</DropdownMenuLabel>
            {visibleWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setCurrentWorkspaceId(workspace.id)}
              >
                <WorkspaceAvatar id={workspace.id} name={workspace.name} logoUrl={workspace.logo_url} />
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.my_role && (
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {t(`common.roles.${workspace.my_role}`)}
                  </Badge>
                )}
                {workspace.id === currentWorkspace?.id && <Check className="size-4 shrink-0" />}
                <button
                  type="button"
                  aria-label={t('workspaces.leave.action')}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpen(false)
                    setLeaveTarget(workspace)
                  }}
                >
                  <LogOut className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('workspaces.newWorkspace')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="size-4" />
            {t('workspaces.settingsLink')}
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

      <ConfirmDialog
        open={leaveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setLeaveTarget(null)
        }}
        title={t('workspaces.leave.confirmTitle')}
        description={leaveTarget ? t('workspaces.leave.confirmDescription', { workspace: leaveTarget.name }) : undefined}
        destructive
        isLoading={leaveWorkspace.isPending}
        confirmLabel={t('workspaces.leave.action')}
        onConfirm={() => {
          if (!leaveTarget) return
          leaveWorkspace.mutate(leaveTarget.id, {
            onSuccess: () => {
              toast.success(t('workspaces.leave.success', { workspace: leaveTarget.name }))
              setLeaveTarget(null)
            },
            onError: () => toast.error(t('workspaces.leave.error')),
          })
        }}
      />
    </>
  )
}
