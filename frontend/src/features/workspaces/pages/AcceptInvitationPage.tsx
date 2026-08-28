import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { isStrongPassword, PASSWORD_STRENGTH_MESSAGE } from '@/lib/passwordStrength'
import { useAuth } from '@/providers/AuthProvider'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    password: z.string().min(1, 'Password is required').refine(isStrongPassword, { message: PASSWORD_STRENGTH_MESSAGE }),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

function InviteBlurb({ workspaceName, role, invitedBy }: { workspaceName: string; role: string; invitedBy: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Users className="size-6 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">
        {invitedBy ? `${invitedBy} has invited you` : "You've been invited"} to join{' '}
        <span className="font-medium text-foreground">{workspaceName}</span> as{' '}
        <span className="font-medium text-foreground">{ROLE_LABELS[role] ?? role}</span>.
      </p>
    </div>
  )
}

/** Already signed in as the right account — nothing to fill in. */
function AcceptAsCurrentUser({ token, workspaceName }: { token: string; workspaceName: string }) {
  const navigate = useNavigate()
  const acceptInvitation = useAcceptInvitation()

  return (
    <Button
      className="w-full"
      disabled={acceptInvitation.isPending}
      onClick={() =>
        acceptInvitation.mutate(token, {
          onSuccess: () => {
            toast.success(`You've joined ${workspaceName}`)
            navigate('/', { replace: true })
          },
          onError: () => toast.error('Could not accept this invitation'),
        })
      }
    >
      {acceptInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
      Accept invitation
    </Button>
  )
}

/** Signed in, but as someone else — offer to switch accounts. */
function WrongAccount({ currentEmail, invitedEmail }: { currentEmail: string; invitedEmail: string }) {
  const logout = useLogout()

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">
        This invitation is for <span className="font-medium text-foreground">{invitedEmail}</span>, but you're
        signed in as <span className="font-medium text-foreground">{currentEmail}</span>.
      </p>
      <Button
        variant="outline"
        className="w-full"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {logout.isPending && <Loader2 className="size-4 animate-spin" />}
        Log out and switch accounts
      </Button>
    </div>
  )
}

/** Not signed in, and this email already has an account — just needs the password. */
function LoginAndAccept({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const navigate = useNavigate()
  // One request that logs in AND accepts server-side (see
  // WorkspaceInvitationController::login) — not two chained mutations.
  // Chaining them client-side raced the auth-state update (which swaps this
  // component out for AcceptAsCurrentUser) against the second call actually
  // completing, intermittently leaving the invite un-accepted with no
  // visible error.
  const loginForInvitation = useLoginForInvitation()

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    loginForInvitation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success('Welcome — invitation accepted')
          navigate('/', { replace: true })
        },
        onError: () => form.setError('password', { message: 'Incorrect password' }),
      }
    )
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Signing in as <span className="font-medium text-foreground">{invitedEmail}</span>
        </p>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loginForInvitation.isPending}>
          {loginForInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in &amp; accept
        </Button>
      </form>
    </Form>
  )
}

/** Not signed in, and nobody has this email yet — create the account right here. */
function RegisterAndAccept({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const navigate = useNavigate()
  const registerForInvitation = useRegisterForInvitation()

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', password: '', password_confirmation: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    registerForInvitation.mutate(
      { token, payload: values },
      {
        onSuccess: () => {
          toast.success('Account created — invitation accepted')
          navigate('/', { replace: true })
        },
        onError: () => toast.error('Could not create your account'),
      }
    )
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Creating an account for <span className="font-medium text-foreground">{invitedEmail}</span>
        </p>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your name</FormLabel>
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
              <FormLabel>Choose a password</FormLabel>
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
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={registerForInvitation.isPending}>
          {registerForInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
          Create account &amp; accept
        </Button>
      </form>
    </Form>
  )
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: invitation, isLoading: invitationLoading, isError } = useInvitationPreview(token ?? '')

  if (authLoading || invitationLoading) {
    return (
      <AuthCard title="Invitation">
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    )
  }

  if (isError || !invitation) {
    return (
      <AuthCard title="Invitation" description="This invitation is invalid or has already been used.">
        <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
          Go to dashboard
        </Button>
      </AuthCard>
    )
  }

  const isForCurrentUser =
    isAuthenticated && user && user.email.toLowerCase() === invitation.invited_email.toLowerCase()

  return (
    <AuthCard title="You've been invited">
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
