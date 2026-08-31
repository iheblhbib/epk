import { useMutation, useQueryClient } from '@tanstack/react-query'
import { twoFactorChallenge } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

export function useTwoFactorChallenge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: twoFactorChallenge,
    onSuccess: (user) => {
      queryClient.setQueryData(authUserKey, user)
    },
  })
}
