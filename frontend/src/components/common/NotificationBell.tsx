import { Bell, Loader2, Sparkles, UserPlus, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/features/notifications/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types'

/**
 * Shared shell every notification kind renders into — icon, text, relative
 * timestamp, unread dot — so adding a new kind below only means providing
 * its icon/text/destination, not re-implementing the row's look.
 */
function NotificationRowShell({
  icon,
  isUnread,
  createdAt,
  children,
  ...linkProps
}: {
  icon: ReactNode
  isUnread: boolean
  createdAt: string
  children: ReactNode
} & (
  | { to: string; href?: never; onClick?: () => void }
  | { href: string; to?: never; onClick?: () => void }
)) {
  const { i18n } = useTranslation()

  const content = (
    <>
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">{icon}</div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground">{children}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(createdAt, i18n.resolvedLanguage ?? 'en')}</p>
      </div>
      {isUnread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
    </>
  )

  const className = cn(
    'flex gap-3 rounded-md px-2 py-2.5 text-start text-sm outline-none transition-colors hover:bg-muted',
    isUnread && 'bg-primary/5'
  )

  if (linkProps.to) {
    return (
      <Link to={linkProps.to} onClick={linkProps.onClick} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <a href={linkProps.href} target="_blank" rel="noreferrer" onClick={linkProps.onClick} className={className}>
      {content}
    </a>
  )
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const { t } = useTranslation()
  const markAsRead = useMarkNotificationAsRead()
  const isUnread = notification.read_at === null
  const onOpen = () => {
    if (isUnread) markAsRead.mutate(notification.id)
  }

  switch (notification.kind) {
    case 'workspace_invitation': {
      const { workspace_name, role, inviter_name, invite_token } = notification.payload
      return (
        <NotificationRowShell
          icon={<Users className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to={`/invitations/${invite_token}`}
          onClick={onOpen}
        >
          {inviter_name
            ? t('notifications.invitedByBlurb', { inviter: inviter_name, workspace: workspace_name, role: t(`common.roles.${role}`) })
            : t('notifications.invitedBlurb', { workspace: workspace_name, role: t(`common.roles.${role}`) })}
        </NotificationRowShell>
      )
    }

    case 'epk_published': {
      const { epk_title, publisher_name, public_url } = notification.payload
      return (
        <NotificationRowShell
          icon={<Sparkles className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          href={public_url}
          onClick={onOpen}
        >
          {publisher_name
            ? t('notifications.epkPublishedByBlurb', { publisher: publisher_name, epk: epk_title })
            : t('notifications.epkPublishedBlurb', { epk: epk_title })}
        </NotificationRowShell>
      )
    }

    case 'team_member_joined': {
      const { workspace_name, member_name, member_role } = notification.payload
      return (
        <NotificationRowShell
          icon={<UserPlus className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to="/team"
          onClick={onOpen}
        >
          {t('notifications.teamMemberJoinedBlurb', {
            member: member_name ?? t('notifications.someone'),
            workspace: workspace_name,
            role: t(`common.roles.${member_role}`),
          })}
        </NotificationRowShell>
      )
    }

    default:
      // Forward-compat: a notification kind this frontend build doesn't
      // know about yet (e.g. an older deployed frontend against a newer
      // backend) is skipped rather than crashing the whole dropdown.
      return null
  }
}

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
