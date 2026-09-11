import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TopEpkCard({ topEpk }: { topEpk: { id: number; title: string; views: number } }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4 text-primary" />
          {t('dashboard.topEpk.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link to={`/epks/${topEpk.id}/builder`} className="font-heading text-lg font-semibold text-foreground hover:underline">
          {topEpk.title}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.topEpk.viewCount', { count: topEpk.views })}
        </p>
      </CardContent>
    </Card>
  )
}
