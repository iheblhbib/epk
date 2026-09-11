import { useMutation, useQuery } from '@tanstack/react-query'
import { createCheckoutSession, createPortalSession, getBilling, getInvoices, type BillingInterval } from '@/api/billing'
import type { SubscriptionPlan } from '@/types'

export function useBilling(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'billing'],
    queryFn: () => getBilling(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

// Only fetched once a workspace actually has a Stripe customer -- a
// never-subscribed (still trialing) workspace has no invoices to show,
// and the endpoint would just return an empty list anyway, so this skips
// the request entirely rather than firing it needlessly.
export function useInvoices(workspaceId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'billing', 'invoices'],
    queryFn: () => getInvoices(workspaceId as number),
    enabled: workspaceId !== undefined && enabled,
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
    mutationFn: ({ plan, interval }: { plan: SubscriptionPlan; interval: BillingInterval }) =>
      createCheckoutSession(workspaceId, plan, interval),
  })
}

export function useCreatePortalSession(workspaceId: number) {
  return useMutation({
    mutationFn: () => createPortalSession(workspaceId),
  })
}
