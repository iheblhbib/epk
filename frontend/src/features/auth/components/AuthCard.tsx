import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Shared across every auth page (login, register, forgot/reset
          password, verify email) since they all render through this card —
          a guest stuck on an English error page has no other way to switch
          languages before they're signed in, and no other way to flip the
          theme before the dashboard's own Topbar exists for them yet. */}
      <div className="absolute end-4 top-4 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link to="/">
            <img src="/brand/lockup-light.png" alt="KORAXX" className="h-12 w-auto dark:hidden" />
            <img src="/brand/lockup-dark.png" alt="KORAXX" className="hidden h-12 w-auto dark:block" />
          </Link>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>

        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
