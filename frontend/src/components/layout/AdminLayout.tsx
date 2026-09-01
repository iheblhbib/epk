import { ArrowLeft, FileStack, Gauge, ScrollText, Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { NotificationBell } from '@/components/common/NotificationBell'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { cn } from '@/lib/utils'

const ADMIN_NAV_ITEMS = [
  { to: '/admin', labelKey: 'admin.nav.dashboard', icon: Gauge, end: true },
  { to: '/admin/users', labelKey: 'admin.nav.users', icon: Users, end: false },
  { to: '/admin/workspaces', labelKey: 'admin.nav.workspaces', icon: UsersRound, end: false },
  { to: '/admin/epks', labelKey: 'admin.nav.epks', icon: FileStack, end: false },
  { to: '/admin/audit-log', labelKey: 'admin.nav.auditLog', icon: ScrollText, end: false },
] as const

export function AdminLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary font-heading text-sm font-semibold text-primary-foreground">
            K
          </div>
          <span className="font-heading text-sm font-semibold text-sidebar-foreground">{t('nav.admin')}</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {ADMIN_NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="size-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <nav className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('admin.nav.backToApp')}
          </NavLink>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border px-4 sm:px-6">
          <NotificationBell />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
