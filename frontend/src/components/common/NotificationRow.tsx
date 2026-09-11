import { BarChart3, Eye, FileText, ShieldAlert, Sparkles, TrendingUp, UserCheck, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useMarkNotificationAsRead } from '@/features/notifications/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types'

/**
 * Shared shell every notification kind renders into — icon, text, relative
 * timestamp, unread dot — so adding a new kind below only means providing
 * its icon/text/destination, not re-implementing the row's look.
 */
export function NotificationRowShell({
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

export function NotificationRow({ notification }: { notification: AppNotification }) {
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

    case 'private_link_opened': {
      const { epk_id, epk_title, private_link_label, country } = notification.payload
      return (
        <NotificationRowShell
          icon={<Eye className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to={`/epks/${epk_id}/builder`}
          onClick={onOpen}
        >
          {t('notifications.privateLinkOpenedBlurb', {
            epk: epk_title,
            link: private_link_label ?? t('notifications.aPrivateLink'),
            context: country ? ` (${country})` : '',
          })}
        </NotificationRowShell>
      )
    }

    case 'invitation_accepted': {
      const { workspace_name, member_name, member_role } = notification.payload
      return (
        <NotificationRowShell
          icon={<UserCheck className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to="/team"
          onClick={onOpen}
        >
          {t('notifications.invitationAcceptedBlurb', {
            member: member_name ?? t('notifications.someone'),
            workspace: workspace_name,
            role: t(`common.roles.${member_role}`),
          })}
        </NotificationRowShell>
      )
    }

    case 'member_role_changed': {
      const { workspace_name, new_role, changed_by_name } = notification.payload
      return (
        <NotificationRowShell
          icon={<ShieldAlert className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to="/team"
          onClick={onOpen}
        >
          {changed_by_name
            ? t('notifications.memberRoleChangedByBlurb', {
                changer: changed_by_name,
                workspace: workspace_name,
                role: t(`common.roles.${new_role}`),
              })
            : t('notifications.memberRoleChangedBlurb', {
                workspace: workspace_name,
                role: t(`common.roles.${new_role}`),
              })}
        </NotificationRowShell>
      )
    }

    case 'draft_reminder': {
      const { epk_id, epk_title } = notification.payload
      return (
        <NotificationRowShell
          icon={<FileText className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to={`/epks/${epk_id}/builder`}
          onClick={onOpen}
        >
          {t('notifications.draftReminderBlurb', { epk: epk_title })}
        </NotificationRowShell>
      )
    }

    case 'view_milestone': {
      const { epk_id, epk_title, milestone } = notification.payload
      return (
        <NotificationRowShell
          icon={<TrendingUp className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to={`/epks/${epk_id}/builder`}
          onClick={onOpen}
        >
          {t('notifications.viewMilestoneBlurb', { epk: epk_title, count: milestone })}
        </NotificationRowShell>
      )
    }

    case 'weekly_digest': {
      const { workspace_name, page_views } = notification.payload
      return (
        <NotificationRowShell
          icon={<BarChart3 className="size-4 text-primary" />}
          isUnread={isUnread}
          createdAt={notification.created_at}
          to="/analytics"
          onClick={onOpen}
        >
          {t('notifications.weeklyDigestBlurb', { workspace: workspace_name, count: page_views })}
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
