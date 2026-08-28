import { Search, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPagination } from '@/features/admin/components/AdminPagination'
import { useAdminUsers, useUpdateAdminUser } from '@/features/admin/hooks/useAdmin'
import { useAuth } from '@/providers/AuthProvider'
import type { AdminUser } from '@/types'

function UserRow({ user }: { user: AdminUser }) {
  const { user: currentUser } = useAuth()
  const updateUser = useUpdateAdminUser()
  const isSelf = user.id === currentUser?.id
  const isSuspended = user.suspended_at !== null

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        {user.name}
        {isSelf && <span className="ms-1.5 text-xs text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
          {user.role}
        </Badge>
      </TableCell>
      <TableCell>
        {isSuspended ? (
          <Badge variant="destructive">Suspended</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Active
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-end">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isSelf || updateUser.isPending}
            onClick={() =>
              updateUser.mutate(
                { userId: user.id, payload: { role: user.role === 'admin' ? 'user' : 'admin' } },
                { onError: () => toast.error('Could not update this user’s role') }
              )
            }
          >
            {user.role === 'admin' ? 'Revoke admin' : 'Make admin'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isSelf || updateUser.isPending}
            onClick={() =>
              updateUser.mutate(
                { userId: user.id, payload: { suspended: !isSuspended } },
                { onError: () => toast.error('Could not update this user') }
              )
            }
          >
            {isSuspended ? (
              <>
                <ShieldCheck className="size-4" />
                Unsuspend
              </>
            ) : (
              <>
                <ShieldOff className="size-4" />
                Suspend
              </>
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminUsers({ search: search || undefined, page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">Every account on the platform.</p>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name or email…"
          className="ps-8"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {isLoading || !data ? (
        <CardGridSkeleton />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((user) => (
                  <UserRow key={user.id} user={user} />
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
