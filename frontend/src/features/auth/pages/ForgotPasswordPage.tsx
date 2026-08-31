import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { createAuthSchemas, type ForgotPasswordFormValues } from '@/features/auth/schemas/authSchemas'
import { useMutation } from '@tanstack/react-query'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const mutation = useMutation({ mutationFn: forgotPassword })
  const { forgotPasswordSchema } = createAuthSchemas(t)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values.email, {
      onSuccess: () => setSent(true),
      onError: () => {
        form.setError('email', { message: t('auth.forgotPassword.notFound') })
      },
    })
  })

  return (
    <AuthCard
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
      footer={
        <Link to="/login" className="font-medium text-foreground hover:underline">
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm text-muted-foreground">{t('auth.forgotPassword.checkInbox')}</p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.forgotPassword.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('auth.forgotPassword.sendResetLink')}
            </Button>
          </form>
        </Form>
      )}
    </AuthCard>
  )
}
