import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { resendVerificationEmail } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useAuth } from '@/providers/AuthProvider'
import { useLogout } from '@/features/auth/hooks/useLogout'

const RESEND_COOLDOWN_SECONDS = 30

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()
  const [cooldown, setCooldown] = useState(0)
  const logout = useLogout()
  const resend = useMutation({ mutationFn: resendVerificationEmail })

  // Depends on cooldown === 0 (not cooldown itself), so the interval is
  // created once when the countdown starts and keeps ticking itself down --
  // not torn down and recreated on every single tick.
  useEffect(() => {
    if (cooldown <= 0) return
    const interval = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown <= 0])

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.email_verified_at) return <Navigate to="/" replace />

  return (
    <AuthCard
      title={t('auth.verifyEmail.title')}
      description={t('auth.verifyEmail.description', { email: user.email })}
      footer={
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="font-medium text-foreground hover:underline"
        >
          {t('auth.verifyEmail.logout')}
        </button>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="size-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{t('auth.verifyEmail.instructions')}</p>
        <Button
          variant="outline"
          disabled={resend.isPending || cooldown > 0}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => {
                setCooldown(RESEND_COOLDOWN_SECONDS)
                toast.success(t('auth.verifyEmail.sentToast'))
              },
              onError: () => toast.error(t('auth.verifyEmail.sendError')),
            })
          }
        >
          {cooldown > 0 ? t('auth.verifyEmail.resendIn', { seconds: cooldown }) : t('auth.verifyEmail.resend')}
        </Button>
      </div>
    </AuthCard>
  )
}
