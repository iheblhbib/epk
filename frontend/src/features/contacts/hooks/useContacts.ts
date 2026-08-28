import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContact,
  deleteContact,
  importContacts,
  listContacts,
  updateContact,
  type ContactFormPayload,
} from '@/api/contacts'
import type { ContactCategory } from '@/types'

export const contactsKey = (workspaceId: number, search?: string, category?: ContactCategory) =>
  ['workspaces', workspaceId, 'contacts', search ?? '', category ?? ''] as const

export function useContacts(workspaceId: number | undefined, filters?: { search?: string; category?: ContactCategory }) {
  return useQuery({
    queryKey: contactsKey(workspaceId ?? 0, filters?.search, filters?.category),
    queryFn: () => listContacts(workspaceId as number, filters),
    enabled: workspaceId !== undefined,
  })
}

export function useCreateContact(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ContactFormPayload) => createContact(workspaceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'contacts'] }),
  })
}

export function useUpdateContact(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ contactId, payload }: { contactId: number; payload: Partial<ContactFormPayload> }) =>
      updateContact(contactId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'contacts'] }),
  })
}

export function useDeleteContact(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (contactId: number) => deleteContact(contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'contacts'] }),
  })
}

export function useImportContacts(workspaceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => importContacts(workspaceId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'contacts'] }),
  })
}
