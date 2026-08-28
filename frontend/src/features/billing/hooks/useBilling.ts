import { useQuery } from '@tanstack/react-query'
import { getBilling } from '@/api/billing'

export function useBilling(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'billing'],
    queryFn: () => getBilling(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}
