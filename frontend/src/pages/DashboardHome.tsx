import { Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { EpkFormDialog } from '@/features/epks/components/EpkFormDialog'
import { useEpks } from '@/features/epks/hooks/useEpks'
import { CreateWorkspaceDialog } from '@/features/workspaces/components/CreateWorkspaceDialog'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { useAuth } from '@/providers/AuthProvider'

export function DashboardHome() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { currentWorkspace, isLoading, setCurrentWorkspaceId } = useCurrentWorkspace()
  const { data: epks } = useEpks(currentWorkspace?.id)
  const firstName = user?.name.split(' ')[0]

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Sparkles}
        title={firstName ? t('dashboard.welcomeWithName', { name: firstName }) : t('dashboard.welcome')}
        description={t('dashboard.noWorkspaceDescription')}
        action={
          <CreateWorkspaceDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                {t('dashboard.createFirstWorkspace')}
              </Button>
            }
            onCreated={setCurrentWorkspaceId}
          />
        }
      />
    )
  }

  const stats = [
    { label: t('dashboard.stats.totalEpks'), value: String(epks?.length ?? 0) },
    { label: t('dashboard.stats.publishedEpks'), value: String(epks?.filter((epk) => epk.status === 'published').length ?? 0) },
    { label: t('dashboard.stats.totalViews'), value: '0' },
    { label: t('dashboard.stats.downloads'), value: '0' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {firstName ? t('dashboard.welcomeBackWithName', { name: firstName }) : t('dashboard.welcomeBack')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.whatsHappening', { workspace: currentWorkspace.name })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-heading text-2xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {epks?.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title={t('epks.emptyState.noneTitle')}
          description={t('epks.emptyState.canEditDescription')}
          action={
            <EpkFormDialog
              workspaceId={currentWorkspace.id}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  {t('dashboard.createFirstEpk')}
                </Button>
              }
            />
          }
        />
      )}
    </div>
  )
}
