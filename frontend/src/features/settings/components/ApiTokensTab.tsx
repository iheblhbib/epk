import { Copy, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@/features/settings/hooks/useApiTokens'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { ApiToken, CreatedApiToken } from '@/types'

// Inline confirm rather than a nested <ConfirmDialog> — this list already
// lives inside a Settings tab, and the same Base UI focus-trap issue that
// rules out nested dialogs elsewhere (see PrivateLinksDialog) applies here
// too the moment a second dialog (the one-time token reveal) is also on
// the page.
function ApiTokenRow({ token }: { token: ApiToken }) {
  const { t, i18n } = useTranslation()
  const revokeToken = useRevokeApiToken()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{token.name}</p>
          <p className="text-xs text-muted-foreground">
            {t('settings.apiTokens.created', { date: new Date(token.created_at).toLocaleDateString() })}
            {' · '}
            {token.last_used_at
              ? t('settings.apiTokens.lastUsed', {
                  when: formatRelativeTime(token.last_used_at, i18n.resolvedLanguage ?? 'en'),
                })
              : t('settings.apiTokens.neverUsed')}
          </p>
        </div>
        {!confirming && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" />
            {t('settings.apiTokens.revoke')}
          </Button>
        )}
      </div>

      {confirming && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-sm">
          <span className="text-destructive">{t('settings.apiTokens.revokeConfirm')}</span>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={revokeToken.isPending}
              onClick={() =>
                revokeToken.mutate(token.id, {
                  onSuccess: () => toast.success(t('settings.apiTokens.revoked')),
                  onError: () => {
                    toast.error(t('settings.apiTokens.revokeError'))
                    setConfirming(false)
                  },
                })
              }
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewTokenDialog({ token, onOpenChange }: { token: CreatedApiToken | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()

  return (
    <Dialog open={token !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.apiTokens.createdTitle')}</DialogTitle>
          <DialogDescription>{t('settings.apiTokens.createdDescription')}</DialogDescription>
        </DialogHeader>

        {token && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <code className="flex-1 overflow-x-auto text-xs whitespace-nowrap">{token.plain_text_token}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(token.plain_text_token)
                toast.success(t('settings.apiTokens.copied'))
              }}
            >
              <Copy className="size-3.5" />
              {t('settings.apiTokens.copy')}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ApiTokensTab() {
  const { t } = useTranslation()
  const { data: tokens, isLoading } = useApiTokens()
  const createToken = useCreateApiToken()
  const [name, setName] = useState('')
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.apiTokens.title')}</CardTitle>
        <CardDescription>{t('settings.apiTokens.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            createToken.mutate(trimmed, {
              onSuccess: (created) => {
                setCreatedToken(created)
                setName('')
              },
              onError: () => toast.error(t('settings.apiTokens.createError')),
            })
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-token-name">{t('settings.apiTokens.nameField')}</Label>
            <Input
              id="new-token-name"
              placeholder={t('settings.apiTokens.namePlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={createToken.isPending || !name.trim()}>
            {createToken.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('settings.apiTokens.createToken')}
          </Button>
        </form>

        {isLoading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : !tokens || tokens.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('settings.apiTokens.none')}</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <ApiTokenRow key={token.id} token={token} />
            ))}
          </div>
        )}
      </CardContent>

      <NewTokenDialog token={createdToken} onOpenChange={(open) => !open && setCreatedToken(null)} />
    </Card>
  )
}
