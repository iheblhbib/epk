import {
  BarChart3,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/epks', label: 'My EPKs', icon: Sparkles },
  { to: '/media', label: 'Media Library', icon: FolderOpen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/team', label: 'Team', icon: UsersRound },
] as const

const FOOTER_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/billing', label: 'Billing', icon: CreditCard },
] as const

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}

/**
 * The actual nav content, shared between the persistent desktop sidebar and
 * the mobile Sheet — `onNavigate` closes the sheet when a link is clicked.
 */
export function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()

  return (
    <>
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary font-heading text-sm font-semibold text-primary-foreground">
          K
        </div>
        <span className="font-heading text-sm font-semibold text-sidebar-foreground">Kitfolio</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <nav className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        {user?.role === 'admin' && (
          <NavItem to="/admin" label="Admin" icon={ShieldCheck} onNavigate={onNavigate} />
        )}
        {FOOTER_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar px-3 py-4 md:flex">
      <SidebarNavContent />
    </aside>
  )
}
