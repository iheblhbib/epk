import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPrivatePage, verifyPrivatePagePassword } from '@/api/privatePage'
import type { PublicEpk } from '@/types'

export const privatePageKey = (token: string) => ['private-page', token] as const

export function usePrivatePage(token: string | undefined) {
  return useQuery({
    queryKey: privatePageKey(token ?? ''),
    queryFn: () => getPrivatePage(token as string),
    enabled: token !== undefined,
    retry: false,
  })
}

export function useVerifyPrivatePage(token: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (password: string) => verifyPrivatePagePassword(token, password),
    // The verify response is the same shape the GET would return once
    // unlocked — seed it directly so the page renders immediately without
    // an extra round trip, and so a subsequent reload's GET (now that the
    // session is marked verified) reads from a cache that already agrees.
    onSuccess: (epk: PublicEpk) => queryClient.setQueryData(privatePageKey(token), epk),
  })
}
