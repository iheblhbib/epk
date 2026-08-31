import type { AxiosError } from 'axios'
import { Lock, ShieldOff, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { trackPrivateEvent } from '@/api/privatePage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePrivatePage, useVerifyPrivatePage } from '@/features/private-epk/hooks/usePrivatePage'
import { renderSection } from '@/features/public-epk/sectionRenderers'
import { resolveTheme, themeToCssVars, type EpkCustomSettings } from '@/lib/epkThemes'
import type { ApiErrorBody } from '@/types'

function CenteredMessage({ icon: Icon, title, description }: { icon: typeof Lock; title: string; description: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PasswordGate({ token }: { token: string }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const verify = useVerifyPrivatePage(token)

  const errorMessage = (verify.error as AxiosError<ApiErrorBody> | null)?.response?.data?.errors?.password?.[0]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t('privateEpk.passwordGate.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('privateEpk.passwordGate.description')}</p>
      </div>
      <form
        className="w-full max-w-xs space-y-3 text-start"
        onSubmit={(event) => {
          event.preventDefault()
          verify.mutate(password)
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="private-link-password">{t('auth.login.password')}</Label>
          <Input
            id="private-link-password"
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!errorMessage}
          />
          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={verify.isPending || !password}>
          {verify.isPending ? t('privateEpk.passwordGate.checking') : t('privateEpk.passwordGate.submit')}
        </Button>
      </form>
    </div>
  )
}

export function PrivateEpkPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const { data: epk, isLoading, error } = usePrivatePage(token)
  const hasTrackedView = useRef(false)

  const status = (error as AxiosError | null)?.response?.status

  useEffect(() => {
    if (!epk || !token || hasTrackedView.current) return
    hasTrackedView.current = true
    trackPrivateEvent(token, 'page_view')
  }, [epk, token])

  useEffect(() => {
    if (!epk) return
    document.title = epk.seo_title || epk.title
    return () => {
      document.title = 'KORAX'
    }
  }, [epk])

  if (isLoading) {
    return <div className="min-h-screen bg-background" />
  }

  if (!token) {
    return (
      <CenteredMessage
        icon={Sparkles}
        title={t('privateEpk.notAvailable.title')}
        description={t('privateEpk.notAvailable.description')}
      />
    )
  }

  if (status === 401) {
    return <PasswordGate token={token} />
  }

  if (status === 410) {
    return (
      <CenteredMessage
        icon={ShieldOff}
        title={t('privateEpk.expired.title')}
        description={t('privateEpk.expired.description')}
      />
    )
  }

  if (error || !epk) {
    return (
      <CenteredMessage
        icon={Sparkles}
        title={t('privateEpk.notAvailable.title')}
        description={t('privateEpk.notAvailable.description')}
      />
    )
  }

  const theme = resolveTheme(epk.theme, epk.custom_settings as EpkCustomSettings | null)

  return (
    <div
      className="min-h-screen bg-[var(--epk-bg)] text-[var(--epk-fg)]"
      style={{ ...themeToCssVars(theme), fontFamily: 'var(--epk-font)' }}
    >
      {epk.sections.map((section) =>
        renderSection(section, epk.artist?.name ?? epk.title, theme, (type, meta) => trackPrivateEvent(token, type, meta))
      )}
    </div>
  )
}
