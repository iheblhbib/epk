import { Mic2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArtistFormDialog } from '@/features/artists/components/ArtistFormDialog'
import { useArtists, useDeleteArtist } from '@/features/epks/hooks/useArtists'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { isAdminLevel, isEditorLevel } from '@/lib/permissions'
import type { Artist, WorkspaceRole } from '@/types'

function ArtistRow({
  workspaceId,
  artist,
  myRole,
}: {
  workspaceId: number
  artist: Artist
  myRole: WorkspaceRole | null
}) {
  const { t } = useTranslation()
  const deleteArtist = useDeleteArtist(workspaceId)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const canEdit = isEditorLevel(myRole)
  const canDelete = isAdminLevel(myRole)
  const location = [artist.city, artist.country].filter(Boolean).join(', ')

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        {artist.name}
        {artist.stage_name && <span className="ms-2 text-muted-foreground">“{artist.stage_name}”</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">{artist.genre || '—'}</TableCell>
      <TableCell className="text-muted-foreground">{location || '—'}</TableCell>
      <TableCell>
        <Badge variant="secondary">{t('artists.epkCount', { count: artist.epks_count ?? 0 })}</Badge>
      </TableCell>
      <TableCell className="text-end">
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
              {canDelete && (
                <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive">
                  <Trash2 className="size-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>

      <ArtistFormDialog workspaceId={workspaceId} artist={artist} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('artists.deleteDialog.title')}
        description={t('artists.deleteDialog.description', { name: artist.name })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteArtist.isPending}
        onConfirm={() =>
          deleteArtist.mutate(artist.id, {
            onSuccess: () => {
              toast.success(t('artists.toasts.deleted'))
              setConfirmDeleteOpen(false)
            },
            onError: (error) => {
              // The backend blocks deleting an artist that still has EPKs;
              // surface that specific message rather than a generic failure.
              const message =
                (error as { response?: { data?: { errors?: { artist?: string[] } } } }).response?.data?.errors
                  ?.artist?.[0] ?? t('artists.toasts.deleteError')
              toast.error(message)
              setConfirmDeleteOpen(false)
            },
          })
        }
      />
    </TableRow>
  )
}

export function ArtistsPage() {
  const { t } = useTranslation()
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: artists, isLoading } = useArtists(currentWorkspace?.id)
  const canEdit = isEditorLevel(currentWorkspace?.my_role)

  if (workspaceLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Mic2}
        title={t('common.noWorkspaceYet')}
        description={t('artists.emptyState.noWorkspaceDescription')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.artists')}</h1>
          <p className="text-sm text-muted-foreground">{t('artists.pageDescription')}</p>
        </div>
        {canEdit && (
          <ArtistFormDialog
            workspaceId={currentWorkspace.id}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                {t('artists.dialog.addTitle')}
              </Button>
            }
          />
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : !artists || artists.length === 0 ? (
        <EmptyState
          icon={Mic2}
          title={t('artists.emptyState.noneTitle')}
          description={canEdit ? t('artists.emptyState.canEditDescription') : t('artists.emptyState.viewOnlyDescription')}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('artists.fields.name')}</TableHead>
                <TableHead>{t('artists.fields.genre')}</TableHead>
                <TableHead>{t('artists.fields.location')}</TableHead>
                <TableHead>{t('artists.fields.epks')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artists.map((artist) => (
                <ArtistRow
                  key={artist.id}
                  workspaceId={currentWorkspace.id}
                  artist={artist}
                  myRole={currentWorkspace.my_role}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
