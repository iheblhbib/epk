import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { NotificationRow } from '@/components/common/NotificationRow'
import { useWorkspaceActivity } from '@/features/notifications/hooks/useNotifications'

export function DashboardActivityFeed({ workspaceId }: { workspaceId: number }) {
  const { t } = useTranslation()
  const { data, isLoading } = useWorkspaceActivity(workspaceId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.activity.empty')}</p>
        ) : (
          <div className="space-y-1">
            {data.data.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
