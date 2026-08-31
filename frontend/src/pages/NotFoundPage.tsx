import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <p className="font-heading text-6xl font-semibold text-foreground">404</p>
      <p className="text-sm text-muted-foreground">{t('notFound.description')}</p>
      <Button nativeButton={false} render={<Link to="/" />}>
        {t('notFound.backToDashboard')}
      </Button>
    </div>
  )
}
