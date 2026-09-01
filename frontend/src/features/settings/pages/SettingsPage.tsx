import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { updatePassword, updateProfile } from '@/api/auth'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordRequirements } from '@/components/ui/password-requirements'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateLocale } from '@/features/auth/hooks/useUpdateLocale'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications/hooks/useNotificationPreferences'
import { ApiTokensTab } from '@/features/settings/components/ApiTokensTab'
import { TwoFactorTab } from '@/features/settings/components/TwoFactorTab'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import {
  useDeleteWorkspace,
  useLeaveWorkspace,
  useUpdateWorkspace,
  useWorkspaceActivity,
} from '@/features/workspaces/hooks/useWorkspaces'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { isStrongPassword, passwordStrengthMessage } from '@/lib/passwordStrength'
import { authUserKey } from '@/lib/queryClient'
import { formatRelativeTime } from '@/lib/relativeTime'
import { useAuth } from '@/providers/AuthProvider'
import type { NotificationPreferences, WorkspaceActivityLogEntry } from '@/types'

function profileSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
  })
}

function passwordSchema(t: TFunction) {
  return z
    .object({
      current_password: z.string().min(1, t('validation.currentPasswordRequired')),
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

function ProfileTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // defaultValues (captured once at mount), not `values`: a fresh object
  // literal there would resync the form on every re-render — including a
  // background refetch of the auth user — silently discarding any edit the
  // user is mid-typing. Settings only mounts after ProtectedRoute has
  // already loaded `user`, so it's populated by the time this runs.
  const form = useForm<z.infer<ReturnType<typeof profileSchema>>>({
    resolver: zodResolver(profileSchema(t)),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authUserKey, updatedUser)
      toast.success(t('settings.profile.updated'))
    },
    onError: () => toast.error(t('settings.profile.updateError')),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.profile.title')}</CardTitle>
        <CardDescription>{t('settings.profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{t('settings.profile.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// Applies immediately on change (no Save button) — same instant-apply
// behavior as the standalone LanguageSwitcher this replaces on the auth'd
// side of the app, just with a labeled field instead of an icon dropdown
// now that it lives on a settings page rather than a topbar.
function LanguageCard() {
  const { t, i18n } = useTranslation()
  const updateLocale = useUpdateLocale()
  const current = i18n.resolvedLanguage as SupportedLanguage | undefined
  const items = Object.fromEntries(SUPPORTED_LANGUAGES.map((lang) => [lang, LANGUAGE_NAMES[lang]]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.language.title')}</CardTitle>
        <CardDescription>{t('settings.language.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          items={items}
          value={current}
          onValueChange={(value) => {
            if (!value) return
            i18n.changeLanguage(value)
            updateLocale.mutate(value)
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_NAMES[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}

function PasswordTab() {
  const { t } = useTranslation()
  const form = useForm<z.infer<ReturnType<typeof passwordSchema>>>({
    resolver: zodResolver(passwordSchema(t)),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  const mutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success(t('settings.password.updated'))
      form.reset()
    },
    onError: () => {
      form.setError('current_password', { message: t('settings.password.incorrect') })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.password.title')}</CardTitle>
        <CardDescription>{t('settings.password.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.password.current')}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
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
                  <FormLabel>{t('settings.password.new')}</FormLabel>
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
                  <FormLabel>{t('settings.password.confirmNew')}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('settings.password.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function workspaceSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    description: z.string().max(1000).optional().or(z.literal('')),
  })
}

function WorkspaceTab() {
  const { t } = useTranslation()
  const { currentWorkspace, isLoading } = useCurrentWorkspace()
  const navigate = useNavigate()
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const updateWorkspace = useUpdateWorkspace(currentWorkspace?.id ?? 0)
  const leaveWorkspace = useLeaveWorkspace()
  const deleteWorkspace = useDeleteWorkspace()

  const form = useForm<z.infer<ReturnType<typeof workspaceSchema>>>({
    resolver: zodResolver(workspaceSchema(t)),
    // See ProfileTab above: defaultValues (not `values`) so a background
    // refetch never clobbers an in-progress edit.
    defaultValues: { name: currentWorkspace?.name ?? '', description: currentWorkspace?.description ?? '' },
  })

  if (isLoading) return <Loader2 className="size-6 animate-spin text-muted-foreground" />
  if (!currentWorkspace) return null

  const canManage = currentWorkspace.my_role === 'owner' || currentWorkspace.my_role === 'admin'
  const isOwner = currentWorkspace.my_role === 'owner'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.workspace.title')}</CardTitle>
          <CardDescription>{t('settings.workspace.description', { workspace: currentWorkspace.name })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                updateWorkspace.mutate(values, {
                  onSuccess: () => toast.success(t('settings.workspace.updated')),
                  onError: () => toast.error(t('settings.workspace.updateError')),
                })
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.profile.name')}</FormLabel>
                    <FormControl>
                      <Input disabled={!canManage} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.workspace.descriptionField')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} disabled={!canManage} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canManage && (
                <Button type="submit" disabled={updateWorkspace.isPending}>
                  {updateWorkspace.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>{t('settings.dangerZone.title')}</CardTitle>
          <CardDescription>
            {isOwner ? t('settings.dangerZone.ownerDescription') : t('settings.dangerZone.memberDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setConfirmLeaveOpen(true)}>
            {t('settings.dangerZone.leave')}
          </Button>
          {isOwner && (
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              {t('settings.dangerZone.delete')}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        title={t('settings.dangerZone.leave')}
        description={t('settings.dangerZone.leaveDialogDescription', { workspace: currentWorkspace.name })}
        confirmLabel={t('settings.dangerZone.leaveConfirm')}
        destructive
        isLoading={leaveWorkspace.isPending}
        onConfirm={() =>
          leaveWorkspace.mutate(currentWorkspace.id, {
            onSuccess: () => {
              setConfirmLeaveOpen(false)
              toast.success(t('settings.dangerZone.leftToast', { workspace: currentWorkspace.name }))
              navigate('/', { replace: true })
            },
            onError: () => toast.error(t('settings.dangerZone.leaveError')),
          })
        }
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('settings.dangerZone.delete')}
        description={t('settings.dangerZone.deleteDialogDescription', { workspace: currentWorkspace.name })}
        confirmLabel={t('common.delete')}
        destructive
        isLoading={deleteWorkspace.isPending}
        onConfirm={() =>
          deleteWorkspace.mutate(currentWorkspace.id, {
            onSuccess: () => {
              setConfirmDeleteOpen(false)
              toast.success(t('settings.dangerZone.deletedToast', { workspace: currentWorkspace.name }))
              navigate('/', { replace: true })
            },
            onError: () => toast.error(t('settings.dangerZone.deleteError')),
          })
        }
      />
    </div>
  )
}

type PreferenceUpdate = { [K in keyof NotificationPreferences]: Partial<NotificationPreferences[K]> }

function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function NotificationsTab() {
  const { t } = useTranslation()
  const { data: preferences, isLoading } = useNotificationPreferences()
  const updatePreferences = useUpdateNotificationPreferences()

  if (isLoading) return <Loader2 className="size-6 animate-spin text-muted-foreground" />
  if (!preferences) return null

  const toggle = <K extends keyof NotificationPreferences>(kind: K, channel: keyof NotificationPreferences[K], checked: boolean) => {
    updatePreferences.mutate(
      { [kind]: { [channel]: checked } } as PreferenceUpdate,
      { onError: () => toast.error(t('settings.notifications.updateError')) }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.notifications.title')}</CardTitle>
        <CardDescription>{t('settings.notifications.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">{t('settings.notifications.workspaceInvitation.title')}</h3>
          <PreferenceRow
            label={t('settings.notifications.channel.email')}
            description={t('settings.notifications.workspaceInvitation.mailDescription')}
            checked={preferences.workspace_invitation.mail}
            disabled={updatePreferences.isPending}
            onCheckedChange={(checked) => toggle('workspace_invitation', 'mail', checked)}
          />
          <PreferenceRow
            label={t('settings.notifications.channel.inApp')}
            description={t('settings.notifications.workspaceInvitation.databaseDescription')}
            checked={preferences.workspace_invitation.database}
            disabled={updatePreferences.isPending}
            onCheckedChange={(checked) => toggle('workspace_invitation', 'database', checked)}
          />
        </div>

        <div className="space-y-3 border-t pt-6">
          <h3 className="text-sm font-medium text-foreground">{t('settings.notifications.epkPublished.title')}</h3>
          <PreferenceRow
            label={t('settings.notifications.channel.inApp')}
            description={t('settings.notifications.epkPublished.databaseDescription')}
            checked={preferences.epk_published.database}
            disabled={updatePreferences.isPending}
            onCheckedChange={(checked) => toggle('epk_published', 'database', checked)}
          />
        </div>

        <div className="space-y-3 border-t pt-6">
          <h3 className="text-sm font-medium text-foreground">{t('settings.notifications.teamMemberJoined.title')}</h3>
          <PreferenceRow
            label={t('settings.notifications.channel.inApp')}
            description={t('settings.notifications.teamMemberJoined.databaseDescription')}
            checked={preferences.team_member_joined.database}
            disabled={updatePreferences.isPending}
            onCheckedChange={(checked) => toggle('team_member_joined', 'database', checked)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function describeActivity(t: TFunction, entry: WorkspaceActivityLogEntry): string {
  const meta = entry.metadata ?? {}
  const str = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string) : '')

  switch (entry.action) {
    case 'epk.created':
      return t('settings.activity.actions.epkCreated', { title: str('title') })
    case 'epk.published':
      return t('settings.activity.actions.epkPublished', { title: str('title') })
    case 'epk.unpublished':
      return t('settings.activity.actions.epkUnpublished', { title: str('title') })
    case 'epk.deleted':
      return t('settings.activity.actions.epkDeleted', { title: str('title') })
    case 'epk.duplicated':
      return t('settings.activity.actions.epkDuplicated', { title: str('title'), from: str('from') })
    case 'member.invited':
      return t('settings.activity.actions.memberInvited', { email: str('email') })
    case 'member.role_changed':
      return t('settings.activity.actions.memberRoleChanged', { member: str('member'), role: t(`common.roles.${str('role')}`) })
    case 'member.removed':
      return t('settings.activity.actions.memberRemoved', { member: str('member') })
    case 'workspace.updated':
      return t('settings.activity.actions.workspaceUpdated')
    default:
      return entry.action
  }
}

function ActivityTab() {
  const { t, i18n } = useTranslation()
  const { currentWorkspace } = useCurrentWorkspace()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useWorkspaceActivity(currentWorkspace?.id, page)

  if (isLoading) return <Loader2 className="size-6 animate-spin text-muted-foreground" />

  if (!data || data.data.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={t('settings.activity.emptyTitle')}
        description={t('settings.activity.emptyDescription')}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.activity.title')}</CardTitle>
        <CardDescription>{t('settings.activity.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {data.data.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="space-y-0.5">
                <p className="text-sm text-foreground">{describeActivity(t, entry)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.user?.name ?? t('settings.activity.system')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {entry.action}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(entry.created_at, i18n.resolvedLanguage ?? 'en')}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {data.meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.back')}
            </Button>
            <span>{t('settings.activity.pageOf', { page: data.meta.current_page, lastPage: data.meta.last_page })}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Temporarily disabled (2026-08-31, at the user's request) alongside the
// backend's FEATURE_API_TOKENS_ENABLED=false (see config/features.php there)
// — keep these two in sync. The backend already 404s the underlying
// endpoints on its own, but hiding the tab here avoids sending anyone into
// a "no tokens yet" empty state that's actually a disabled feature.
const API_TOKENS_ENABLED = false

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.settings')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.pageDescription')}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('settings.tabs.profile')}</TabsTrigger>
          <TabsTrigger value="password">{t('settings.tabs.password')}</TabsTrigger>
          <TabsTrigger value="workspace">{t('settings.tabs.workspace')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.tabs.notifications')}</TabsTrigger>
          <TabsTrigger value="activity">{t('settings.tabs.activity')}</TabsTrigger>
          {API_TOKENS_ENABLED && <TabsTrigger value="apiTokens">{t('settings.tabs.apiTokens')}</TabsTrigger>}
          <TabsTrigger value="twoFactor">{t('settings.tabs.twoFactor')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 space-y-6">
          <ProfileTab />
          <LanguageCard />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="workspace" className="mt-4">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab />
        </TabsContent>
        {API_TOKENS_ENABLED && (
          <TabsContent value="apiTokens" className="mt-4">
            <ApiTokensTab />
          </TabsContent>
        )}
        <TabsContent value="twoFactor" className="mt-4">
          <TwoFactorTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
