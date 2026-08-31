import { useMutation, useQuery } from '@tanstack/react-query'
import { createCheckoutSession, createPortalSession, getBilling } from '@/api/billing'
import type { SubscriptionPlan } from '@/types'

export function useBilling(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'billing'],
    queryFn: () => getBilling(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

// No onSuccess cache update: both redirect the whole browser away to
// Stripe's own hosted page immediately, so there's nothing here to
// invalidate — the workspace's plan only actually changes once the user
// completes checkout and Stripe's webhook lands (see StripeWebhookController
// on the backend), well after this request/response is long gone. The
// Billing page's own useBilling() query naturally reflects that once the
// user is redirected back and it refetches.
export function useCreateCheckoutSession(workspaceId: number) {
  return useMutation({
    mutationFn: (plan: Extract<SubscriptionPlan, 'pro' | 'business'>) => createCheckoutSession(workspaceId, plan),
  })
}

export function useCreatePortalSession(workspaceId: number) {
  return useMutation({
    mutationFn: () => createPortalSession(workspaceId),
  })
}
