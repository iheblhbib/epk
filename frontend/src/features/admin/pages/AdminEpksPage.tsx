import { EyeOff, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TFunction } from 'i18next'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAdminEpks, useUnpublishAdminEpk } from '@/features/admin/hooks/useAdmin'
import type { AdminEpk, EpkStatus } from '@/types'

function statusFilterItems(t: TFunction): Record<'all' | EpkStatus, string> {
  return {
    all: t('admin.epks.allStatuses'),
    draft: t('epks.status.draft'),
    published: t('epks.status.published'),
    archived: t('epks.status.archived'),
  }
}

const STATUS_BADGE_VARIANT: Record<EpkStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
}

const STATUS_LABEL_KEY: Record<EpkStatus, string> = {
  draft: 'epks.status.draft',
  published: 'epks.status.published',
  archived: 'epks.status.archived',
}

function EpkRow({ epk }: { epk: AdminEpk }) {
  const { t } = useTranslation()
  const unpublish = useUnpublishAdminEpk()

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{epk.title}</TableCell>
      <TableCell className="text-muted-foreground">{epk.workspace?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{epk.artist?.name ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE_VARIANT[epk.status]} className="capitalize">
          {t(STATUS_LABEL_KEY[epk.status])}
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
                onSuccess: () => toast.success(t('admin.epks.unpublishedToast', { title: epk.title })),
                onError: () => toast.error(t('admin.epks.unpublishError')),
              })
            }
          >
            <EyeOff className="size-4" />
            {t('admin.epks.unpublish')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

export function AdminEpksPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | EpkStatus>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminEpks({
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    page,
  })
  const filterItems = statusFilterItems(t)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('admin.epks.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.epks.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.epks.searchPlaceholder')}
            className="ps-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          items={filterItems}
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
            {Object.entries(filterItems).map(([value, label]) => (
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
                  <TableHead>{t('epks.fields.title')}</TableHead>
                  <TableHead>{t('admin.epks.columns.workspace')}</TableHead>
                  <TableHead>{t('epks.fields.artist')}</TableHead>
                  <TableHead>{t('admin.users.columns.status')}</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
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
