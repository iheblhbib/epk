import { LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlobalSearchDialog } from '@/components/common/GlobalSearchDialog'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { NotificationBell } from '@/components/common/NotificationBell'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { useAuth } from '@/providers/AuthProvider'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Topbar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate('/login', { replace: true })
      },
      onError: () => toast.error(t('topbar.logoutError')),
    })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearchDialog />
        <NotificationBell />
        <LanguageSwitcher />
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {user ? initials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate text-sm font-medium">{user?.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="size-4" />
            {t('topbar.settings')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="size-4" />
            {t('topbar.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
