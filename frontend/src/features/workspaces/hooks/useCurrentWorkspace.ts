import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspaces } from '@/features/workspaces/hooks/useWorkspaces'

const STORAGE_KEY = 'kitfolio:current-workspace-id'
const currentWorkspaceIdKey = ['currentWorkspaceId'] as const

/**
 * The selected id lives in the shared TanStack Query cache (not local
 * component state) so every component calling this hook — the Topbar
 * switcher, the dashboard, the EPKs page, the Team page — reads and reacts
 * to the same value. It's also mirrored to localStorage so it survives a
 * reload, falling back to the first workspace the user belongs to when
 * nothing is stored yet (or the stored id no longer matches a membership).
 */
export function useCurrentWorkspace() {
  const queryClient = useQueryClient()
  const { data: workspaces, isLoading } = useWorkspaces()

  const { data: selectedId } = useQuery({
    queryKey: currentWorkspaceIdKey,
    queryFn: () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? Number(stored) : null
    },
    staleTime: Infinity,
  })

  const list = workspaces ?? []
  const currentWorkspace = list.find((workspace) => workspace.id === selectedId) ?? list[0] ?? null

  const setCurrentWorkspaceId = (id: number) => {
    queryClient.setQueryData(currentWorkspaceIdKey, id)
    localStorage.setItem(STORAGE_KEY, String(id))
  }

  return {
    workspaces: list,
    currentWorkspace,
    setCurrentWorkspaceId,
    isLoading,
  }
}
