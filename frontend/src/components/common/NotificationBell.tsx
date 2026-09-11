import { Bell, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useMarkAllNotificationsAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/features/notifications/hooks/useNotifications'
import { NotificationRow } from '@/components/common/NotificationRow'

export function NotificationBell() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data: unreadCount } = useUnreadNotificationCount()
  const { data: notifications, isLoading } = useNotifications(open)
  const markAllAsRead = useMarkAllNotificationsAsRead()

  const hasUnread = (unreadCount ?? 0) > 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="size-4" />
        {hasUnread && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums"
          >
            {unreadCount! > 9 ? '9+' : unreadCount}
          </Badge>
        )}
        <span className="sr-only">{t('notifications.trigger')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="px-1.5 py-1 text-xs font-medium text-muted-foreground">{t('notifications.title')}</span>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1.5 py-1 text-xs"
              disabled={markAllAsRead.isPending}
              onClick={() => markAllAsRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !notifications || notifications.data.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>
          ) : (
            notifications.data.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
