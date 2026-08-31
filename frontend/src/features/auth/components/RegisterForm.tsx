import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordRequirements } from '@/components/ui/password-requirements'
import { useRegister } from '@/features/auth/hooks/useRegister'
import { createAuthSchemas, type RegisterFormValues } from '@/features/auth/schemas/authSchemas'

export function RegisterForm() {
  const { t } = useTranslation()
  const register = useRegister()
  const navigate = useNavigate()
  const { registerSchema } = createAuthSchemas(t)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    register.mutate(values, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (error) => {
        // Same "register" rate limiter as login's (5/min per IP — see
        // AppServiceProvider), surfaced with its own message rather than
        // the generic create-account failure for consistency with the
        // login form's 429 handling.
        if (isAxiosError(error) && error.response?.status === 429) {
          toast.error(t('auth.register.tooManyAttempts'))
          return
        }

        const errors = (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response
          ?.data?.errors
        if (errors?.email) {
          form.setError('email', { message: errors.email[0] })
        }
        toast.error(t('auth.register.createAccountError'))
      },
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.register.name')}</FormLabel>
              <FormControl>
                <Input placeholder="Ada Lovelace" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.register.email')}</FormLabel>
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
              <FormLabel>{t('auth.register.password')}</FormLabel>
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
              <FormLabel>{t('auth.register.confirmPassword')}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('auth.register.createAccount')}
        </Button>
      </form>
    </Form>
  )
}
