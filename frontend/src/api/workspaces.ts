import { apiClient, ensureCsrfCookie } from '@/api/client'
import type {
  ApiCollection,
  ApiPaginated,
  ApiResource,
  Workspace,
  WorkspaceActivityLogEntry,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types'

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<ApiCollection<Workspace>>('/api/workspaces')
  return data.data
}

export async function createWorkspace(payload: { name: string; description?: string }): Promise<Workspace> {
  const { data } = await apiClient.post<ApiResource<Workspace>>('/api/workspaces', payload)
  return data.data
}

export async function updateWorkspace(
  id: number,
  payload: { name?: string; description?: string }
): Promise<Workspace> {
  const { data } = await apiClient.put<ApiResource<Workspace>>(`/api/workspaces/${id}`, payload)
  return data.data
}

export async function deleteWorkspace(id: number): Promise<void> {
  await apiClient.delete(`/api/workspaces/${id}`)
}

export async function leaveWorkspace(id: number): Promise<void> {
  await apiClient.post(`/api/workspaces/${id}/leave`)
}

export async function listWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<ApiCollection<WorkspaceMember>>(
    `/api/workspaces/${workspaceId}/members`
  )
  return data.data
}

export async function inviteWorkspaceMember(
  workspaceId: number,
  payload: { email: string; role: WorkspaceRole }
): Promise<WorkspaceMember> {
  const { data } = await apiClient.post<ApiResource<WorkspaceMember>>(
    `/api/workspaces/${workspaceId}/members`,
    payload
  )
  return data.data
}

export async function updateWorkspaceMemberRole(
  workspaceId: number,
  memberId: number,
  role: WorkspaceRole
): Promise<WorkspaceMember> {
  const { data } = await apiClient.put<ApiResource<WorkspaceMember>>(
    `/api/workspaces/${workspaceId}/members/${memberId}`,
    { role }
  )
  return data.data
}

export async function removeWorkspaceMember(workspaceId: number, memberId: number): Promise<void> {
  await apiClient.delete(`/api/workspaces/${workspaceId}/members/${memberId}`)
}

export async function listWorkspaceActivity(
  workspaceId: number,
  page = 1
): Promise<ApiPaginated<WorkspaceActivityLogEntry>> {
  const { data } = await apiClient.get<ApiPaginated<WorkspaceActivityLogEntry>>(
    `/api/workspaces/${workspaceId}/activity`,
    { params: { page } }
  )
  return data
}

export type InvitationPreview = {
  workspace: { id: number; name: string }
  role: WorkspaceRole
  invited_by: string | null
  invited_email: string
  has_account: boolean
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const { data } = await apiClient.get<ApiResource<InvitationPreview>>(`/api/invitations/${token}`)
  return data.data
}

export async function acceptInvitation(token: string): Promise<WorkspaceMember> {
  const { data } = await apiClient.post<ApiResource<WorkspaceMember>>(`/api/invitations/${token}/accept`)
  return data.data
}

export async function loginForInvitation(token: string, password: string): Promise<WorkspaceMember> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<ApiResource<WorkspaceMember>>(`/api/invitations/${token}/login`, {
    password,
  })
  return data.data
}

export async function registerForInvitation(
  token: string,
  payload: { name: string; password: string; password_confirmation: string }
): Promise<WorkspaceMember> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<ApiResource<WorkspaceMember>>(
    `/api/invitations/${token}/register`,
    payload
  )
  return data.data
}
