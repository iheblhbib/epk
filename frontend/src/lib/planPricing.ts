import type { SubscriptionPlan } from '@/types'

/**
 * Static display prices (EUR). These must stay in sync with
 * backend/config/plans.php's `price_monthly` / `price_yearly_effective_monthly`
 * fields — the backend is now the source of truth, read by
 * AdminBillingStats to compute MRR. Keep these in sync manually with that
 * file and with
 * docs/superpowers/specs/2026-09-02-subscription-billing-overhaul-design.md
 * if either ever changes.
 */
export const PLAN_PRICING: Record<Exclude<SubscriptionPlan, never>, { monthly: number; yearlyEffectiveMonthly: number }> = {
  starter: { monthly: 6.66, yearlyEffectiveMonthly: 5.55 },
  pro: { monthly: 26.66, yearlyEffectiveMonthly: 22.22 },
  business: { monthly: 99.99, yearlyEffectiveMonthly: 83.33 },
}

export function formatEuro(amount: number): string {
  return `€${amount.toFixed(2)}`
}

export function yearlyTotal(plan: SubscriptionPlan): number {
  return Math.round(PLAN_PRICING[plan].yearlyEffectiveMonthly * 12 * 100) / 100
}
