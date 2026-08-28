import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logout } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authUserKey, null)
      queryClient.clear()
    },
  })
}
