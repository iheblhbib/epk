import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvitation,
  createWorkspace,
  deleteWorkspace,
  inviteWorkspaceMember,
  leaveWorkspace,
  listWorkspaceMembers,
  listWorkspaces,
  loginForInvitation,
  previewInvitation,
  registerForInvitation,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from '@/api/workspaces'
import { authUserKey } from '@/lib/queryClient'
import type { WorkspaceRole } from '@/types'

export const workspacesKey = ['workspaces'] as const
export const workspaceMembersKey = (workspaceId: number) => ['workspaces', workspaceId, 'members'] as const

export function useWorkspaces() {
  return useQuery({ queryKey: workspacesKey, queryFn: listWorkspaces })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useUpdateWorkspace(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { name?: string; description?: string }) => updateWorkspace(workspaceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useLeaveWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leaveWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useWorkspaceMembers(workspaceId: number | undefined) {
  return useQuery({
    queryKey: workspaceMembersKey(workspaceId ?? 0),
    queryFn: () => listWorkspaceMembers(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

export function useInviteWorkspaceMember(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { email: string; role: WorkspaceRole }) =>
      inviteWorkspaceMember(workspaceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceMembersKey(workspaceId) }),
  })
}

export function useUpdateWorkspaceMemberRole(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: WorkspaceRole }) =>
      updateWorkspaceMemberRole(workspaceId, memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceMembersKey(workspaceId) }),
  })
}

export function useRemoveWorkspaceMember(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: number) => removeWorkspaceMember(workspaceId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceMembersKey(workspaceId) }),
  })
}

export function useInvitationPreview(token: string) {
  return useQuery({ queryKey: ['invitations', token], queryFn: () => previewInvitation(token) })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useLoginForInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => loginForInvitation(token, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authUserKey })
      queryClient.invalidateQueries({ queryKey: workspacesKey })
    },
  })
}

export function useRegisterForInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      token,
      payload,
    }: {
      token: string
      payload: { name: string; password: string; password_confirmation: string }
    }) => registerForInvitation(token, payload),
    onSuccess: () => {
      // The backend logged this browser in as the new account — refetch
      // the auth user (rather than trying to reconstruct it from the
      // WorkspaceMember response) so useAuth() picks it up immediately.
      queryClient.invalidateQueries({ queryKey: authUserKey })
      queryClient.invalidateQueries({ queryKey: workspacesKey })
    },
  })
}
