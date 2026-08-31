import { Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TFunction } from 'i18next'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAdminWorkspaces, useDeleteAdminWorkspace, useUpdateAdminWorkspacePlan } from '@/features/admin/hooks/useAdmin'
import type { AdminWorkspace, SubscriptionPlan } from '@/types'

function planItems(t: TFunction): Record<SubscriptionPlan, string> {
  return { free: t('admin.workspaces.planFree'), pro: t('admin.workspaces.planPro'), business: t('admin.workspaces.planBusiness') }
}

function WorkspaceRow({ workspace }: { workspace: AdminWorkspace }) {
  const { t } = useTranslation()
  const deleteWorkspace = useDeleteAdminWorkspace()
  const updatePlan = useUpdateAdminWorkspacePlan()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const items = planItems(t)

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{workspace.name}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.creator?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.members_count}</TableCell>
      <TableCell className="text-muted-foreground">{workspace.epks_count}</TableCell>
      <TableCell>
        <Select
          items={items}
          value={workspace.plan ?? 'free'}
          onValueChange={(value) =>
            updatePlan.mutate(
              { workspaceId: workspace.id, plan: value as SubscriptionPlan },
              {
                onSuccess: () => toast.success(t('admin.workspaces.planUpdated', { plan: items[value as SubscriptionPlan] })),
                onError: () => toast.error(t('admin.workspaces.planUpdateError')),
              }
            )
          }
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(items).map(([value, label]) => (
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
        title={t('settings.dangerZone.delete')}
        description={t('settings.dangerZone.deleteDialogDescription', { workspace: workspace.name })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteWorkspace.isPending}
        onConfirm={() =>
          deleteWorkspace.mutate(workspace.id, {
            onSuccess: () => {
              setConfirmOpen(false)
              toast.success(t('admin.workspaces.deleted'))
            },
            onError: () => toast.error(t('admin.workspaces.deleteError')),
          })
        }
      />
    </TableRow>
  )
}

export function AdminWorkspacesPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminWorkspaces({ search: search || undefined, page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('admin.workspaces.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.workspaces.description')}</p>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('admin.workspaces.searchPlaceholder')}
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
                  <TableHead>{t('admin.workspaces.columns.name')}</TableHead>
                  <TableHead>{t('admin.workspaces.columns.owner')}</TableHead>
                  <TableHead>{t('admin.workspaces.columns.members')}</TableHead>
                  <TableHead>{t('admin.workspaces.columns.epks')}</TableHead>
                  <TableHead>{t('admin.workspaces.columns.plan')}</TableHead>
                  <TableHead>{t('admin.workspaces.columns.created')}</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
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
