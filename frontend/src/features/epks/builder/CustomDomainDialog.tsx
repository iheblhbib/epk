import { CheckCircle2, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  useEpkCustomDomain,
  useRemoveEpkCustomDomain,
  useSetEpkCustomDomain,
  useVerifyEpkCustomDomain,
} from '@/features/epks/hooks/useEpks'
import type { DnsRecordInstruction, Epk } from '@/types'

function copy(value: string, message: string) {
  navigator.clipboard.writeText(value)
  toast.success(message)
}

function DnsRecordRow({ record }: { record: DnsRecordInstruction }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-1 rounded-md border border-border p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="font-mono">
          {record.type}
        </Badge>
      </div>
      {(['host', 'value'] as const).map((field) => (
        <div key={field} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground">{field === 'host' ? t('epkBuilder.customDomain.recordHost') : t('epkBuilder.customDomain.recordValue')}</p>
            <code className="block truncate">{record[field]}</code>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => copy(record[field], t('epkBuilder.customDomain.copied'))}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function DomainSetup({ epk }: { epk: Epk }) {
  const { t } = useTranslation()
  const setDomain = useSetEpkCustomDomain(epk.id)
  const [domain, setDomainInput] = useState('')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = domain.trim().toLowerCase()
        if (!trimmed) return
        setDomain.mutate(trimmed, {
          onError: (error) => {
            const message =
              (error as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors
                ?.domain?.[0] ?? t('epkBuilder.customDomain.setupError')
            toast.error(message)
          },
        })
      }}
    >
      <p className="text-sm text-muted-foreground">{t('epkBuilder.customDomain.setupDescription')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="custom-domain-input">{t('epkBuilder.customDomain.domainField')}</Label>
        <Input
          id="custom-domain-input"
          placeholder="press.yourband.com"
          value={domain}
          onChange={(event) => setDomainInput(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={setDomain.isPending || !domain.trim()}>
        {t('epkBuilder.customDomain.setup')}
      </Button>
    </form>
  )
}

function DomainStatus({ epk }: { epk: Epk }) {
  const { t } = useTranslation()
  const verify = useVerifyEpkCustomDomain(epk.id)
  const remove = useRemoveEpkCustomDomain(epk.id)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  if (!epk.custom_domain) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <code className="text-sm font-medium text-foreground">{epk.custom_domain}</code>
          {epk.custom_domain_verified ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="size-3" />
              {t('epkBuilder.customDomain.verified')}
            </Badge>
          ) : (
            <Badge variant="outline">{t('epkBuilder.customDomain.pending')}</Badge>
          )}
        </div>
      </div>

      {!epk.custom_domain_verified && (
        <>
          <p className="text-sm text-muted-foreground">{t('epkBuilder.customDomain.verifyDescription')}</p>
          {/* Backend echoes these back every time — nothing is fetched here
              specially, the values just live on the setup response, which
              the caller (EpkBuilderPage) already has via `epk` once a
              domain is set. Re-derived instructions come from a fresh
              setEpkCustomDomain/verify call rather than being cached here. */}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!epk.custom_domain_verified && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={verify.isPending}
            onClick={() =>
              verify.mutate(undefined, {
                onSuccess: () => toast.success(t('epkBuilder.customDomain.verifySuccess')),
                onError: () => toast.error(t('epkBuilder.customDomain.verifyError')),
              })
            }
          >
            <RefreshCw className="size-3.5" />
            {t('epkBuilder.customDomain.checkVerification')}
          </Button>
        )}
        {!confirmingRemove && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmingRemove(true)}>
            <Trash2 className="size-3.5" />
            {t('common.delete')}
          </Button>
        )}
      </div>

      {confirmingRemove && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-sm">
          <span className="text-destructive">{t('epkBuilder.customDomain.removeConfirm')}</span>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('epkBuilder.customDomain.removed'))
                    setConfirmingRemove(false)
                  },
                  onError: () => toast.error(t('epkBuilder.customDomain.removeError')),
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

export function CustomDomainDialog({ epk }: { epk: Epk }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // The DNS record instructions only exist via this dedicated endpoint —
  // not on the Epk resource itself — since they're only meaningful right
  // when the owner needs to go add/check them, and re-fetching (rather
  // than relying on a mutation's transient .data) means they're still
  // there if the dialog is closed and reopened later.
  const { data: instructions } = useEpkCustomDomain(epk.id, open && !!epk.custom_domain)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Globe className="size-4" />
        {t('epkBuilder.customDomain.trigger')}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('epkBuilder.customDomain.trigger')}</DialogTitle>
          <DialogDescription>{t('epkBuilder.customDomain.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {epk.custom_domain ? <DomainStatus epk={epk} /> : <DomainSetup epk={epk} />}

          {instructions && !epk.custom_domain_verified && (
            <div className="space-y-2">
              <DnsRecordRow record={instructions.verification_record} />
              <DnsRecordRow record={instructions.routing_record} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
