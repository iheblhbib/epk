import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { resetPassword } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordRequirements } from '@/components/ui/password-requirements'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { createAuthSchemas, type ResetPasswordFormValues } from '@/features/auth/schemas/authSchemas'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mutation = useMutation({ mutationFn: resetPassword })
  const { resetPasswordSchema } = createAuthSchemas(t)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: searchParams.get('email') ?? '',
      password: '',
      password_confirmation: '',
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    if (!token) return

    mutation.mutate(
      { ...values, token },
      {
        onSuccess: () => {
          toast.success(t('auth.resetPassword.success'))
          navigate('/login', { replace: true })
        },
        onError: () => {
          form.setError('email', { message: t('auth.resetPassword.invalidLink') })
        },
      }
    )
  })

  return (
    <AuthCard
      title={t('auth.resetPassword.title')}
      footer={
        <Link to="/login" className="font-medium text-foreground hover:underline">
          {t('auth.resetPassword.backToSignIn')}
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.resetPassword.email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
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
                <FormLabel>{t('auth.resetPassword.newPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <PasswordRequirements password={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password_confirmation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.resetPassword.confirmNewPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('auth.resetPassword.submit')}
          </Button>
        </form>
      </Form>
    </AuthCard>
  )
}
