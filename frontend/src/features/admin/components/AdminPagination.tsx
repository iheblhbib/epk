import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function AdminPagination({
  page,
  lastPage,
  total,
  onPageChange,
}: {
  page: number
  lastPage: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()

  if (lastPage <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <p>{t('admin.pagination.total', { count: total })}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t('admin.pagination.previous')}
        </Button>
        <span>{t('admin.pagination.pageOf', { page, lastPage })}</span>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          {t('admin.pagination.next')}
        </Button>
      </div>
    </div>
  )
}
