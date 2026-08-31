import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createApiToken, listApiTokens, revokeApiToken } from '@/api/apiTokens'

export const apiTokensKey = ['api-tokens'] as const

export function useApiTokens() {
  return useQuery({ queryKey: apiTokensKey, queryFn: listApiTokens })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensKey }),
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensKey }),
  })
}
