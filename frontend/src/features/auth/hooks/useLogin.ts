import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, type LoginPayload } from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'
import { isTwoFactorRequired } from '@/types'

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (result) => {
      // Nothing to cache yet when a second factor is still pending — there
      // is no session, so `result` isn't a real User (see
      // AuthenticatedSessionController::store()). useTwoFactorChallenge
      // populates this same cache once that step succeeds instead.
      if (!isTwoFactorRequired(result)) {
        queryClient.setQueryData(authUserKey, result)
      }
    },
  })
}
