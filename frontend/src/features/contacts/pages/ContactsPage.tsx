import { Download, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { contactsExportUrl } from '@/api/contacts'
import { CATEGORY_ITEMS, ContactFormDialog } from '@/features/contacts/components/ContactFormDialog'
import { useContacts, useDeleteContact, useImportContacts } from '@/features/contacts/hooks/useContacts'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { isEditorLevel } from '@/lib/permissions'
import type { Contact, ContactCategory, WorkspaceRole } from '@/types'

const CATEGORY_FILTER_ITEMS: Record<'all' | ContactCategory, string> = { all: 'All categories', ...CATEGORY_ITEMS }

function ContactRow({
  workspaceId,
  contact,
  myRole,
}: {
  workspaceId: number
  contact: Contact
  myRole: WorkspaceRole | null
}) {
  const deleteContact = useDeleteContact(workspaceId)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const canEdit = isEditorLevel(myRole)

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{contact.name}</TableCell>
      <TableCell className="text-muted-foreground">{contact.email || '—'}</TableCell>
      <TableCell className="text-muted-foreground">{contact.phone || '—'}</TableCell>
      <TableCell>
        <Badge variant="secondary">{contact.category_label}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{contact.organization || '—'}</TableCell>
      <TableCell className="text-end">
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive">
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>

      <ContactFormDialog workspaceId={workspaceId} contact={contact} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete contact"
        description={`"${contact.name}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteContact.isPending}
        onConfirm={() =>
          deleteContact.mutate(contact.id, {
            onSuccess: () => {
              toast.success('Contact deleted')
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error('Could not delete the contact'),
          })
        }
      />
    </TableRow>
  )
}

export function ContactsPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | ContactCategory>('all')
  const { data: contacts, isLoading } = useContacts(currentWorkspace?.id, {
    search: search || undefined,
    category: category === 'all' ? undefined : category,
  })
  const importContacts = useImportContacts(currentWorkspace?.id ?? 0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canEdit = isEditorLevel(currentWorkspace?.my_role)

  if (workspaceLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Users}
        title="No workspace yet"
        description="Create a workspace from the dashboard before adding contacts."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Journalists, radio, blogs, and everyone else you work with on press and promo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                importContacts.mutate(file, {
                  onSuccess: (summary) => {
                    const parts = [`${summary.created} imported`]
                    if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
                    toast.success(parts.join(', '))
                  },
                  onError: () => toast.error('Could not import the file'),
                })
              }}
            />
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importContacts.isPending}>
              <Upload className="size-4" />
              {importContacts.isPending ? 'Importing…' : 'Import CSV'}
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={contactsExportUrl(currentWorkspace.id)} />}>
            <Download className="size-4" />
            Export CSV
          </Button>
          {canEdit && (
            <ContactFormDialog
              workspaceId={currentWorkspace.id}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Add contact
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, organization…"
            className="ps-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={CATEGORY_FILTER_ITEMS}
          value={category}
          onValueChange={(value) => setCategory(value as 'all' | ContactCategory)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_FILTER_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || category !== 'all' ? 'No matching contacts' : 'No contacts yet'}
          description={
            search || category !== 'all'
              ? 'Try a different search or category.'
              : canEdit
                ? 'Add your first contact, or import a CSV to bring in a whole list at once.'
                : 'No contacts have been added to this workspace yet.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  workspaceId={currentWorkspace.id}
                  contact={contact}
                  myRole={currentWorkspace.my_role}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
