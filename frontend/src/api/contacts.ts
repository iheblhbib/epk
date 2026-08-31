import { apiClient } from '@/api/client'
import type { ApiCollection, ApiResource, Contact, ContactCategory, ContactImportSummary } from '@/types'

export interface ContactFormPayload {
  name: string
  email?: string
  phone?: string
  category?: ContactCategory
  organization?: string
  notes?: string
}

export async function listContacts(
  workspaceId: number,
  filters?: { search?: string; category?: ContactCategory }
): Promise<Contact[]> {
  const { data } = await apiClient.get<ApiCollection<Contact>>(`/api/workspaces/${workspaceId}/contacts`, {
    params: filters,
  })
  return data.data
}

export async function createContact(workspaceId: number, payload: ContactFormPayload): Promise<Contact> {
  const { data } = await apiClient.post<ApiResource<Contact>>(`/api/workspaces/${workspaceId}/contacts`, payload)
  return data.data
}

export async function updateContact(contactId: number, payload: Partial<ContactFormPayload>): Promise<Contact> {
  const { data } = await apiClient.put<ApiResource<Contact>>(`/api/contacts/${contactId}`, payload)
  return data.data
}

export async function deleteContact(contactId: number): Promise<void> {
  await apiClient.delete(`/api/contacts/${contactId}`)
}

export async function importContacts(workspaceId: number, file: File): Promise<ContactImportSummary> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<{ data: ContactImportSummary }>(
    `/api/workspaces/${workspaceId}/contacts/import`,
    formData
  )
  return data.data
}
