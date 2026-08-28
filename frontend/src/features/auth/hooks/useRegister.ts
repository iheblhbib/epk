import { useMutation, useQueryClient } from '@tanstack/react-query'
import { register, type RegisterPayload } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(authUserKey, user)
    },
  })
}
