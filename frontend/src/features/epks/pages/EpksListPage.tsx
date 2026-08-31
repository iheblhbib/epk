import { Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { EpkCard } from '@/features/epks/components/EpkCard'
import { EpkFormDialog } from '@/features/epks/components/EpkFormDialog'
import { useEpks } from '@/features/epks/hooks/useEpks'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { isEditorLevel } from '@/lib/permissions'

export function EpksListPage() {
  const { t } = useTranslation()
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
        title={t('common.noWorkspaceYet')}
        description={t('epks.emptyState.noWorkspaceDescription')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.myEpks')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('epks.pageDescription', { workspace: currentWorkspace.name })}
          </p>
        </div>
        {canEdit && (
          <EpkFormDialog
            workspaceId={currentWorkspace.id}
            trigger={
              <Button>
                <Plus className="size-4" />
                {t('epks.formDialog.submitCreate')}
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
          title={t('epks.emptyState.noneTitle')}
          description={canEdit ? t('epks.emptyState.canEditDescription') : t('epks.emptyState.viewOnlyDescription')}
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
