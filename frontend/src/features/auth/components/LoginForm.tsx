import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { useTwoFactorChallenge } from '@/features/auth/hooks/useTwoFactorChallenge'
import { createAuthSchemas, type LoginFormValues } from '@/features/auth/schemas/authSchemas'
import { isTwoFactorRequired } from '@/types'

function TwoFactorChallengeForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const challenge = useTwoFactorChallenge()
  const [value, setValue] = useState('')
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = value.trim()
        if (!trimmed) return

        challenge.mutate(useRecoveryCode ? { recovery_code: trimmed } : { code: trimmed }, {
          onSuccess,
          onError: () => {
            setValue('')
            toast.error(t('auth.login.twoFactorInvalid'))
          },
        })
      }}
    >
      <p className="text-sm text-muted-foreground">{t('auth.login.twoFactorDescription')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="two-factor-value">
          {useRecoveryCode ? t('auth.login.recoveryCodeLabel') : t('auth.login.twoFactorCodeLabel')}
        </Label>
        <Input
          id="two-factor-value"
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecoveryCode ? 'text' : 'numeric'}
          placeholder={useRecoveryCode ? undefined : '123456'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={challenge.isPending || !value.trim()}>
        {challenge.isPending && <Loader2 className="size-4 animate-spin" />}
        {t('auth.login.verifyCode')}
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setUseRecoveryCode((prev) => !prev)
          setValue('')
        }}
      >
        {useRecoveryCode ? t('auth.login.useAuthenticatorInstead') : t('auth.login.useRecoveryCodeInstead')}
      </button>
    </form>
  )
}

export function LoginForm() {
  const { t } = useTranslation()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const { loginSchema } = createAuthSchemas(t)
  const [twoFactorPending, setTwoFactorPending] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const goToRedirectTarget = () => {
    const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/'
    navigate(redirectTo, { replace: true })
  }

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (result) => {
        if (isTwoFactorRequired(result)) {
          setTwoFactorPending(true)
          return
        }
        goToRedirectTarget()
      },
      onError: (error) => {
        // The backend's "login" rate limiter (5/min per email+IP — see
        // AppServiceProvider) returns 429 once it trips, distinct from the
        // 422 a wrong password gets. Collapsing both into the same
        // "credentials don't match" message — as this used to do — hides
        // that distinction from the user entirely: after the limiter trips,
        // every further attempt looks identical to just another typo, with
        // no indication that retrying immediately won't help.
        if (isAxiosError(error) && error.response?.status === 429) {
          toast.error(t('auth.login.tooManyAttempts'))
          return
        }

        form.setError('password', { message: t('auth.login.credentialsMismatch') })
        toast.error(t('auth.login.failedToast'))
      },
    })
  })

  if (twoFactorPending) {
    return <TwoFactorChallengeForm onSuccess={goToRedirectTarget} />
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.email')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t('auth.login.password')}</FormLabel>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('auth.login.signIn')}
        </Button>
      </form>
    </Form>
  )
}
