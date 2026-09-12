import { Eye, FileStack, HardDrive, Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { StatTile } from '@/features/analytics/components/StatTile'
import { BreakdownCard } from '@/features/analytics/components/BreakdownCard'
import { AdminActivityFeed } from '@/features/admin/components/AdminActivityFeed'
import { AdminGrowthChart } from '@/features/admin/components/AdminGrowthChart'
import { useAdminStats } from '@/features/admin/hooks/useAdmin'
import { formatBytes } from '@/lib/formatBytes'
import { formatEuro } from '@/lib/planPricing'

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useAdminStats()

  if (isLoading || !stats) {
    return <CardGridSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('admin.dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.dashboard.description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Users} label={t('admin.dashboard.totalUsers')} value={stats.users.total} />
        <StatTile icon={Users} label={t('admin.dashboard.newUsers30d')} value={stats.users.new_last_30_days} />
        <StatTile icon={UsersRound} label={t('admin.dashboard.workspaces')} value={stats.workspaces.total} />
        <StatTile icon={FileStack} label={t('admin.dashboard.totalEpks')} value={stats.epks.total} />
        <StatTile icon={FileStack} label={t('admin.dashboard.publishedEpks')} value={stats.epks.published} />
        <StatTile icon={Eye} label={t('admin.dashboard.pageViews30d')} value={stats.analytics.page_views_last_30_days} />
        <StatTile icon={Users} label={t('admin.dashboard.contacts')} value={stats.contacts.total} />
        <StatTile icon={HardDrive} label={t('admin.dashboard.mediaFiles')} value={stats.media.total} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.storageUsed')}</p>
        <p className="mt-2 font-heading text-2xl font-semibold text-foreground">
          {formatBytes(stats.media.storage_bytes)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.mrr')}</CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-2xl font-semibold text-foreground">{formatEuro(stats.billing.mrr)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.trialConversionRate')}</CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-2xl font-semibold text-foreground">{stats.billing.trial_conversion_rate}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.canceledLast30Days')}</CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-2xl font-semibold text-foreground">{stats.billing.canceled_last_30_days}</CardContent>
        </Card>
      </div>

      <BreakdownCard
        title={t('admin.dashboard.billing.activeByPlan')}
        emptyLabel={t('admin.dashboard.growth.empty')}
        rows={[
          { label: t('admin.workspaces.planStarter'), count: stats.billing.active_by_plan.starter },
          { label: t('admin.workspaces.planPro'), count: stats.billing.active_by_plan.pro },
          { label: t('admin.workspaces.planBusiness'), count: stats.billing.active_by_plan.business },
        ]}
      />

      <AdminGrowthChart points={stats.growth} />

      <AdminActivityFeed />
    </div>
  )
}
