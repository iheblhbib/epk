import { Copy, Layers, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EpkFormDialog } from '@/features/epks/components/EpkFormDialog'
import {
  useDeleteEpk,
  useDuplicateEpk,
  usePublishEpk,
  useUnpublishEpk,
} from '@/features/epks/hooks/useEpks'
import { isAdminLevel, isEditorLevel } from '@/lib/permissions'
import type { Epk, EpkStatus, WorkspaceRole } from '@/types'

const STATUS_LABEL: Record<EpkStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_VARIANT: Record<EpkStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
}

export function EpkCard({
  epk,
  workspaceId,
  myRole,
}: {
  epk: Epk
  workspaceId: number
  myRole: WorkspaceRole | null
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const duplicateEpk = useDuplicateEpk(workspaceId)
  const publishEpk = usePublishEpk(workspaceId)
  const unpublishEpk = useUnpublishEpk(workspaceId)
  const deleteEpk = useDeleteEpk(workspaceId)
  const canEdit = isEditorLevel(myRole)
  const canDelete = isAdminLevel(myRole)

  const togglePublish = (checked: boolean) => {
    const mutation = checked ? publishEpk : unpublishEpk
    mutation.mutate(epk.id, {
      onSuccess: () => toast.success(checked ? 'EPK published' : 'EPK unpublished'),
      onError: () => toast.error('Could not update the EPK status'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 font-heading text-base">{epk.title}</CardTitle>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() =>
                      duplicateEpk.mutate(epk.id, {
                        onSuccess: () => toast.success('EPK duplicated'),
                        onError: () => toast.error('Could not duplicate the EPK'),
                      })
                    }
                  >
                    <Copy className="size-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{epk.artist?.name ?? 'No artist'}</p>
        <Badge variant={STATUS_VARIANT[epk.status]}>{STATUS_LABEL[epk.status]}</Badge>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        {canEdit ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={epk.status === 'published'}
              disabled={publishEpk.isPending || unpublishEpk.isPending || epk.status === 'archived'}
              onCheckedChange={togglePublish}
            />
            Published
            {(publishEpk.isPending || unpublishEpk.isPending) && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
          </label>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link to={`/epks/${epk.id}/builder`} />}
        >
          <Layers className="size-4" />
          Builder
        </Button>
      </CardFooter>

      <EpkFormDialog workspaceId={workspaceId} epk={epk} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete EPK"
        description={`"${epk.title}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteEpk.isPending}
        onConfirm={() =>
          deleteEpk.mutate(epk.id, {
            onSuccess: () => {
              toast.success('EPK deleted')
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error('Could not delete the EPK'),
          })
        }
      />
    </Card>
  )
}
