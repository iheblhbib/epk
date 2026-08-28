import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <p className="font-heading text-6xl font-semibold text-foreground">404</p>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      <Button nativeButton={false} render={<Link to="/" />}>
        Back to dashboard
      </Button>
    </div>
  )
}
