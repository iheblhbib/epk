import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAuditLogs } from '@/features/admin/hooks/useAdmin'

export function AdminAuditLogPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAuditLogs({ page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">Actions taken from this admin panel.</p>
      </div>

      {isLoading || !data ? (
        <CardGridSkeleton />
      ) : data.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Admin actions will show up here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.user?.name ?? 'System'}</TableCell>
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
