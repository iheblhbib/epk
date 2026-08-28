import { EyeOff, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAdminEpks, useUnpublishAdminEpk } from '@/features/admin/hooks/useAdmin'
import type { AdminEpk, EpkStatus } from '@/types'

const STATUS_FILTER_ITEMS: Record<'all' | EpkStatus, string> = {
  all: 'All statuses',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_BADGE_VARIANT: Record<EpkStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
}

function EpkRow({ epk }: { epk: AdminEpk }) {
  const unpublish = useUnpublishAdminEpk()

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{epk.title}</TableCell>
      <TableCell className="text-muted-foreground">{epk.workspace?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{epk.artist?.name ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE_VARIANT[epk.status]} className="capitalize">
          {epk.status}
        </Badge>
      </TableCell>
      <TableCell className="text-end">
        {epk.status === 'published' && (
          <Button
            variant="outline"
            size="sm"
            disabled={unpublish.isPending}
            onClick={() =>
              unpublish.mutate(epk.id, {
                onSuccess: () => toast.success(`Unpublished "${epk.title}"`),
                onError: () => toast.error('Could not unpublish this EPK'),
              })
            }
          >
            <EyeOff className="size-4" />
            Unpublish
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

export function AdminEpksPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | EpkStatus>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminEpks({
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    page,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">EPKs</h1>
        <p className="text-sm text-muted-foreground">Every EPK on the platform.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title…"
            className="ps-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          items={STATUS_FILTER_ITEMS}
          value={status}
          onValueChange={(value) => {
            setStatus(value as 'all' | EpkStatus)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <CardGridSkeleton />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((epk) => (
                  <EpkRow key={epk.id} epk={epk} />
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
