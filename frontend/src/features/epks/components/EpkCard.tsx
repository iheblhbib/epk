import { Copy, Layers, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

const STATUS_LABEL_KEY: Record<EpkStatus, string> = {
  draft: 'epks.status.draft',
  published: 'epks.status.published',
  archived: 'epks.status.archived',
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
  const { t } = useTranslation()
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
      onSuccess: () => toast.success(checked ? t('epks.toasts.published') : t('epks.toasts.unpublished')),
      onError: () => toast.error(t('epks.toasts.statusError')),
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
                    {t('common.edit')}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() =>
                      duplicateEpk.mutate(epk.id, {
                        onSuccess: () => toast.success(t('epks.toasts.duplicated')),
                        onError: () => toast.error(t('epks.toasts.duplicateError')),
                      })
                    }
                  >
                    <Copy className="size-4" />
                    {t('epks.duplicate')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{epk.artist?.name ?? t('epks.noArtist')}</p>
        <Badge variant={STATUS_VARIANT[epk.status]}>{t(STATUS_LABEL_KEY[epk.status])}</Badge>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        {canEdit ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={epk.status === 'published'}
              disabled={publishEpk.isPending || unpublishEpk.isPending || epk.status === 'archived'}
              onCheckedChange={togglePublish}
            />
            {t('epks.status.published')}
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
          {t('epks.builder')}
        </Button>
      </CardFooter>

      <EpkFormDialog workspaceId={workspaceId} epk={epk} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('epks.deleteDialog.title')}
        description={t('epks.deleteDialog.description', { title: epk.title })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteEpk.isPending}
        onConfirm={() =>
          deleteEpk.mutate(epk.id, {
            onSuccess: () => {
              toast.success(t('epks.toasts.deleted'))
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error(t('epks.toasts.deleteError')),
          })
        }
      />
    </Card>
  )
}
