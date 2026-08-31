import type { TFunction } from 'i18next'
import { z } from 'zod'
import { isStrongPassword, passwordStrengthMessage } from '@/lib/passwordStrength'

// Schemas are built from a `t` function rather than exported as static
// objects, so validation messages follow the active language. Building a
// fresh schema per render is cheap; see the form components for usage.
export function createAuthSchemas(t: TFunction) {
  const email = z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid'))
  const password = z
    .string()
    .min(1, t('validation.passwordRequired'))
    .refine(isStrongPassword, { message: passwordStrengthMessage(t) })

  const loginSchema = z.object({
    email,
    password: z.string().min(1, t('validation.passwordRequired')),
    remember: z.boolean().optional(),
  })

  const registerSchema = z
    .object({
      name: z.string().min(1, t('validation.nameRequired')).max(255),
      email,
      password,
      password_confirmation: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t('validation.passwordsDoNotMatch'),
      path: ['password_confirmation'],
    })

  const forgotPasswordSchema = z.object({ email })

  const resetPasswordSchema = z
    .object({
      email,
      password,
      password_confirmation: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t('validation.passwordsDoNotMatch'),
      path: ['password_confirmation'],
    })

  return { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema }
}

export type LoginFormValues = z.infer<ReturnType<typeof createAuthSchemas>['loginSchema']>
export type RegisterFormValues = z.infer<ReturnType<typeof createAuthSchemas>['registerSchema']>
export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createAuthSchemas>['forgotPasswordSchema']>
export type ResetPasswordFormValues = z.infer<ReturnType<typeof createAuthSchemas>['resetPasswordSchema']>
