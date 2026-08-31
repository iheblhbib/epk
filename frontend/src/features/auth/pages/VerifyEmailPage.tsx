import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { resendVerificationEmail } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useAuth } from '@/providers/AuthProvider'
import { useLogout } from '@/features/auth/hooks/useLogout'

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()
  const [sent, setSent] = useState(false)
  const logout = useLogout()
  const resend = useMutation({ mutationFn: resendVerificationEmail })

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
          disabled={resend.isPending || sent}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => {
                setSent(true)
                toast.success(t('auth.verifyEmail.sentToast'))
              },
              onError: () => toast.error(t('auth.verifyEmail.sendError')),
            })
          }
        >
          {sent ? t('auth.verifyEmail.sent') : t('auth.verifyEmail.resend')}
        </Button>
      </div>
    </AuthCard>
  )
}
