import { Download, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { CATEGORY_LABEL_KEYS, ContactFormDialog } from '@/features/contacts/components/ContactFormDialog'
import { useContacts, useDeleteContact, useImportContacts } from '@/features/contacts/hooks/useContacts'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { downloadAuthenticatedFile } from '@/lib/downloadFile'
import { isEditorLevel } from '@/lib/permissions'
import type { Contact, ContactCategory, WorkspaceRole } from '@/types'
import type { TFunction } from 'i18next'

function categoryFilterItems(t: TFunction): Record<'all' | ContactCategory, string> {
  return {
    all: t('contacts.allCategories'),
    ...(Object.fromEntries(
      Object.entries(CATEGORY_LABEL_KEYS).map(([value, key]) => [value, t(key)])
    ) as Record<ContactCategory, string>),
  }
}

function ContactRow({
  workspaceId,
  contact,
  myRole,
}: {
  workspaceId: number
  contact: Contact
  myRole: WorkspaceRole | null
}) {
  const { t } = useTranslation()
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
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive">
                <Trash2 className="size-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>

      <ContactFormDialog workspaceId={workspaceId} contact={contact} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('contacts.deleteDialog.title')}
        description={t('contacts.deleteDialog.description', { name: contact.name })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteContact.isPending}
        onConfirm={() =>
          deleteContact.mutate(contact.id, {
            onSuccess: () => {
              toast.success(t('contacts.toasts.deleted'))
              setConfirmDeleteOpen(false)
            },
            onError: () => toast.error(t('contacts.toasts.deleteError')),
          })
        }
      />
    </TableRow>
  )
}

export function ContactsPage() {
  const { t } = useTranslation()
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
  const filterItems = categoryFilterItems(t)
  const [isExporting, setIsExporting] = useState(false)

  if (workspaceLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Users}
        title={t('common.noWorkspaceYet')}
        description={t('contacts.emptyState.noWorkspaceDescription')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.contacts')}</h1>
          <p className="text-sm text-muted-foreground">{t('contacts.pageDescription')}</p>
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
                    const parts = [t('contacts.import.created', { count: summary.created })]
                    if (summary.skipped > 0) parts.push(t('contacts.import.skipped', { count: summary.skipped }))
                    toast.success(parts.join(', '))
                  },
                  onError: () => toast.error(t('contacts.import.error')),
                })
              }}
            />
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importContacts.isPending}>
              <Upload className="size-4" />
              {importContacts.isPending ? t('contacts.import.importing') : t('contacts.import.button')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() => {
              setIsExporting(true)
              downloadAuthenticatedFile(`/api/workspaces/${currentWorkspace.id}/contacts/export`, 'contacts.csv')
                .catch(() => toast.error(t('contacts.export.error')))
                .finally(() => setIsExporting(false))
            }}
          >
            {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('contacts.export.button')}
          </Button>
          {canEdit && (
            <ContactFormDialog
              workspaceId={currentWorkspace.id}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  {t('contacts.dialog.addTitle')}
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
            placeholder={t('contacts.searchPlaceholder')}
            className="ps-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={filterItems}
          value={category}
          onValueChange={(value) => setCategory(value as 'all' | ContactCategory)}
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

      {isLoading ? (
        <CardGridSkeleton />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || category !== 'all' ? t('contacts.emptyState.noMatchTitle') : t('contacts.emptyState.noneTitle')}
          description={
            search || category !== 'all'
              ? t('contacts.emptyState.noMatchDescription')
              : canEdit
                ? t('contacts.emptyState.canEditDescription')
                : t('contacts.emptyState.viewOnlyDescription')
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('contacts.fields.name')}</TableHead>
                <TableHead>{t('contacts.fields.email')}</TableHead>
                <TableHead>{t('contacts.fields.phone')}</TableHead>
                <TableHead>{t('contacts.fields.category')}</TableHead>
                <TableHead>{t('contacts.fields.organization')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
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
