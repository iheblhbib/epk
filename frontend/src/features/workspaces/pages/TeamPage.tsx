import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MoreHorizontal, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
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

const ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

// Base UI's Select.Value only shows the selected item's label automatically
// when Select.Root is given this value->label map — otherwise it falls back
// to displaying the raw value.
const ROLE_ITEMS = Object.fromEntries(ROLES.map((role) => [role.value, role.label]))

const inviteSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
})

function InviteDialog({ workspaceId }: { workspaceId: number }) {
  const [open, setOpen] = useState(false)
  const invite = useInviteWorkspaceMember(workspaceId)

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'editor' },
  })

  const onSubmit = form.handleSubmit((values) => {
    invite.mutate(values, {
      onSuccess: () => {
        toast.success('Invitation sent')
        setOpen(false)
        form.reset()
      },
      onError: () => toast.error('Could not send the invitation'),
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><UserPlus className="size-4" />Invite member</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>They&apos;ll be added as a pending member until they accept.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
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
                  <FormLabel>Role</FormLabel>
                  <Select items={ROLE_ITEMS} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
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
                Send invite
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
  const updateRole = useUpdateWorkspaceMemberRole(workspaceId)
  const removeMember = useRemoveWorkspaceMember(workspaceId)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

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
            Pending
          </Badge>
        )}

        {canManage && !isOwner ? (
          <Select
            items={ROLE_ITEMS}
            value={member.role}
            onValueChange={(role) =>
              updateRole.mutate(
                { memberId: member.id, role: role as WorkspaceRole },
                { onError: () => toast.error('Could not update role') }
              )
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary" className="capitalize">
            {member.role}
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
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remove member"
        description={`${displayName} will lose access to this workspace.`}
        confirmLabel="Remove"
        destructive
        isLoading={removeMember.isPending}
        onConfirm={() =>
          removeMember.mutate(member.id, {
            onSuccess: () => setConfirmRemoveOpen(false),
            onError: () => toast.error('Could not remove this member'),
          })
        }
      />
    </div>
  )
}

export function TeamPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: members, isLoading } = useWorkspaceMembers(currentWorkspace?.id)

  if (workspaceLoading) {
    return <LoadingSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Users}
        title="No workspace yet"
        description="Create a workspace from the dashboard to start inviting teammates."
      />
    )
  }

  const canManage = currentWorkspace.my_role === 'owner' || currentWorkspace.my_role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to {currentWorkspace.name}.
          </p>
        </div>
        {canManage && <InviteDialog workspaceId={currentWorkspace.id} />}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !members || members.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" description="Invite your team to collaborate." />
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
