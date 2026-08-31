import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordRequirements } from '@/components/ui/password-requirements'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useLogout } from '@/features/auth/hooks/useLogout'
import {
  useAcceptInvitation,
  useInvitationPreview,
  useLoginForInvitation,
  useRegisterForInvitation,
} from '@/features/workspaces/hooks/useWorkspaces'
import { isStrongPassword, passwordStrengthMessage } from '@/lib/passwordStrength'
import { useAuth } from '@/providers/AuthProvider'

function invitationLoginSchema(t: TFunction) {
  return z.object({
    password: z.string().min(1, t('validation.passwordRequired')),
  })
}

function invitationRegisterSchema(t: TFunction) {
  return z
    .object({
      name: z.string().min(1, t('validation.nameRequired')).max(255),
      password: z
        .string()
        .min(1, t('validation.passwordRequired'))
        .refine(isStrongPassword, { message: passwordStrengthMessage(t) }),
      password_confirmation: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t('validation.passwordsDoNotMatch'),
      path: ['password_confirmation'],
    })
}

function InviteBlurb({ workspaceName, role, invitedBy }: { workspaceName: string; role: string; invitedBy: string | null }) {
  const { t } = useTranslation()
  const roleLabel = ['admin', 'editor', 'viewer'].includes(role) ? t(`common.roles.${role}`) : role

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Users className="size-6 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">
        {invitedBy
          ? t('invitation.invitedByBlurb', { inviter: invitedBy, workspace: workspaceName, role: roleLabel })
          : t('invitation.invitedBlurb', { workspace: workspaceName, role: roleLabel })}
      </p>
    </div>
  )
}

/** Already signed in as the right account — nothing to fill in. */
function AcceptAsCurrentUser({ token, workspaceName }: { token: string; workspaceName: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const acceptInvitation = useAcceptInvitation()

  return (
    <Button
      className="w-full"
      disabled={acceptInvitation.isPending}
      onClick={() =>
        acceptInvitation.mutate(token, {
          onSuccess: () => {
            toast.success(t('invitation.joinedToast', { workspace: workspaceName }))
            navigate('/', { replace: true })
          },
          onError: () => toast.error(t('invitation.acceptError')),
        })
      }
    >
      {acceptInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
      {t('invitation.accept')}
    </Button>
  )
}

/** Signed in, but as someone else — offer to switch accounts. */
function WrongAccount({ currentEmail, invitedEmail }: { currentEmail: string; invitedEmail: string }) {
  const { t } = useTranslation()
  const logout = useLogout()

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">
        {t('invitation.wrongAccount.description', { invitedEmail, currentEmail })}
      </p>
      <Button
        variant="outline"
        className="w-full"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {logout.isPending && <Loader2 className="size-4 animate-spin" />}
        {t('invitation.wrongAccount.switchAccounts')}
      </Button>
    </div>
  )
}

/** Not signed in, and this email already has an account — just needs the password. */
function LoginAndAccept({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // One request that logs in AND accepts server-side (see
  // WorkspaceInvitationController::login) — not two chained mutations.
  // Chaining them client-side raced the auth-state update (which swaps this
  // component out for AcceptAsCurrentUser) against the second call actually
  // completing, intermittently leaving the invite un-accepted with no
  // visible error.
  const loginForInvitation = useLoginForInvitation()

  const form = useForm<z.infer<ReturnType<typeof invitationLoginSchema>>>({
    resolver: zodResolver(invitationLoginSchema(t)),
    defaultValues: { password: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    loginForInvitation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success(t('invitation.welcomeAccepted'))
          navigate('/', { replace: true })
        },
        onError: () => form.setError('password', { message: t('invitation.incorrectPassword') }),
      }
    )
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {t('invitation.signingInAs')} <span className="font-medium text-foreground">{invitedEmail}</span>
        </p>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.password')}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loginForInvitation.isPending}>
          {loginForInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('invitation.signInAndAccept')}
        </Button>
      </form>
    </Form>
  )
}

/** Not signed in, and nobody has this email yet — create the account right here. */
function RegisterAndAccept({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const registerForInvitation = useRegisterForInvitation()

  const form = useForm<z.infer<ReturnType<typeof invitationRegisterSchema>>>({
    resolver: zodResolver(invitationRegisterSchema(t)),
    defaultValues: { name: '', password: '', password_confirmation: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    registerForInvitation.mutate(
      { token, payload: values },
      {
        onSuccess: () => {
          toast.success(t('invitation.accountCreatedAccepted'))
          navigate('/', { replace: true })
        },
        onError: () => toast.error(t('auth.register.createAccountError')),
      }
    )
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {t('invitation.creatingAccountFor')} <span className="font-medium text-foreground">{invitedEmail}</span>
        </p>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('invitation.yourName')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" autoFocus {...field} />
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
              <FormLabel>{t('invitation.choosePassword')}</FormLabel>
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
        <Button type="submit" className="w-full" disabled={registerForInvitation.isPending}>
          {registerForInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('invitation.createAccountAndAccept')}
        </Button>
      </form>
    </Form>
  )
}

export function AcceptInvitationPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: invitation, isLoading: invitationLoading, isError } = useInvitationPreview(token ?? '')

  if (authLoading || invitationLoading) {
    return (
      <AuthCard title={t('invitation.title')}>
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    )
  }

  if (isError || !invitation) {
    return (
      <AuthCard title={t('invitation.title')} description={t('invitation.invalidOrUsed')}>
        <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
          {t('invitation.goToDashboard')}
        </Button>
      </AuthCard>
    )
  }

  const isForCurrentUser =
    isAuthenticated && user && user.email.toLowerCase() === invitation.invited_email.toLowerCase()

  return (
    <AuthCard title={t('invitation.youveBeenInvited')}>
      <div className="space-y-6">
        <InviteBlurb workspaceName={invitation.workspace.name} role={invitation.role} invitedBy={invitation.invited_by} />

        {isAuthenticated && user ? (
          isForCurrentUser ? (
            <AcceptAsCurrentUser token={token ?? ''} workspaceName={invitation.workspace.name} />
          ) : (
            <WrongAccount currentEmail={user.email} invitedEmail={invitation.invited_email} />
          )
        ) : invitation.has_account ? (
          <LoginAndAccept token={token ?? ''} invitedEmail={invitation.invited_email} />
        ) : (
          <RegisterAndAccept token={token ?? ''} invitedEmail={invitation.invited_email} />
        )}
      </div>
    </AuthCard>
  )
}
