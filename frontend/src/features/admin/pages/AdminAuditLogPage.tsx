import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAuditLogs } from '@/features/admin/hooks/useAdmin'

export function AdminAuditLogPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAuditLogs({ page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('admin.nav.auditLog')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.auditLog.description')}</p>
      </div>

      {isLoading || !data ? (
        <CardGridSkeleton />
      ) : data.data.length === 0 ? (
        <EmptyState icon={ScrollText} title={t('admin.auditLog.noneTitle')} description={t('admin.auditLog.noneDescription')} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.auditLog.columns.action')}</TableHead>
                  <TableHead>{t('admin.auditLog.columns.admin')}</TableHead>
                  <TableHead>{t('admin.auditLog.columns.subject')}</TableHead>
                  <TableHead>{t('admin.auditLog.columns.ipAddress')}</TableHead>
                  <TableHead>{t('admin.auditLog.columns.when')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.user?.name ?? t('admin.auditLog.system')}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.subject_type ? `${log.subject_type} #${log.subject_id}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            page={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
