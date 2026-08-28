import { Ban, Copy, Link2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreatePrivateLink,
  useDeletePrivateLink,
  usePrivateLinks,
  useUpdatePrivateLink,
} from '@/features/epks/hooks/usePrivateLinks'
import type { PrivateLink } from '@/types'

function statusLabel(link: PrivateLink): { text: string; variant: 'default' | 'secondary' | 'outline' } {
  if (link.revoked_at) return { text: 'Revoked', variant: 'outline' }
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { text: 'Expired', variant: 'outline' }
  return { text: 'Active', variant: 'default' }
}

function LinkRow({ epkId, link }: { epkId: number; link: PrivateLink }) {
  const updateLink = useUpdatePrivateLink(epkId)
  const deleteLink = useDeletePrivateLink(epkId)
  // An inline confirm step rather than a nested <ConfirmDialog> — a Dialog
  // opened from inside another Dialog's content trips Base UI's focus
  // trapping (it aria-hides the outer dialog while a button inside it still
  // holds DOM focus), which is exactly this kind of compact list-row
  // action anyway.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const status = statusLabel(link)

  const fullUrl = `${window.location.origin}${link.private_url}`

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{link.label || 'Untitled link'}</p>
          <p className="truncate text-xs text-muted-foreground">{fullUrl}</p>
        </div>
        <Badge variant={status.variant}>{status.text}</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        {link.requires_password ? 'Password-protected' : 'No password'}
        {link.expires_at && ` · Expires ${new Date(link.expires_at).toLocaleDateString()}`}
        {' · '}
        {link.view_count} view{link.view_count === 1 ? '' : 's'}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(fullUrl)
            toast.success('Link copied')
          }}
        >
          <Copy className="size-3.5" />
          Copy link
        </Button>
        {link.revoked_at ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateLink.mutate(
                { linkId: link.id, payload: { revoked: false } },
                { onSuccess: () => toast.success('Link reactivated'), onError: () => toast.error('Could not reactivate the link') }
              )
            }
          >
            <RotateCcw className="size-3.5" />
            Reactivate
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateLink.mutate(
                { linkId: link.id, payload: { revoked: true } },
                { onSuccess: () => toast.success('Link revoked'), onError: () => toast.error('Could not revoke the link') }
              )
            }
          >
            <Ban className="size-3.5" />
            Revoke
          </Button>
        )}
        {!confirmingDelete && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-sm">
          <span className="text-destructive">Delete this link permanently?</span>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteLink.isPending}
              onClick={() =>
                deleteLink.mutate(link.id, {
                  onSuccess: () => toast.success('Link deleted'),
                  onError: () => {
                    toast.error('Could not delete the link')
                    setConfirmingDelete(false)
                  },
                })
              }
            >
              {deleteLink.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateLinkForm({ epkId }: { epkId: number }) {
  const createLink = useCreatePrivateLink(epkId)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  return (
    <form
      className="space-y-3 rounded-lg border border-dashed border-border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        createLink.mutate(
          {
            label: label || null,
            password: password || null,
            // A bare "YYYY-MM-DD" from <input type="date"> parses as UTC
            // midnight — for anyone in a timezone ahead of UTC, picking
            // "today" can already be in the past by the time it reaches the
            // server's after:now check. Appending a local end-of-day time
            // (parsed in the browser's own timezone, not UTC) means "today"
            // reliably means "through the end of today" instead.
            expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
          },
          {
            onSuccess: () => {
              toast.success('Private link created')
              setLabel('')
              setPassword('')
              setExpiresAt('')
            },
            onError: () => toast.error('Could not create the link'),
          }
        )
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-link-label">Label (optional)</Label>
        <Input id="new-link-label" placeholder="e.g. For Rolling Stone" value={label} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-link-password">Password (optional)</Label>
          <Input
            id="new-link-password"
            type="text"
            placeholder="Leave blank for none"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-link-expiry">Expires (optional)</Label>
          <Input id="new-link-expiry" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={createLink.isPending}>
        <Plus className="size-4" />
        Create link
      </Button>
    </form>
  )
}

export function PrivateLinksDialog({ epkId }: { epkId: number }) {
  const [open, setOpen] = useState(false)
  const { data: links, isLoading } = usePrivateLinks(open ? epkId : undefined)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Link2 className="size-4" />
        Private links
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Private links</DialogTitle>
          <DialogDescription>
            Share this EPK with specific people without publishing it — works even while it's still a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-3 overflow-y-auto">
          <CreateLinkForm epkId={epkId} />

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !links || links.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No private links yet.</p>
          ) : (
            links.map((link) => <LinkRow key={link.id} epkId={epkId} link={link} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
