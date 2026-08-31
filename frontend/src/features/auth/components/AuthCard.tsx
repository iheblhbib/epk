import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary font-heading text-base font-semibold text-primary-foreground">
              K
            </div>
            <span className="font-heading text-lg font-semibold text-foreground">KORAX</span>
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
