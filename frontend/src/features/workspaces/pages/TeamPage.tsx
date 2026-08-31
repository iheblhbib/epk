import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MoreHorizontal, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import {
  useInviteWorkspaceMember,
  useRemoveWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useWorkspaceMembers,
} from '@/features/workspaces/hooks/useWorkspaces'
import type { WorkspaceMember, WorkspaceRole } from '@/types'

const ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer']

// Base UI's Select.Value only shows the selected item's label automatically
// when Select.Root is given this value->label map — otherwise it falls back
// to displaying the raw value.
function roleItems(t: TFunction) {
  return Object.fromEntries(ROLES.map((role) => [role, t(`common.roles.${role}`)]))
}

function inviteSchema(t: TFunction) {
  return z.object({
    email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
    role: z.enum(['admin', 'editor', 'viewer']),
  })
}

function InviteDialog({ workspaceId }: { workspaceId: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const invite = useInviteWorkspaceMember(workspaceId)
  const items = roleItems(t)

  const form = useForm<z.infer<ReturnType<typeof inviteSchema>>>({
    resolver: zodResolver(inviteSchema(t)),
    defaultValues: { email: '', role: 'editor' },
  })

  const onSubmit = form.handleSubmit((values) => {
    invite.mutate(values, {
      onSuccess: () => {
        toast.success(t('team.toasts.invited'))
        setOpen(false)
        form.reset()
      },
      onError: () => toast.error(t('team.toasts.inviteError')),
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><UserPlus className="size-4" />{t('team.inviteButton')}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('team.inviteDialog.title')}</DialogTitle>
          <DialogDescription>{t('team.inviteDialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.fields.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="teammate@example.com" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.fields.role')}</FormLabel>
                  <Select items={items} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {items[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('team.inviteDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({
  member,
  workspaceId,
  canManage,
}: {
  member: WorkspaceMember
  workspaceId: number
  canManage: boolean
}) {
  const { t } = useTranslation()
  const updateRole = useUpdateWorkspaceMemberRole(workspaceId)
  const removeMember = useRemoveWorkspaceMember(workspaceId)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const items = roleItems(t)

  const displayName = member.user?.name ?? member.email
  const isOwner = member.role === 'owner'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {member.status === 'pending' && (
          <Badge variant="outline" className="text-muted-foreground">
            {t('team.pending')}
          </Badge>
        )}

        {canManage && !isOwner ? (
          <Select
            items={items}
            value={member.role}
            onValueChange={(role) =>
              updateRole.mutate(
                { memberId: member.id, role: role as WorkspaceRole },
                { onError: () => toast.error(t('team.toasts.roleError')) }
              )
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {items[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary" className="capitalize">
            {t(`common.roles.${member.role}`)}
          </Badge>
        )}

        {canManage && !isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setConfirmRemoveOpen(true)}
                className="text-destructive"
              >
                {t('team.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title={t('team.removeDialog.title')}
        description={t('team.removeDialog.description', { name: displayName })}
        confirmLabel={t('team.remove')}
        destructive
        isLoading={removeMember.isPending}
        onConfirm={() =>
          removeMember.mutate(member.id, {
            onSuccess: () => setConfirmRemoveOpen(false),
            onError: () => toast.error(t('team.toasts.removeError')),
          })
        }
      />
    </div>
  )
}

export function TeamPage() {
  const { t } = useTranslation()
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: members, isLoading } = useWorkspaceMembers(currentWorkspace?.id)

  if (workspaceLoading) {
    return <LoadingSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Users}
        title={t('common.noWorkspaceYet')}
        description={t('team.emptyState.noWorkspaceDescription')}
      />
    )
  }

  const canManage = currentWorkspace.my_role === 'owner' || currentWorkspace.my_role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.team')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('team.pageDescription', { workspace: currentWorkspace.name })}
          </p>
        </div>
        {canManage && <InviteDialog workspaceId={currentWorkspace.id} />}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !members || members.length === 0 ? (
        <EmptyState icon={Users} title={t('team.emptyState.noneTitle')} description={t('team.emptyState.noneDescription')} />
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              workspaceId={currentWorkspace.id}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
