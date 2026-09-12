import { UserPlus, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { formatRelativeTime } from '@/lib/relativeTime'
import { useAdminActivity } from '@/features/admin/hooks/useAdmin'
import type { AdminActivityEntry } from '@/types'

function ActivityRow({ entry }: { entry: AdminActivityEntry }) {
  const { t, i18n } = useTranslation()
  const isSignup = entry.kind === 'user_signed_up'

  return (
    <div className="flex gap-3 rounded-md px-2 py-2.5 text-sm">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {isSignup ? <UserPlus className="size-4 text-primary" /> : <UsersRound className="size-4 text-primary" />}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground">
          {isSignup
            ? t('admin.dashboard.activity.signedUp', { name: entry.label })
            : t('admin.dashboard.activity.workspaceCreated', { name: entry.label, creator: entry.detail ?? t('notifications.someone') })}
        </p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(entry.created_at, i18n.resolvedLanguage ?? 'en')}</p>
      </div>
    </div>
  )
}

export function AdminActivityFeed() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useAdminActivity()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.dashboard.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.activity.error')}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.activity.empty')}</p>
        ) : (
          <div className="space-y-1">
            {data.map((entry, index) => (
              <ActivityRow key={`${entry.kind}-${entry.created_at}-${index}`} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
