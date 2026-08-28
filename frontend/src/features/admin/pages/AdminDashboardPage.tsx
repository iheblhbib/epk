import { Eye, FileStack, HardDrive, Users, UsersRound } from 'lucide-react'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { StatTile } from '@/features/analytics/components/StatTile'
import { useAdminStats } from '@/features/admin/hooks/useAdmin'
import { formatBytes } from '@/lib/formatBytes'

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats()

  if (isLoading || !stats) {
    return <CardGridSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide usage at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Total users" value={stats.users.total} />
        <StatTile icon={Users} label="New users (30d)" value={stats.users.new_last_30_days} />
        <StatTile icon={UsersRound} label="Workspaces" value={stats.workspaces.total} />
        <StatTile icon={FileStack} label="Total EPKs" value={stats.epks.total} />
        <StatTile icon={FileStack} label="Published EPKs" value={stats.epks.published} />
        <StatTile icon={Eye} label="Page views (30d)" value={stats.analytics.page_views_last_30_days} />
        <StatTile icon={Users} label="Contacts" value={stats.contacts.total} />
        <StatTile icon={HardDrive} label="Media files" value={stats.media.total} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Storage used</p>
        <p className="mt-2 font-heading text-2xl font-semibold text-foreground">
          {formatBytes(stats.media.storage_bytes)}
        </p>
      </div>
    </div>
  )
}
