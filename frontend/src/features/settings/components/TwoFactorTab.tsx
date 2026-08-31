import { CheckCircle2, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  useConfirmTwoFactorAuthentication,
  useDisableTwoFactorAuthentication,
  useEnableTwoFactorAuthentication,
  useRegenerateTwoFactorRecoveryCodes,
  useTwoFactorRecoveryCodes,
} from '@/features/settings/hooks/useTwoFactor'
import { useAuth } from '@/providers/AuthProvider'
import type { TwoFactorSetup } from '@/types'

function RecoveryCodesList({ codes }: { codes: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-muted p-3 font-mono text-xs">
      {codes.map((code) => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  )
}

function RecoveryCodesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { data: codes, isLoading } = useTwoFactorRecoveryCodes(open)
  const regenerate = useRegenerateTwoFactorRecoveryCodes()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.twoFactor.recoveryCodesTitle')}</DialogTitle>
          <DialogDescription>{t('settings.twoFactor.recoveryCodesDescription')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        ) : (
          codes && <RecoveryCodesList codes={codes} />
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={regenerate.isPending}
            onClick={() =>
              regenerate.mutate(undefined, {
                onSuccess: () => toast.success(t('settings.twoFactor.recoveryCodesRegenerated')),
                onError: () => toast.error(t('settings.twoFactor.recoveryCodesRegenerateError')),
              })
            }
          >
            {regenerate.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('settings.twoFactor.regenerateCodes')}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SetupFlow({ onCancel, onEnabled }: { onCancel: () => void; onEnabled: () => void }) {
  const { t } = useTranslation()
  const enableTwoFactor = useEnableTwoFactorAuthentication()
  const confirmTwoFactor = useConfirmTwoFactorAuthentication()
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  useEffect(() => {
    if (!setup) return
    let cancelled = false
    QRCode.toDataURL(setup.otpauth_url, { margin: 1, width: 200 }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [setup])

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="size-4" />
          <p className="text-sm font-medium">{t('settings.twoFactor.enabledSuccess')}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.twoFactor.recoveryCodesDescription')}</p>
        <RecoveryCodesList codes={recoveryCodes} />
        <Button type="button" onClick={onEnabled}>
          {t('common.close')}
        </Button>
      </div>
    )
  }

  if (setup) {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          confirmTwoFactor.mutate(code.trim(), {
            onSuccess: (codes) => setRecoveryCodes(codes),
            onError: () => {
              setCode('')
              toast.error(t('settings.twoFactor.confirmError'))
            },
          })
        }}
      >
        <p className="text-sm text-muted-foreground">{t('settings.twoFactor.scanDescription')}</p>
        {qrDataUrl && <img src={qrDataUrl} alt={t('settings.twoFactor.qrAlt')} className="rounded-md border border-border" width={200} height={200} />}
        <div className="space-y-1.5">
          <Label>{t('settings.twoFactor.secretLabel')}</Label>
          <code className="block overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-xs whitespace-nowrap">
            {setup.secret}
          </code>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="two-factor-confirm-code">{t('settings.twoFactor.confirmCodeLabel')}</Label>
          <Input
            id="two-factor-confirm-code"
            autoFocus
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={confirmTwoFactor.isPending || !code.trim()}>
            {confirmTwoFactor.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('settings.twoFactor.confirmAndEnable')}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        enableTwoFactor.mutate(password, {
          onSuccess: (result) => setSetup(result),
          onError: () => toast.error(t('settings.twoFactor.enableError')),
        })
      }}
    >
      <p className="text-sm text-muted-foreground">{t('settings.twoFactor.confirmPasswordDescription')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="two-factor-current-password">{t('settings.password.current')}</Label>
        <PasswordInput
          id="two-factor-current-password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={enableTwoFactor.isPending || !password}>
          {enableTwoFactor.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('common.next')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}

function DisableFlow({ onCancel, onDisabled }: { onCancel: () => void; onDisabled: () => void }) {
  const { t } = useTranslation()
  const disableTwoFactor = useDisableTwoFactorAuthentication()
  const [password, setPassword] = useState('')

  return (
    <form
      className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        disableTwoFactor.mutate(password, {
          onSuccess: onDisabled,
          onError: () => toast.error(t('settings.twoFactor.disableError')),
        })
      }}
    >
      <p className="text-sm text-destructive">{t('settings.twoFactor.disableConfirm')}</p>
      <PasswordInput
        autoComplete="current-password"
        autoFocus
        placeholder={t('settings.password.current')}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={disableTwoFactor.isPending || !password}>
          {disableTwoFactor.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('settings.twoFactor.disable')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}

export function TwoFactorTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mode, setMode] = useState<'status' | 'enabling' | 'disabling'>('status')
  const [recoveryCodesOpen, setRecoveryCodesOpen] = useState(false)
  const enabled = user?.two_factor_enabled ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.twoFactor.title')}</CardTitle>
        <CardDescription>{t('settings.twoFactor.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'status' && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={enabled ? 'default' : 'outline'}>
                {enabled ? t('settings.twoFactor.enabled') : t('settings.twoFactor.disabled')}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {enabled ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRecoveryCodesOpen(true)}>
                    {t('settings.twoFactor.viewRecoveryCodes')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setMode('disabling')}>
                    {t('settings.twoFactor.disable')}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={() => setMode('enabling')}>
                  {t('settings.twoFactor.enable')}
                </Button>
              )}
            </div>
          </>
        )}

        {mode === 'enabling' && <SetupFlow onCancel={() => setMode('status')} onEnabled={() => setMode('status')} />}
        {mode === 'disabling' && <DisableFlow onCancel={() => setMode('status')} onDisabled={() => setMode('status')} />}
      </CardContent>

      <RecoveryCodesDialog open={recoveryCodesOpen} onOpenChange={setRecoveryCodesOpen} />
    </Card>
  )
}
