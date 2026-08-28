import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { EpkCard } from '@/features/epks/components/EpkCard'
import { EpkFormDialog } from '@/features/epks/components/EpkFormDialog'
import { useEpks } from '@/features/epks/hooks/useEpks'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { isEditorLevel } from '@/lib/permissions'

export function EpksListPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: epks, isLoading } = useEpks(currentWorkspace?.id)
  const canEdit = isEditorLevel(currentWorkspace?.my_role)

  if (workspaceLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No workspace yet"
        description="Create a workspace from the dashboard before adding EPKs."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">My EPKs</h1>
          <p className="text-sm text-muted-foreground">
            Manage the press kits for {currentWorkspace.name}.
          </p>
        </div>
        {canEdit && (
          <EpkFormDialog
            workspaceId={currentWorkspace.id}
            trigger={
              <Button>
                <Plus className="size-4" />
                Create EPK
              </Button>
            }
          />
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : !epks || epks.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No EPKs yet"
          description={
            canEdit
              ? 'Create your first press kit to get started. The visual builder for sections and theming arrives in a later phase.'
              : 'No press kits have been created in this workspace yet.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {epks.map((epk) => (
            <EpkCard key={epk.id} epk={epk} workspaceId={currentWorkspace.id} myRole={currentWorkspace.my_role} />
          ))}
        </div>
      )}
    </div>
  )
}
