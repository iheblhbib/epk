import { Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAdminWorkspaces, useDeleteAdminWorkspace, useUpdateAdminWorkspacePlan } from '@/features/admin/hooks/useAdmin'
import type { AdminWorkspace, SubscriptionPlan } from '@/types'

const PLAN_ITEMS: Record<SubscriptionPlan, string> = { free: 'Free', pro: 'Pro', business: 'Business' }

function WorkspaceRow({ workspace }: { workspace: AdminWorkspace }) {
  const deleteWorkspace = useDeleteAdminWorkspace()
  const updatePlan = useUpdateAdminWorkspacePlan()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{workspace.name}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.creator?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.members_count}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.epks_count}</TableCell>
      <TableCell>
        <Select
          items={PLAN_ITEMS}
          value={workspace.plan ?? 'free'}
          onValueChange={(value) =>
            updatePlan.mutate(
              { workspaceId: workspace.id, plan: value as SubscriptionPlan },
              {
                onSuccess: () => toast.success(`Plan updated to ${PLAN_ITEMS[value as SubscriptionPlan]}`),
                onError: () => toast.error('Could not update the plan'),
              }
            )
          }
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PLAN_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(workspace.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-end">
        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-4" />
        </Button>
      </TableCell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete workspace"
        description={`"${workspace.name}" and everything in it — EPKs, media, contacts — will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteWorkspace.isPending}
        onConfirm={() =>
          deleteWorkspace.mutate(workspace.id, {
            onSuccess: () => {
              setConfirmOpen(false)
              toast.success('Workspace deleted')
            },
            onError: () => toast.error('Could not delete this workspace'),
          })
        }
      />
    </TableRow>
  )
}

export function AdminWorkspacesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminWorkspaces({ search: search || undefined, page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted-foreground">Every workspace on the platform.</p>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          className="ps-8"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {isLoading || !data ? (
        <CardGridSkeleton />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>EPKs</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((workspace) => (
                  <WorkspaceRow key={workspace.id} workspace={workspace} />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            page={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
