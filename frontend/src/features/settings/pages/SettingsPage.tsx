import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { updatePassword, updateProfile } from '@/api/auth'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordRequirements } from '@/components/ui/password-requirements'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { useDeleteWorkspace, useLeaveWorkspace, useUpdateWorkspace } from '@/features/workspaces/hooks/useWorkspaces'
import { isStrongPassword, PASSWORD_STRENGTH_MESSAGE } from '@/lib/passwordStrength'
import { authUserKey } from '@/lib/queryClient'
import { useAuth } from '@/providers/AuthProvider'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    password: z
      .string()
      .min(1, 'Password is required')
      .refine(isStrongPassword, { message: PASSWORD_STRENGTH_MESSAGE }),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

function ProfileTab() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // defaultValues (captured once at mount), not `values`: a fresh object
  // literal there would resync the form on every re-render — including a
  // background refetch of the auth user — silently discarding any edit the
  // user is mid-typing. Settings only mounts after ProtectedRoute has
  // already loaded `user`, so it's populated by the time this runs.
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authUserKey, updatedUser)
      toast.success('Profile updated')
    },
    onError: () => toast.error('Could not update your profile'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your name and email address.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function PasswordTab() {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  const mutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success('Password updated')
      form.reset()
    },
    onError: () => {
      form.setError('current_password', { message: 'Your current password is incorrect.' })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Choose a strong, unique password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
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
                  <FormLabel>New password</FormLabel>
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
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

const workspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional().or(z.literal('')),
})

function WorkspaceTab() {
  const { currentWorkspace, isLoading } = useCurrentWorkspace()
  const navigate = useNavigate()
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const updateWorkspace = useUpdateWorkspace(currentWorkspace?.id ?? 0)
  const leaveWorkspace = useLeaveWorkspace()
  const deleteWorkspace = useDeleteWorkspace()

  const form = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
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
          <CardTitle>Workspace details</CardTitle>
          <CardDescription>Update {currentWorkspace.name}&apos;s name and description.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                updateWorkspace.mutate(values, {
                  onSuccess: () => toast.success('Workspace updated'),
                  onError: () => toast.error('Could not update the workspace'),
                })
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
                    <FormLabel>Description</FormLabel>
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
                  Save changes
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            {isOwner
              ? 'Leaving or deleting this workspace cannot be undone.'
              : "Leaving removes your access to this workspace's EPKs, media, and contacts."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setConfirmLeaveOpen(true)}>
            Leave workspace
          </Button>
          {isOwner && (
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              Delete workspace
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        title="Leave workspace"
        description={`You'll lose access to "${currentWorkspace.name}" until someone invites you back.`}
        confirmLabel="Leave"
        destructive
        isLoading={leaveWorkspace.isPending}
        onConfirm={() =>
          leaveWorkspace.mutate(currentWorkspace.id, {
            onSuccess: () => {
              setConfirmLeaveOpen(false)
              toast.success(`Left ${currentWorkspace.name}`)
              navigate('/', { replace: true })
            },
            onError: () =>
              toast.error(
                "Could not leave this workspace — as the sole owner you'll need to transfer or delete it first."
              ),
          })
        }
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete workspace"
        description={`"${currentWorkspace.name}" and everything in it — EPKs, media, contacts — will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteWorkspace.isPending}
        onConfirm={() =>
          deleteWorkspace.mutate(currentWorkspace.id, {
            onSuccess: () => {
              setConfirmDeleteOpen(false)
              toast.success(`Deleted ${currentWorkspace.name}`)
              navigate('/', { replace: true })
            },
            onError: () => toast.error('Could not delete this workspace'),
          })
        }
      />
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and workspace details.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="workspace" className="mt-4">
          <WorkspaceTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
