import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmTwoFactorAuthentication,
  disableTwoFactorAuthentication,
  enableTwoFactorAuthentication,
  getTwoFactorRecoveryCodes,
  regenerateTwoFactorRecoveryCodes,
} from '@/api/auth'
import { authUserKey } from '@/lib/queryClient'

export const twoFactorRecoveryCodesKey = ['two-factor-recovery-codes'] as const

export function useEnableTwoFactorAuthentication() {
  return useMutation({ mutationFn: enableTwoFactorAuthentication })
}

export function useConfirmTwoFactorAuthentication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: confirmTwoFactorAuthentication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authUserKey }),
  })
}

export function useDisableTwoFactorAuthentication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disableTwoFactorAuthentication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authUserKey }),
  })
}

export function useTwoFactorRecoveryCodes(enabled: boolean) {
  return useQuery({
    queryKey: twoFactorRecoveryCodesKey,
    queryFn: getTwoFactorRecoveryCodes,
    enabled,
  })
}

export function useRegenerateTwoFactorRecoveryCodes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: regenerateTwoFactorRecoveryCodes,
    onSuccess: (codes) => queryClient.setQueryData(twoFactorRecoveryCodesKey, codes),
  })
}
