import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLocale } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

/** Persists a signed-in user's language choice to their account. */
export function useUpdateLocale() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (locale: string) => updateLocale(locale),
    onSuccess: (user) => queryClient.setQueryData(authUserKey, user),
  })
}
