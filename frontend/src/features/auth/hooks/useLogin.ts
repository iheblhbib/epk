import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, type LoginPayload } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(authUserKey, user)
    },
  })
}
